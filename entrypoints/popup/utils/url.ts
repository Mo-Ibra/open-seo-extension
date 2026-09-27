/**
 * URL helpers for display.
 *
 * These are all about making a URL fit in a narrow popup column. They are
 * deliberately forgiving: the popup renders whatever the page's HTML contained,
 * including hand-written relative hrefs and `javascript:` pseudo-links that
 * `new URL()` rejects. Every function here returns a printable string rather
 * than throwing or returning `null`, so a component can never crash on a
 * malformed URL.
 *
 * The crawler has its own, stricter URL logic in `lib/crawl/normalize.ts` — do
 * not reuse that here. It deliberately returns `null` and drops non-http
 * schemes, which is right for "should I fetch this?" and wrong for "show this
 * to the user".
 */

/** Matches the `http://` / `https://` prefix, used to shorten shown URLs. */
const SCHEME = /^https?:\/\//

/**
 * Just the host of a URL, for a search-result preview or a favicon-style
 * label. Falls back to the input when it cannot be parsed.
 */
export function hostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** Strips `http://` / `https://` so the page fits without a wasteful prefix. */
export function stripScheme(url: string): string {
  return url.replace(SCHEME, '')
}

/**
 * Host plus path, without the query string. Used for the "Now: example.com/pricing"
 * line while a scan runs, where the query string is noise.
 */
export function shortUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.pathname}`
  } catch {
    return url
  }
}

/**
 * Turns an origin into something safe to use as a filename, e.g.
 * `https://example.com/` becomes `example.com`.
 */
export function hostSlug(origin: string): string {
  return stripScheme(origin).replace(/[^\w.-]+/g, '-') || 'site'
}

/**
 * Resolves a possibly-relative URL against the page it was found on. Social
 * tags legitimately use `/assets/og.png`, which is useless on its own.
 * Returns `null` only when there is nothing to resolve.
 */
export function absoluteUrl(value: string | undefined, base: string): string | null {
  if (!value) return null
  try {
    return new URL(value, base).href
  } catch {
    return value
  }
}

/**
 * True when `href` points at the same origin as the page it was found on.
 *
 * Unlike `lib/crawl/normalize.ts`'s `isSameOrigin`, an unparseable href counts
 * as internal: it almost certainly is, and hiding it from the user would be
 * worse than mislabelling it.
 */
export function isInternal(href: string, pageUrl: string): boolean {
  try {
    return new URL(href).origin === new URL(pageUrl).origin
  } catch {
    return true
  }
}

/** A compact, readable label for a link: path for internal, host+path for external. */
export function displayHref(href: string, pageUrl: string): string {
  try {
    const url = new URL(href)
    const path = `${url.pathname}${url.search}`
    if (url.origin === new URL(pageUrl).origin) {
      return path || '/'
    }
    return `${url.host}${path}`
  } catch {
    return href
  }
}
