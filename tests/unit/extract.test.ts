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
  it('counts hidden text, and excludes only non-content elements', () => {
    const page = extractFromDocument(
      load(`<body>
        <p>Hello,   world!</p>
        <div hidden>hidden words</div>
        <div style="display:none">style hidden</div>
        <div aria-hidden="true">decorative words</div>
        <script>var x = 'script words'</script>
        <style>.a{content:'style words'}</style>
        <noscript>noscript words</noscript>
        <p>don't stop</p>
        <span>3 apples — 2 oranges</span>
      </body>`),
      BASE
    )

    // 8 visible + 2 hidden + 2 style-hidden + 2 aria-hidden. Script, style and
    // noscript are the only things dropped: they are not page content, whereas
    // hidden text still is. `hiddenWordCount` labels the 6 hidden words without
    // removing them from the total.
    expect(page.wordCount).toBe(14)
    expect(page.hiddenWordCount).toBe(6)
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

/**
 * The regression this file exists for.
 *
 * Word count used to be read off the layout engine via
 * `checkVisibility({ checkVisibilityCSS: true })`, then later off inline
 * `display:none`. Both made the number depend on what happened to be expanded,
 * hidden or on screen when the popup was opened. Every case below is content a
 * search engine indexes but a browser reports as hidden, so the count was
 * silently too low and pages came out as "thin content".
 */
describe('word count: collapsed and CSS-hidden content is still content', () => {
  const QUESTIONS = [
    'What is the refund policy for annual plans bought through this page?',
    'How long does delivery take once the order has been placed and paid for?',
    'Can the shipping address still be changed after the parcel has shipped?',
  ]
  const ANSWERS = QUESTIONS.map((question) => `<p>${question}</p>`).join('')

  const count = (html: string) => extractFromDocument(load(html), BASE).wordCount

  it('counts a collapsed <details> FAQ', () => {
    const page = extractFromDocument(
      load(`<body><main><h1>Support</h1>
        <details><summary>FAQ</summary>${ANSWERS}</details>
      </main></body>`),
      BASE
    )
    // 12 + 14 + 12 = 38 words of answers, plus the "Support" heading and the
    // "FAQ" summary line.
    expect(page.wordCount).toBe(40)
    // The summary stays visible while the details is closed, so only the
    // answers count as collapsed.
    expect(page.hiddenWordCount).toBe(38)
  })

  it('does not mark an expanded <details> as collapsed', () => {
    const page = extractFromDocument(
      load(`<body><main><h1>Support</h1>
        <details open><summary>FAQ</summary>${ANSWERS}</details>
      </main></body>`),
      BASE
    )
    expect(page.hiddenWordCount).toBe(0)
  })

  it('counts a Bootstrap-style .collapse accordion hidden by CSS', () => {
    // `.collapse { display: none }` lives in the stylesheet, not the markup, so
    // a browser reports this as hidden and `linkedom` never could.
    // 38 words of answers + "Support".
    expect(count(`<body><main><h1>Support</h1><div class="collapse">${ANSWERS}</div></main></body>`)).toBe(39)
  })

  it('counts inactive tab panels', () => {
    expect(count(`<body><main><h1>Support</h1><div role="tabpanel" class="tab-pane">${ANSWERS}</div></main></body>`)).toBe(39)
  })

  it('counts content-visibility:auto sections', () => {
    const html = `<body><main><h1>Support</h1><div style="content-visibility:auto">${ANSWERS}</div></main></body>`
    expect(count(html)).toBe(39)
  })

  it('ignores checkVisibility, so the count cannot depend on render state', () => {
    const doc = load(`<body><main><h1>Support</h1><div class="collapse">${ANSWERS}</div></main></body>`)
    // Simulate a browser: if the extractor consulted the layout engine, every
    // element here would report itself as hidden and the count would collapse
    // to the heading alone.
    for (const element of Array.from(doc.querySelectorAll('*'))) {
      ;(element as unknown as { checkVisibility: () => boolean }).checkVisibility = () => false
    }
    expect(extractFromDocument(doc, BASE).wordCount).toBe(39)
  })
})

/**
 * The regression that motivated dropping the inline `display:none` exclusion.
 *
 * hackweb.dev slices its lesson article into steps at every `<h2>` and hides
 * every step but the current one with `style="display: none"`. Excluding inline
 * hidden text therefore reported only the step the reader was on — 59 words
 * instead of 428 — and made the number depend on which step was showing.
 */
describe('word count: stepper widgets', () => {
  const STEP_ONE = '<p>The first step explains one idea in a couple of sentences.</p>'
  const STEP_TWO = '<p>The second step goes into much more detail about the subject at hand.</p>'
  const STEP_THREE = '<p>The third step wraps things up and points at what comes next.</p>'

  /** The markup a stepper produces: panels, all but one inline-hidden. */
  const stepper = (active: number) => `<body><main>
      <h1>Tutorial</h1>
      <div id="content">
        ${[STEP_ONE, STEP_TWO, STEP_THREE]
          .map(
            (html, index) =>
              `<div class="step"${index === active ? '' : ' style="display: none"'}>${html}</div>`
          )
          .join('')}
      </div>
    </main></body>`

  it('returns the same total whichever step is showing', () => {
    const totals = [0, 1, 2].map((active) => extractFromDocument(load(stepper(active)), BASE).wordCount)
    // 11 + 13 + 12 words of steps, plus the "Tutorial" heading.
    expect(totals).toEqual([37, 37, 37])
  })

  it('reports the hidden steps separately', () => {
    const first = extractFromDocument(load(stepper(0)), BASE)
    // The two inactive steps: 13 + 12.
    expect(first.hiddenWordCount).toBe(25)

    const last = extractFromDocument(load(stepper(2)), BASE)
    // 11 + 13.
    expect(last.hiddenWordCount).toBe(24)
  })

  it('counts a hidden panel once, not twice, when it is also aria-hidden', () => {
    const page = extractFromDocument(
      load('<body><main><h1>Guide</h1><div hidden aria-hidden="true">Some words live in here</div></main></body>'),
      BASE
    )
    // Guide / Some / words / live / in / here = 6, of which 5 are hidden.
    expect(page.wordCount).toBe(6)
    expect(page.hiddenWordCount).toBe(5)
  })

  it('clears the hidden flag for a <summary>, which stays visible when closed', () => {
    const page = extractFromDocument(
      load('<body><main><details><summary>Show the answer</summary><p>A long answer</p></details></main></body>'),
      BASE
    )
    // Show / the / answer / A / long / answer = 6
    expect(page.wordCount).toBe(6)
    // A / long / answer = 3; the summary line is still on screen.
    expect(page.hiddenWordCount).toBe(3)
  })
})

describe('word count: content scoping', () => {
  const NAV = '<nav><a href="/a">Home</a><a href="/b">Pricing</a><a href="/c">Docs</a></nav>'
  const FOOTER = '<footer><p>Copyright 2026 Example Limited All Rights Reserved</p></footer>'

  it('measures only <main> when the page has one', () => {
    const page = extractFromDocument(
      load(`<body>${NAV}<main><h1>Real content here</h1><p>And a paragraph</p></main>${FOOTER}</body>`),
      BASE
    )
    // Real / content / here / And / a / paragraph = 6
    expect(page.wordCount).toBe(6)
  })

  it('measures only [role=main] when there is no <main>', () => {
    const page = extractFromDocument(
      load(`<body>${NAV}<div role="main"><p>Body of the page</p></div>${FOOTER}</body>`),
      BASE
    )
    expect(page.wordCount).toBe(4)
  })

  it('measures only <article> when there is no other landmark', () => {
    const page = extractFromDocument(
      load(`<body>${NAV}<article><p>Blog post body</p></article>${FOOTER}</body>`),
      BASE
    )
    expect(page.wordCount).toBe(3)
  })

  it('keeps the chrome out of the way in the fallback path', () => {
    const page = extractFromDocument(
      load(`<body><header><h1>Site name</h1></header>${NAV}<p>Orphaned content</p>${FOOTER}</body>`),
      BASE
    )
    // Orphaned / content = 2; header, nav and footer are dropped.
    expect(page.wordCount).toBe(2)
  })

  it('keeps an article header, which holds the headline and standfirst', () => {
    const page = extractFromDocument(
      load(`<body>${NAV}<article><header><h1>A headline</h1><p>And a standfirst</p></header></article>${FOOTER}</body>`),
      BASE
    )
    // A / headline / And / a / standfirst = 5
    expect(page.wordCount).toBe(5)
  })
})
