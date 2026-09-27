import http from 'node:http'

/**
 * A tiny website on localhost, so the crawler can be exercised end to end
 * without touching the network.
 */
export interface TestSite {
  origin: string
  /** Requests seen so far, in order. */
  hits: string[]
  close: () => Promise<void>
}

export interface TestSiteOptions {
  /** Serve /robots.txt + /sitemap.xml. */
  sitemap?: boolean
  /** Paths robots.txt disallows. */
  disallow?: string[]
  /** Pages the site links to from the homepage. */
  pages?: string[]
  /** Extra pages listed in the sitemap (the crawler prefers the sitemap when it has enough entries). */
  sitemapPages?: string[]
  /** Path that serves a page whose text sits inside a collapsed accordion. */
  accordionPage?: string
}

/**
 * A long FAQ inside a closed `<details>`.
 *
 * A browser reports this text as hidden because the element is not expanded, so
 * it used to be missing from the word count entirely. Long enough that it also
 * pushes the page's total over the "mostly hidden" threshold.
 */
const HIDDEN_FAQ = `<details><summary>Frequently asked questions</summary>
${Array.from(
  { length: 8 },
  (_, index) =>
    `<p>Question ${index + 1}: can I change the delivery address after the parcel has already been dispatched from the warehouse to my home?</p>`
).join('\n')}
</details>`

function doc(title: string, description: string, links: string[] = [], extraBody = ''): string {
  return `<!doctype html><html><head><title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="/${title.toLowerCase().replace(/\s+/g, '-')}">
</head><body><main><h1>${title}</h1>
${links.map((href) => `<a href="${href}">${href}</a>`).join('\n')}
<p>${'lorem ipsum dolor sit amet '.repeat(40)}</p>
${extraBody}</main>
</body></html>`
}

export async function startSite(options: TestSiteOptions = {}): Promise<TestSite> {
  const {
    sitemap = true,
    disallow = [],
    pages = ['/a', '/b', '/missing', '/private/secret'],
    sitemapPages = ['/', '/a', '/b', '/missing', '/c', '/d'],
    accordionPage,
  } = options
  const hits: string[] = []

  const server = http.createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://127.0.0.1')
    hits.push(pathname)

    const send = (status: number, body: string, type = 'text/html; charset=utf-8'): void => {
      res.writeHead(status, { 'content-type': type })
      res.end(body)
    }
    const host = req.headers.host ?? '127.0.0.1'

    if (sitemap && pathname === '/robots.txt') {
      const rules = ['User-agent: *', ...disallow.map((path) => `Disallow: ${path}`)]
      if (sitemap) rules.push(`Sitemap: http://${host}/sitemap.xml`)
      return send(200, `${rules.join('\n')}\n`, 'text/plain')
    }

    if (sitemap && pathname === '/sitemap.xml') {
      const locs = sitemapPages
        .map((path) => `  <url><loc>http://${host}${path}</loc></url>`)
        .join('\n')
      return send(
        200,
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs}\n</urlset>`,
        'application/xml'
      )
    }

    if (pathname === '/missing') {
      return send(404, doc('Missing', 'This page is gone'))
    }
    if (pathname === '/private/secret') {
      return send(200, doc('Secret', 'Hidden page'))
    }
    if (pathname === '/') {
      return send(200, doc('Home', 'The home page', pages))
    }
    if (pathname === '/a') return send(200, doc('Page A', 'Page A description', ['/b', '/a?utm_source=x']))
    if (pathname === '/b') return send(200, doc('Page B', 'Page B description'))
    if (pathname === '/robots-not-here') return send(200, doc('No sitemap', 'Crawled page', ['/a']))
    if (accordionPage && pathname === accordionPage) {
      return send(200, doc('FAQ page', 'Everything is in an accordion', [], HIDDEN_FAQ))
    }

    // Any other path is a simple generated page, so tests can queue as many as
    // they like without special-casing each one.
    const name = pathname.slice(1) || 'home'
    return send(200, doc(`Page ${name}`, `Description for ${name}`, ['/']))
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return {
    origin: `http://127.0.0.1:${port}`,
    hits,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  }
}
