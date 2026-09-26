import { parseHTML } from 'linkedom'

import { extractFromDocument } from '../extract'
import { fetchUrl, isHtmlContentType } from './http'
import { addUrl, normalizeUrl, originOf, type DiscoveredEntry } from './normalize'
import { loadRobots } from './robots'
import { collectSitemapPages } from './sitemap'
import type { DiscoveryResult, DiscoveredUrl } from './types'

/** Below this many sitemap entries, crawling links usually finds more. */
const MIN_SITEMAP_URLS = 5

export interface DiscoverOptions {
  seedUrl: string
  maxUrls?: number
  maxDepth?: number
  maxFetches?: number
  concurrency?: number
  timeoutMs?: number
  signal?: AbortSignal
  onProgress?: (info: { phase: 'sitemap' | 'crawl'; fetched: number; discovered: number; current: string }) => void
}

/**
 * Builds the list of pages to audit: the site sitemap when there is one,
 * otherwise a breadth-first walk of internal links starting at the seed page.
 */
export async function discoverSite(options: DiscoverOptions): Promise<DiscoveryResult> {
  const origin = originOf(options.seedUrl)
  if (!origin) {
    throw new Error(`Not a valid URL: ${options.seedUrl}`)
  }

  const maxUrls = options.maxUrls ?? 2000
  const maxDepth = options.maxDepth ?? 6
  const maxFetches = options.maxFetches ?? 300
  const concurrency = options.concurrency ?? 4
  const timeoutMs = options.timeoutMs ?? 10_000
  const notes: string[] = []

  const robots = await loadRobots(origin, options.signal)

  // 1) Sitemaps: whatever robots.txt declares, plus the conventional location.
  const sitemapCandidates = [...robots.sitemaps]
  const defaultSitemap = new URL('/sitemap.xml', origin).href
  if (!sitemapCandidates.includes(defaultSitemap)) sitemapCandidates.push(defaultSitemap)

  const sitemapResult = await collectSitemapPages(sitemapCandidates, {
    maxUrls,
    signal: options.signal,
    fetchText: async (url) => {
      const result = await fetchUrl(url, { timeoutMs, signal: options.signal, maxBytes: 8_000_000 })
      return result.ok ? result.body : null
    },
    onProgress: ({ urlsFound, current }) => options.onProgress?.({ phase: 'sitemap', fetched: 0, discovered: urlsFound, current }),
  })

  const entries: DiscoveredEntry[] = []
  const seen = new Set<string>()

  for (const url of sitemapResult.urls) {
    const normalized = normalizeUrl(url, origin)
    if (normalized) addUrl(normalized, 'sitemap', 0, origin, seen, entries)
  }

  // Make sure the page the user started from is always part of the audit.
  const seed = normalizeUrl(options.seedUrl, origin)
  if (seed && !seen.has(seed)) {
    seen.delete(seed)
    addUrl(seed, 'link', 0, origin, seen, entries)
  }

  if (sitemapResult.errors.length > 0) {
    notes.push(`${sitemapResult.errors.length} sitemap(s) could not be read.`)
  }

  let fetched = 0
  let source: DiscoveryResult['source'] = entries.length > 0 ? 'sitemap' : 'crawl'

  // 2) Link crawl: either because there is no usable sitemap, or to top one up.
  if (entries.length < MIN_SITEMAP_URLS) {
    const crawl = await crawlLinks({
      origin,
      robotsAllowed: robots.isAllowed,
      maxUrls,
      maxDepth,
      maxFetches,
      concurrency,
      timeoutMs,
      signal: options.signal,
      seen,
      entries,
      onPage: (current, discovered) => {
        fetched++
        options.onProgress?.({ phase: 'crawl', fetched, discovered, current })
      },
    })
    fetched = crawl.fetched
    if (entries.length > 0 && sitemapResult.urls.length > 0) {
      source = 'mixed'
      notes.push(`Sitemap listed ${sitemapResult.urls.length} URLs; link crawl added the rest.`)
    } else if (sitemapResult.urls.length === 0) {
      source = 'crawl'
      if (fetched > 0) notes.push('No sitemap found — URLs came from crawling internal links.')
      else notes.push('No sitemap found and no internal links could be crawled.')
    } else {
      source = 'sitemap'
    }
  } else {
    notes.push(`URLs came from ${sitemapResult.sitemapsFetched} sitemap(s).`)
  }

  if (robots.crawlDelayMs > 0) {
    notes.push(`robots.txt requests a crawl delay of ${Math.round(robots.crawlDelayMs)}ms.`)
  }

  // Sitemaps happily list pages that robots.txt disallows; offering them would
  // only produce "disallowed" findings, so drop them before the user picks.
  const crawlable = entries.filter((entry) => robots.isAllowed(entry.url))
  const blocked = entries.length - crawlable.length
  if (blocked > 0) {
    notes.push(`${blocked} URL(s) skipped because robots.txt disallows them.`)
  }

  const urls: DiscoveredUrl[] = crawlable.slice(0, maxUrls)
  if (crawlable.length > maxUrls) {
    notes.push(`Stopped at the ${maxUrls} URL limit.`)
  }

  return {
    origin,
    seedUrl: options.seedUrl,
    source,
    urls,
    robotsTxt: robots.text,
    robotsChecked: robots.checked,
    fetched,
    notes,
  }
}

interface CrawlLinksOptions {
  origin: string
  robotsAllowed: (url: string) => boolean
  maxUrls: number
  maxDepth: number
  maxFetches: number
  concurrency: number
  timeoutMs: number
  signal?: AbortSignal
  seen: Set<string>
  entries: DiscoveredEntry[]
  onPage: (current: string, discovered: number) => void
}

/** Breadth-first walk of internal links, using a small worker pool. */
async function crawlLinks(options: CrawlLinksOptions): Promise<{ fetched: number }> {
  const { origin, seen, entries } = options
  const frontier: DiscoveredEntry[] = []
  const seedUrl = new URL('/', origin).href
  addUrl(seedUrl, 'link', 0, origin, seen, entries)
  frontier.push({ url: seedUrl, from: 'link', depth: 0 })

  let cursor = 0
  let fetched = 0

  const worker = async (): Promise<void> => {
    while (cursor < frontier.length) {
      if (fetched >= options.maxFetches || entries.length >= options.maxUrls) return
      if (options.signal?.aborted) return

      const current = frontier[cursor++]
      fetched++

      const result = await fetchUrl(current.url, {
        timeoutMs: options.timeoutMs,
        signal: options.signal,
        maxBytes: 2_000_000,
      })
      options.onPage(current.url, entries.length)

      if (!result.ok || !isHtmlContentType(result.contentType)) continue
      if (current.depth >= options.maxDepth) continue

      for (const link of extractLinks(result.body, result.finalUrl)) {
        if (entries.length >= options.maxUrls) return
        if (!options.robotsAllowed(link)) continue
        if (!addUrl(link, 'link', current.depth + 1, origin, seen, entries)) continue
        frontier.push({ url: link, from: 'link', depth: current.depth + 1 })
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, options.concurrency) }, () => worker())
  await Promise.all(workers)

  return { fetched }
}

/** Parses fetched HTML and returns the normalized internal links it contains. */
function extractLinks(html: string, baseUrl: string): string[] {
  try {
    const { document } = parseHTML(html)
    const page = extractFromDocument(document as unknown as Document, baseUrl)
    return page.links.map((link) => normalizeUrl(link.href, baseUrl)).filter((url): url is string => Boolean(url))
  } catch {
    return []
  }
}
