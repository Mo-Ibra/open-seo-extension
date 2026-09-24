import type { PageData } from './types'

/**
 * Reads the SEO-relevant parts of the current page.
 *
 * This function is injected with `browser.scripting.executeScript`, so it must
 * be **self-contained**: no imports and no references to the outer module
 * scope, because it gets serialized and executed inside the inspected page.
 */
export function extractPageData(): PageData {
  const readMeta = (name: string): string | null => {
    const element =
      document.querySelector(`meta[name="${name}" i]`) ||
      document.querySelector(`meta[property="og:${name}" i]`) ||
      document.querySelector(`meta[property="${name}" i]`)
    const content = element?.getAttribute('content')?.trim()
    return content ? content : null
  }

  const canonicalElement = document.querySelector('link[rel="canonical" i]')
  const canonicalHref = canonicalElement?.getAttribute('href')?.trim()
  let canonical: string | null = null
  if (canonicalHref) {
    try {
      // Resolve relative canonicals against the page URL.
      canonical = new URL(canonicalHref, location.href).href
    } catch {
      canonical = canonicalHref
    }
  }

  const headings = Array.from(
    document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
  ).map((element) => ({
    level: Number(element.tagName.charAt(1)),
    text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
  }))

  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).map(
    (anchor) => {
      const imageAlt = anchor.querySelector('img[alt]')?.getAttribute('alt') || ''
      const text =
        (anchor.textContent || '').replace(/\s+/g, ' ').trim() ||
        (anchor.getAttribute('aria-label') || '').trim() ||
        (anchor.getAttribute('title') || '').trim() ||
        imageAlt.trim()
      return {
        href: anchor.href,
        rel: anchor.getAttribute('rel') || '',
        target: anchor.getAttribute('target') || '',
        text: text.slice(0, 100),
      }
    }
  )

  const robotsMeta = Array.from(
    document.querySelectorAll('meta[name="robots" i], meta[name="googlebot" i]')
  )
    .map((element) => (element.getAttribute('content') || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const collectMeta = (
    selector: string,
    attribute: string,
    prefix: string
  ): Record<string, string> => {
    const result: Record<string, string> = {}
    document.querySelectorAll(selector).forEach((element) => {
      const key = element.getAttribute(attribute)
      const content = element.getAttribute('content')
      if (!key || !content) return
      result[key.toLowerCase().slice(prefix.length)] = content.trim()
    })
    return result
  }

  const social = {
    openGraph: collectMeta('meta[property^="og:" i]', 'property', 'og:'),
    twitter: collectMeta('meta[name^="twitter:" i]', 'name', 'twitter:'),
  }

  return {
    url: location.href,
    title: (document.title || '').trim(),
    description: readMeta('description'),
    canonical,
    robotsMeta,
    social,
    headings,
    links,
  }
}
