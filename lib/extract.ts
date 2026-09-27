import type { PageData } from './types'

/** The two numbers `countWords` produces. Type-only, so it erases at compile. */
interface WordCount {
  /** All indexable words, including every word that is currently hidden. */
  total: number
  /**
   * Of those, the words a reader cannot see until they act: inside a closed
   * `<details>`, a `hidden`/`aria-hidden` subtree, or an inline
   * `display:none` panel. A subset of `total`.
   */
  hidden: number
}

/** One entry of the word-counting traversal, with its inherited flags. */
interface Step {
  node: ChildNode
  /** Inside something the markup itself hides. */
  hidden: boolean
  /** Inside a `<details>` the reader has not expanded. */
  collapsed: boolean
}

/**
 * Reads the SEO-relevant parts of a document.
 *
 * This function is injected with `browser.scripting.executeScript`, so it must
 * be **self-contained**: no references to module scope (imported *types* are
 * erased at compile time and are fine, and so are the hoisted function
 * declarations nested inside it, but nothing declared at module level). The
 * optional parameters default to the page's own globals, so calling it with no
 * arguments behaves exactly like the old live-tab extractor; the crawler
 * passes a parsed document plus an explicit base URL instead.
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
    openGraph: collectMeta('meta[property^="og:" i]', 'property', 'og-'),
    twitter: collectMeta('meta[name^="twitter:" i]', 'name', 'twitter-'),
  }

  /**
   * Tags whose text is never page content, whatever the CSS says.
   *
   * `SVG` is absent on purpose: its `<title>`/`<desc>` are not prose. `MAP` and
   * `AREA` only ever hold `alt` text. `NOSCRIPT` is skipped because its
   * contents usually mirror the scripted DOM, so counting both would double up.
   */
  const NON_CONTENT_TAGS = [
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED',
    'CANVAS', 'AUDIO', 'VIDEO', 'MAP', 'AREA', 'SVG',
  ]

  /**
   * Page chrome, dropped only when the document has no main-content landmark.
   *
   * These are skipped as whole subtrees, which is what keeps a cookie banner's
   * "Accept all cookies" out of the count. They are deliberately *not* skipped
   * when a `<main>`/`<article>` exists, because there a `<header>` inside the
   * article is usually the headline and standfirst, which are content.
   */
  const CHROME_TAGS = ['NAV', 'HEADER', 'FOOTER', 'ASIDE']

  /**
   * Tags that mark the start of the page's actual content, in priority order.
   *
   * A content page has one of these; a landing page, an error page or an older
   * site may have none, which is why this is a search and not a requirement.
   */
  const CONTENT_ROOT_SELECTORS = ['main', '[role="main"]', 'article']

  /**
   * Whether an element's own markup hides it from the reader.
   *
   * Consulted **only to label** text as not-currently-visible, never to exclude
   * it from the count. These three signals are the ones available in a parsed
   * document with no stylesheet: the `hidden` attribute, `aria-hidden="true"`,
   * and an inline `display:none`/`visibility:hidden`. Class names and computed
   * styles are ignored on purpose — `.hidden` could mean anything, and asking a
   * browser for a computed style would reintroduce the render-state dependency
   * this function exists to avoid.
   */
  function isSelfHidden(element: Element): boolean {
    if (element.hasAttribute('hidden')) return true
    if (element.getAttribute('aria-hidden') === 'true') return true
    const style = element.getAttribute('style') || ''
    return /display\s*:\s*none/i.test(style) || /visibility\s*:\s*hidden/i.test(style)
  }

  /** True for a `<details>` element whose content the user has not expanded. */
  function isCollapsedDetails(element: Element): boolean {
    return element.tagName === 'DETAILS' && !element.hasAttribute('open')
  }

  /**
   * Counts the indexable words in a document.
   *
   * Two rules, and the first one is the important one:
   *
   * **1. Visibility never affects the total.** Text is counted whether or not it
   * is on screen right now. This was learned the hard way, twice:
   *
   *   - An early version asked `checkVisibility({ checkVisibilityCSS: true })`
   *     per text node, so a closed `<details>` FAQ, a Bootstrap `.collapse`
   *     accordion and any `content-visibility: auto` section were all dropped.
   *   - The next version dropped that call but kept excluding inline
   *     `display:none`, which is how stepper widgets hide their inactive steps.
   *     On hackweb.dev, which slices its article into six steps at every `<h2>`
   *     and hides five of them with `style="display:none"`, the extension
   *     reported 59 words instead of 428 — the one step the reader happened to
   *     be on. Worse, the browser and the crawler disagreed about the same URL,
   *     so a page could pass on one tab and fail on the other.
   *
   * Neither is content. Google indexes `display:none` text, and a stepper's
   * hidden panels are exactly the words the page is indexed for. Anything that
   * makes the number depend on render state is a bug, not a feature.
   *
   * **2. Non-content elements are skipped**, as whole subtrees: `script`,
   * `style`, `noscript`, `template`, embedded media and `svg`. `template`
   * matters most — JavaScript clones it into the live DOM, and counting both
   * would double up.
   *
   * What *is* measured is scoped to the content landmark (`main` /
   * `[role=main]` / `article`) so nav, sidebars and cookie banners stay out
   * without needing a list of site-specific selectors.
   *
   * Because the total ignores visibility, hidden text cannot silently vanish
   * from the audit. It is counted in the total *and* reported separately as
   * `hidden`, so the UI can tell the user "321 of these 428 words are behind a
   * click" rather than quietly returning a number that is wrong.
   */
  function countWords(): WordCount {
    // A partial document has no `body`; the root element is the fallback.
    const root = doc.body || doc.documentElement
    if (!root) return { total: 0, hidden: 0 }

    // Prefer the content landmark. Without one, measure the body and drop the
    // chrome tags instead.
    let contentRoot: Element | null = null
    for (const selector of CONTENT_ROOT_SELECTORS) {
      const found = doc.querySelector(selector)
      if (found) {
        contentRoot = found
        break
      }
    }
    if (!contentRoot) contentRoot = root
    const dropChrome = contentRoot === root

    const WORDS = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu
    const TEXT_NODE = 3
    const ELEMENT_NODE = 1

    const counts: WordCount = { total: 0, hidden: 0 }
    // Two independent flags, because a closed <details> and a display:none
    // panel are different things and only the first is cleared by <summary>.
    const stack: Step[] = [{ node: contentRoot as ChildNode, hidden: false, collapsed: false }]

    while (stack.length > 0) {
      const { node, hidden, collapsed } = stack.pop()!
      const children = Array.from(node.childNodes)
      for (const child of children) {
        if (child.nodeType === TEXT_NODE) {
          const words = (child.textContent || '').match(WORDS)
          if (!words) continue
          counts.total += words.length
          // A subset of the total, never an addition: a word inside both a
          // hidden panel and a closed <details> is only counted once.
          if (hidden || collapsed) counts.hidden += words.length
        } else if (child.nodeType === ELEMENT_NODE) {
          const element = child as Element
          const tag = element.tagName
          // Pruned as a whole subtree, so one check covers every descendant.
          if (!tag || NON_CONTENT_TAGS.includes(tag)) continue
          if (dropChrome && CHROME_TAGS.includes(tag)) continue

          // A closed <details> hides everything below it *except* its
          // <summary> line, which is what the reader clicks, so <summary>
          // clears that flag rather than inheriting it.
          const insideCollapsed = tag === 'SUMMARY' ? false : collapsed || isCollapsedDetails(element)
          stack.push({
            node: child as ChildNode,
            hidden: hidden || isSelfHidden(element),
            collapsed: insideCollapsed,
          })
        }
      }
    }

    return counts
  }

  const text = countWords()

  return {
    url: baseUrl,
    title: (doc.title || '').trim(),
    description: readMeta('description'),
    canonical,
    robotsMeta,
    social,
    headings,
    links,
    wordCount: text.total,
    hiddenWordCount: text.hidden,
  }
}
