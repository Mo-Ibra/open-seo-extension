import type { Finding, Status } from '../types'
import type { PageReport } from './types'

/** Everything one finding type (e.g. `title-too-long`) across the site. */
export interface IssueGroup {
  id: string
  label: string
  status: Status
  count: number
  urls: string[]
  message: string
  fix?: string
}

export interface PageRow {
  url: string
  status: number | null
  ok: boolean
  title: string
  wordCount: number
  fail: number
  warn: number
  worst: Status
}

export interface SiteReport {
  pages: PageRow[]
  totalPages: number
  okPages: number
  fails: number
  warns: number
  passes: number
  /** Issue types sorted by how many pages they affect (worst first on ties). */
  issues: IssueGroup[]
  /** 0–100, averaged per page. */
  score: number
}

const RANK: Record<Status, number> = { pass: 0, warn: 1, fail: 2 }

function worse(a: Status, b: Status): Status {
  return RANK[a] >= RANK[b] ? a : b
}

export function worstStatus(findings: Finding[]): Status {
  return findings.reduce<Status>((worst, finding) => worse(worst, finding.status), 'pass')
}

export function buildReport(results: PageReport[]): SiteReport {
  const groups = new Map<string, IssueGroup>()
  let fails = 0
  let warns = 0
  let passes = 0
  let okPages = 0
  let scoreTotal = 0

  const pages: PageRow[] = results.map((result) => {
    let fail = 0
    let warn = 0

    for (const finding of result.findings) {
      if (finding.status === 'fail') fail++
      else if (finding.status === 'warn') warn++

      const existing = groups.get(finding.id)
      if (existing) {
        existing.count++
        existing.urls.push(result.url)
        existing.status = worse(existing.status, finding.status)
      } else {
        groups.set(finding.id, {
          id: finding.id,
          label: finding.label,
          status: finding.status,
          count: 1,
          urls: [result.url],
          message: finding.message,
          fix: finding.fix,
        })
      }
    }

    fails += fail
    warns += warn
    passes += result.findings.filter((finding) => finding.status === 'pass').length
    if (result.ok) okPages++
    scoreTotal += Math.max(0, 100 - fail * 15 - warn * 5)

    return {
      url: result.url,
      status: result.status,
      ok: result.ok,
      title: result.title,
      wordCount: result.wordCount,
      fail,
      warn,
      worst: worstStatus(result.findings),
    }
  })

  const issues = Array.from(groups.values())
    .filter((group) => group.status !== 'pass')
    .sort((a, b) => b.count - a.count || RANK[b.status] - RANK[a.status])

  pages.sort((a, b) => RANK[b.worst] - RANK[a.worst] || b.fail - a.fail || b.warn - a.warn)

  return {
    pages,
    totalPages: results.length,
    okPages,
    fails,
    warns,
    passes,
    issues,
    score: results.length > 0 ? Math.round(scoreTotal / results.length) : 0,
  }
}

/** Flattens the report into one CSV row per page and issue. */
export function toCsv(origin: string, results: PageReport[]): string {
  const header = ['url', 'status', 'title', 'word_count', 'issues', 'fails', 'warns', 'issue_ids']
  const rows = results.map((result) => [
    result.url,
    result.status === null ? '' : String(result.status),
    result.title,
    String(result.wordCount),
    String(result.findings.length),
    String(result.findings.filter((finding) => finding.status === 'fail').length),
    String(result.findings.filter((finding) => finding.status === 'warn').length),
    result.findings.map((finding) => finding.id).join(' '),
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

export function toJson(origin: string, results: PageReport[]): string {
  return JSON.stringify({ origin, exportedAt: new Date().toISOString(), pages: results }, null, 2)
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}
