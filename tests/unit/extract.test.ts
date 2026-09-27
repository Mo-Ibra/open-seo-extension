import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'

import { extractFromDocument } from '../../lib/extract'

/** Parses HTML the way the crawler does: always a complete document. */
function load(html: string): Document {
  const complete = /<html[\s>]/i.test(html)
    ? html
    : `<!doctype html><html><head></head><body>${html}</body></html>`
  return parseHTML(complete).document as unknown as Document
}

const BASE = 'https://example.com/dir/page.html'

describe('extractFromDocument', () => {
  it('reads the basics', () => {
    const page = extractFromDocument(
      load(`<!doctype html><html><head>
        <title>  My Page  </title>
        <meta name="description" content="A description">
        <link rel="canonical" href="/canonical-path">
        <meta name="robots" content="noindex, nofollow">
      </head><body><h1>Heading one</h1></body></html>`),
      BASE
    )

    expect(page.title).toBe('My Page')
    expect(page.description).toBe('A description')
    expect(page.canonical).toBe('https://example.com/canonical-path')
    expect(page.robotsMeta).toEqual(['noindex, nofollow'])
    expect(page.url).toBe(BASE)
    expect(page.headings).toEqual([{ level: 1, text: 'Heading one' }])
  })

  it('resolves relative links against the base url', () => {
    const page = extractFromDocument(
      load(`<body>
        <a href="/absolute">absolute</a>
        <a href="sibling">sibling</a>
        <a href="//cdn.example.net/lib">cdn</a>
        <a href="/x" rel="nofollow" target="_blank">flags</a>
      </body>`),
      BASE
    )

    expect(page.links.map((link) => link.href)).toEqual([
      'https://example.com/absolute',
      'https://example.com/dir/sibling',
      'https://cdn.example.net/lib',
      'https://example.com/x',
    ])
    expect(page.links[3]).toMatchObject({ rel: 'nofollow', target: '_blank', text: 'flags' })
  })

  it('falls back to aria-label, title and image alt for anchor text', () => {
    const page = extractFromDocument(
      load(`<body>
        <a href="/a" aria-label="Label text"></a>
        <a href="/b" title="Title text"></a>
        <a href="/c"><img src="x.png" alt="Alt text"></a>
        <a href="/d"></a>
      </body>`),
      BASE
    )

    expect(page.links.map((link) => link.text)).toEqual(['Label text', 'Title text', 'Alt text', ''])
  })

  it('collects open graph and twitter tags', () => {
    const page = extractFromDocument(
      load(`<head>
        <meta property="og:title" content="OG title">
        <meta property="og:image" content="https://a.com/i.png">
        <meta name="twitter:card" content="summary">
      </head>`),
      BASE
    )

    expect(page.social.openGraph).toEqual({ title: 'OG title', image: 'https://a.com/i.png' })
    expect(page.social.twitter).toEqual({ card: 'summary' })
  })

  it('keeps a missing canonical as null', () => {
    expect(extractFromDocument(load('<body></body>'), BASE).canonical).toBeNull()
  })
})

describe('word count', () => {
  it('counts visible words only', () => {
    const page = extractFromDocument(
      load(`<body>
        <p>Hello,   world!</p>
        <div hidden>hidden words</div>
        <div style="display:none">style hidden</div>
        <script>var x = 'script words'</script>
        <style>.a{content:'style words'}</style>
        <noscript>noscript words</noscript>
        <p>don't stop</p>
        <span>3 apples — 2 oranges</span>
      </body>`),
      BASE
    )

    // Hello, / world / don't / stop / 3 / apples / 2 / oranges = 8
    expect(page.wordCount).toBe(8)
  })

  it('counts text in nested elements exactly once', () => {
    const page = extractFromDocument(
      load('<body><div><p><span>one two three</span></p></div></body>'),
      BASE
    )
    expect(page.wordCount).toBe(3)
  })

  it('is zero for an empty document', () => {
    expect(extractFromDocument(load('<body></body>'), BASE).wordCount).toBe(0)
  })
})
