import type { PageData } from './types'

/**
 * Reads the SEO-relevant parts of a document.
 *
 * This function is injected with `browser.scripting.executeScript`, so it must
 * be **self-contained**: no references to module scope (imported *types* are
 * erased at compile time and are fine). The optional parameters default to the
 * page's own globals, so calling it with no arguments behaves exactly like the
 * old live-tab extractor; the crawler passes a parsed document plus an explicit
 * base URL instead.
 */
export function extractFromDocument(
  doc: Document = document,
  baseUrl: string = location.href
): PageData {
  const resolve = (href: string): string => {
    try {
      return new URL(href, baseUrl).href
    } catch {
      return href
    }
  }

  const readMeta = (name: string): string | null => {
    const element =
      doc.querySelector(`meta[name="${name}" i]`) ||
      doc.querySelector(`meta[property="og:${name}" i]`) ||
      doc.querySelector(`meta[property="${name}" i]`)
    const content = element?.getAttribute('content')?.trim()
    return content ? content : null
  }

  const canonicalHref = doc
    .querySelector('link[rel="canonical" i]')
    ?.getAttribute('href')
    ?.trim()
  const canonical = canonicalHref ? resolve(canonicalHref) : null

  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(
    (element) => ({
      level: Number(element.tagName.charAt(1)),
      text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    })
  )

  const links = Array.from(doc.querySelectorAll('a[href]')).map((anchor) => {
    const href = anchor.getAttribute('href') || ''
    const imageAlt = anchor.querySelector('img[alt]')?.getAttribute('alt') || ''
    const text =
      (anchor.textContent || '').replace(/\s+/g, ' ').trim() ||
      (anchor.getAttribute('aria-label') || '').trim() ||
      (anchor.getAttribute('title') || '').trim() ||
      imageAlt.trim()
    return {
      href: resolve(href),
      rel: anchor.getAttribute('rel') || '',
      target: anchor.getAttribute('target') || '',
      text: text.slice(0, 100),
    }
  })

  const robotsMeta = Array.from(
    doc.querySelectorAll('meta[name="robots" i], meta[name="googlebot" i]')
  )
    .map((element) => (element.getAttribute('content') || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const collectMeta = (
    selector: string,
    attribute: string,
    prefix: string
  ): Record<string, string> => {
    const result: Record<string, string> = {}
    doc.querySelectorAll(selector).forEach((element) => {
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

  const wordCount = countWords()

  /** True when the element takes part in rendering (or, for parsed markup, is not statically hidden). */
  function isRendered(element: Element): boolean {
    const el = element as Element & {
      checkVisibility?: (options?: Record<string, boolean>) => boolean
      getClientRects?: () => unknown
    }
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true })
    }
    if (typeof el.getClientRects === 'function') {
      return el.getClientRects().length > 0
    }
    // No layout engine (fetched HTML parsed by the crawler): use static hints.
    if (element.hasAttribute('hidden')) return false
    const style = element.getAttribute('style') || ''
    return !/display\s*:\s*none/i.test(style) && !/visibility\s*:\s*hidden/i.test(style)
  }

  /** Counts words in rendered text, skipping scripts/styles and hidden nodes. */
  function countWords(): number {
    if (!doc.body) return 0

    const SKIP_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']
    const WORDS = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu
    const TEXT_NODE = 3
    const ELEMENT_NODE = 1

    let total = 0
    const stack: ChildNode[] = [doc.body]

    while (stack.length > 0) {
      const node = stack.pop()!
      const children = Array.from(node.childNodes)
      for (const child of children) {
        if (child.nodeType === TEXT_NODE) {
          const parent = child.parentElement
          if (!parent || SKIP_TAGS.includes(parent.tagName)) continue
          if (!isRendered(parent)) continue
          const words = (child.textContent || '').match(WORDS)
          if (words) total += words.length
        } else if (child.nodeType === ELEMENT_NODE) {
          const tag = (child as Element).tagName
          if (!tag || SKIP_TAGS.includes(tag)) continue
          stack.push(child as ChildNode)
        }
      }
    }

    return total
  }

  return {
    url: baseUrl,
    title: (doc.title || '').trim(),
    description: readMeta('description'),
    canonical,
    robotsMeta,
    social,
    headings,
    links,
    wordCount,
  }
}
