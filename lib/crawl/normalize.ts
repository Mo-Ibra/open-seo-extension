/**
 * URL normalization and filtering for the site crawler.
 *
 * Everything the crawler fetches is normalized first so that `/a?utm_source=x`,
 * `/a#top` and `/a` collapse into a single entry instead of being audited
 * three times.
 */

/** Extensions that are never worth auditing as pages. */
const ASSET_EXTENSIONS = new Set([
  '7z', 'avi', 'avif', 'bmp', 'css', 'csv', 'doc', 'docx', 'eot', 'eps', 'gif',
  'gz', 'ico', 'jpeg', 'jpg', 'js', 'json', 'm4a', 'm4v', 'map', 'mov', 'mp3',
  'mp4', 'mpeg', 'mpg', 'oga', 'ogg', 'ogv', 'otf', 'pdf', 'png', 'ppt',
  'pptx', 'rar', 'rss', 'svg', 'swf', 'tar', 'tif', 'tiff', 'ttf', 'txt',
  'wav', 'webm', 'webp', 'wmv', 'woff', 'woff2', 'xls', 'xlsx', 'xml', 'zip',
])

/** Query parameters that never identify a distinct page. */
const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|gbraid$|wbraid$|msclkid$|mc_[ce]id$|igshid$|ref$|referrer$|_ga$|yclid$|dclid$|ttclid$|twclid$)/i

/**
 * Resolves `href` against `base` and strips the parts that make two URLs the
 * same page: the fragment and tracking parameters. Returns `null` for anything
 * that is not an http(s) URL.
 */
export function normalizeUrl(href: string, base: string): string | null {
  const raw = href.trim()
  if (!raw) return null

  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  url.hash = ''

  const params = Array.from(url.searchParams.entries())
    .filter(([key]) => !TRACKING_PARAMS.test(key))
    .sort(([a], [b]) => a.localeCompare(b))
  url.search = ''
  for (const [key, value] of params) {
    url.searchParams.append(key, value)
  }

  return url.href
}

/** True when both URLs share scheme, host and port. */
export function isSameOrigin(url: string, other: string): boolean {
  try {
    return new URL(url).origin === new URL(other).origin
  } catch {
    return false
  }
}

/** The scheme + host of a URL, or `null` when it cannot be parsed. */
export function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/** Rejects asset URLs, tracking endpoints and anything that is not a page. */
export function isScannableUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (parsed.origin === 'null') return false

  // Skip common non-HTML endpoints.
  if (/\/(wp-admin|wp-login|wp-json|admin|login|logout|cart|checkout)(\/|$)/i.test(parsed.pathname)) {
    return false
  }

  const lastSegment = parsed.pathname.split('/').pop() || ''
  const dot = lastSegment.lastIndexOf('.')
  if (dot > 0) {
    const extension = lastSegment.slice(dot + 1).toLowerCase()
    if (ASSET_EXTENSIONS.has(extension)) return false
  }

  return true
}

/**
 * Adds a URL to `seen`/`list` when it is new, scannable and same-origin.
 * Returns `true` when the URL was added.
 */
export function addUrl(
  url: string,
  from: 'sitemap' | 'link',
  depth: number,
  origin: string,
  seen: Set<string>,
  list: DiscoveredEntry[]
): boolean {
  if (seen.has(url)) return false
  seen.add(url)
  if (!isScannableUrl(url) || !isSameOrigin(url, origin)) return false
  list.push({ url, from, depth })
  return true
}

export interface DiscoveredEntry {
  url: string
  from: 'sitemap' | 'link'
  depth: number
}
