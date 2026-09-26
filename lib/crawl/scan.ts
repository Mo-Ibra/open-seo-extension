import { parseHTML } from 'linkedom'

import { runAudit } from '../audit'
import { extractFromDocument } from '../extract'
import type { Finding } from '../types'
import { fetchUrl, isHtmlContentType } from './http'
import type { PageReport } from './types'

export interface ScanOptions {
  urls: string[]
  robotsTxt: string | null
  robotsChecked: boolean
  /** False when robots.txt disallows the URL. */
  robotsAllowed: (url: string) => boolean
  concurrency?: number
  timeoutMs?: number
  signal: AbortSignal
  onPage: (report: PageReport) => void
  onSkip?: (url: string) => void
  onProgress: (info: { scanned: number; total: number; current: string[] }) => void
}

/**
 * Fetches and audits every URL with a bounded worker pool, reporting each page
 * as soon as it finishes so the popup can show progress and the results survive
 * a service-worker restart.
 */
export async function scanUrls(options: ScanOptions): Promise<PageReport[]> {
  const total = options.urls.length
  const concurrency = Math.max(1, options.concurrency ?? 4)
  const timeoutMs = options.timeoutMs ?? 10_000

  const reports: PageReport[] = []
  const inFlight = new Set<string>()
  let cursor = 0
  let scanned = 0

  const report = (page: PageReport): void => {
    reports.push(page)
    options.onPage(page)
    scanned++
    options.onProgress({ scanned, total, current: Array.from(inFlight) })
  }

  const worker = async (): Promise<void> => {
    while (cursor < options.urls.length) {
      if (options.signal.aborted) return
      const url = options.urls[cursor++]

      if (!options.robotsAllowed(url)) {
        options.onSkip?.(url)
        continue
      }

      inFlight.add(url)
      try {
        report(await auditPage(url, options, timeoutMs))
      } finally {
        inFlight.delete(url)
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, Math.max(total, 1)) }, () => worker())
  await Promise.all(workers)

  return reports
}

async function auditPage(url: string, options: ScanOptions, timeoutMs: number): Promise<PageReport> {
  const result = await fetchUrl(url, { timeoutMs, signal: options.signal, maxBytes: 3_000_000 })

  if (!result.ok) {
    return {
      url,
      status: result.status,
      ok: false,
      finalUrl: result.finalUrl,
      contentType: null,
      durationMs: result.durationMs,
      title: '',
      wordCount: 0,
      findings: [fetchFailureFinding(url, result.reason)],
    }
  }

  const transportFindings: Finding[] = []
  if (result.status >= 400) {
    transportFindings.push(statusFinding(result.status, url))
  } else if (result.status >= 300) {
    transportFindings.push({
      id: 'http-server-error',
      label: 'HTTP',
      value: String(result.status),
      status: 'warn',
      message: `The server answered ${result.status} for this URL.`,
    })
  }
  if (result.finalUrl !== url) {
    transportFindings.push({
      id: 'http-redirect',
      label: 'Redirect',
      value: result.finalUrl,
      status: 'warn',
      message: `This URL redirects to ${result.finalUrl}.`,
      fix: 'Link to the final destination instead of the redirecting URL.',
    })
  }

  if (!isHtmlContentType(result.contentType)) {
    return {
      url,
      status: result.status,
      ok: result.status < 400,
      finalUrl: result.finalUrl,
      contentType: result.contentType,
      durationMs: result.durationMs,
      title: '',
      wordCount: 0,
      findings: [
        ...transportFindings,
        {
          id: 'http-non-html',
          label: 'Content type',
          value: result.contentType,
          status: 'warn',
          message: 'This URL does not return an HTML document, so it cannot be audited.',
        },
      ],
    }
  }

  try {
    const { document } = parseHTML(result.body)
    const page = extractFromDocument(document as unknown as Document, result.finalUrl)
    const context = {
      robotsTxt: options.robotsTxt,
      robotsTxtChecked: options.robotsChecked,
      xRobotsTag: result.xRobotsTag,
      xRobotsTagChecked: true,
    }
    const findings = runAudit(page, context)

    return {
      url,
      status: result.status,
      ok: result.status < 400,
      finalUrl: result.finalUrl,
      contentType: result.contentType,
      durationMs: result.durationMs,
      title: page.title,
      wordCount: page.wordCount,
      findings: [...transportFindings, ...compact(findings)],
    }
  } catch (error) {
    return {
      url,
      status: result.status,
      ok: false,
      finalUrl: result.finalUrl,
      contentType: result.contentType,
      durationMs: result.durationMs,
      title: '',
      wordCount: 0,
      findings: [
        ...transportFindings,
        {
          id: 'http-parse-error',
          label: 'HTML',
          value: null,
          status: 'warn',
          message: `Could not parse this page: ${error instanceof Error ? error.message : 'unknown error'}`,
        },
      ],
    }
  }
}

function statusFinding(status: number, url: string): Finding {
  return {
    id: 'http-error',
    label: 'HTTP status',
    value: String(status),
    status: 'fail',
    message: `This URL returns ${status}.`,
    fix: status === 404 ? 'Remove it from your sitemap and internal links, or restore the page.' : 'Fix the server response for this URL.',
  }
}

function fetchFailureFinding(url: string, reason: string): Finding {
  const label =
    reason === 'timeout' ? 'timed out' : reason === 'too-large' ? 'was too large to download' : 'could not be reached'
  return {
    id: `http-${reason}`,
    label: 'Fetch',
    value: null,
    status: 'warn',
    message: `${url} ${label}.`,
  }
}

/**
 * Drops the bulky `items` arrays (heading outlines) before a report is stored:
 * a 1000-page scan would otherwise blow through the storage quota.
 */
function compact(findings: Finding[]): Finding[] {
  return findings.map(({ items: _items, ...rest }) => rest)
}
