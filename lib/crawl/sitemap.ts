/**
 * Sitemap reading.
 *
 * Sitemaps are machine-generated XML, so the `<loc>` entries are extracted with
 * a small parser rather than a full XML engine (service workers have no
 * `DOMParser`). Both plain `<urlset>` sitemaps and `<sitemapindex>` files, which
 * point at further sitemaps, are supported.
 */

const MAX_SITEMAP_DEPTH = 3
const MAX_SITEMAPS = 25
const MAX_LOCS = 5000

export interface SitemapParse {
  /** `<url><loc>` entries — actual pages. */
  pageUrls: string[]
  /** `<sitemap><loc>` entries — nested sitemaps. */
  sitemapUrls: string[]
}

export function parseSitemap(xml: string): SitemapParse {
  const locs = Array.from(xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)).map((match) =>
    decodeXml(match[1].trim())
  )

  const isIndex = /<sitemapindex[\s>]/i.test(xml)
  return isIndex
    ? { pageUrls: [], sitemapUrls: locs }
    : { pageUrls: locs, sitemapUrls: [] }
}

function decodeXml(value: string): string {
  const unwrapped = value.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')
  return unwrapped
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

function safeCodePoint(code: number): string {
  return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : ''
}

export interface CollectSitemapOptions {
  maxSitemaps?: number
  maxUrls?: number
  timeoutMs?: number
  signal?: AbortSignal
  fetchText: (url: string) => Promise<string | null>
  onProgress?: (info: { sitemapsFetched: number; urlsFound: number; current: string }) => void
}

export interface CollectSitemapResult {
  urls: string[]
  sitemapsFetched: number
  errors: string[]
}

/** Walks sitemaps (and nested sitemap indexes) collecting page URLs. */
export async function collectSitemapPages(
  rootSitemaps: string[],
  options: CollectSitemapOptions
): Promise<CollectSitemapResult> {
  const maxSitemaps = options.maxSitemaps ?? MAX_SITEMAPS
  const maxUrls = options.maxUrls ?? MAX_LOCS
  const timeoutMs = options.timeoutMs ?? 10_000

  const seenSitemaps = new Set<string>()
  const seenUrls = new Set<string>()
  const urls: string[] = []
  const errors: string[] = []
  const queue = [...rootSitemaps]
  let sitemapsFetched = 0

  while (queue.length > 0 && sitemapsFetched < maxSitemaps && urls.length < maxUrls) {
    const sitemapUrl = queue.shift()!
    if (seenSitemaps.has(sitemapUrl)) continue
    seenSitemaps.add(sitemapUrl)
    sitemapsFetched++

    options.onProgress?.({ sitemapsFetched, urlsFound: urls.length, current: sitemapUrl })

    const xml = await options.fetchText(sitemapUrl)
    if (xml === null) {
      errors.push(sitemapUrl)
      continue
    }

    const { pageUrls, sitemapUrls } = parseSitemap(xml)
    queue.push(...sitemapUrls)

    for (const url of pageUrls) {
      if (urls.length >= maxUrls) break
      if (seenUrls.has(url)) continue
      seenUrls.add(url)
      urls.push(url)
    }
  }

  return { urls, sitemapsFetched, errors }
}
