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

  return {
    url: location.href,
    title: (document.title || '').trim(),
    description: readMeta('description'),
    canonical,
  }
}
