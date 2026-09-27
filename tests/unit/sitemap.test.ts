import { describe, expect, it, vi } from 'vitest'

import { collectSitemapPages, parseSitemap } from '../../lib/crawl/sitemap'

const urlset = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://a.com/one</loc><lastmod>2024-01-01</lastmod></url>
  <url><loc><![CDATA[https://a.com/two]]></loc></url>
  <url><loc>https://a.com/three?a=1&amp;b=2</loc></url>
</urlset>`

const sitemapIndex = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://a.com/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://a.com/sitemap-2.xml</loc></sitemap>
</sitemapindex>`

describe('parseSitemap', () => {
  it('reads a urlset, including CDATA and entities', () => {
    const { pageUrls, sitemapUrls } = parseSitemap(urlset)
    expect(pageUrls).toEqual([
      'https://a.com/one',
      'https://a.com/two',
      'https://a.com/three?a=1&b=2',
    ])
    expect(sitemapUrls).toEqual([])
  })

  it('reads a sitemap index', () => {
    const { pageUrls, sitemapUrls } = parseSitemap(sitemapIndex)
    expect(pageUrls).toEqual([])
    expect(sitemapUrls).toEqual(['https://a.com/sitemap-1.xml', 'https://a.com/sitemap-2.xml'])
  })

  it('survives junk input', () => {
    expect(parseSitemap('')).toEqual({ pageUrls: [], sitemapUrls: [] })
    expect(parseSitemap('not xml at all')).toEqual({ pageUrls: [], sitemapUrls: [] })
  })
})

describe('collectSitemapPages', () => {
  it('follows nested indexes and de-duplicates urls', async () => {
    const fetchText = vi.fn(async (url: string) => {
      if (url === 'https://a.com/root.xml') return sitemapIndex
      if (url === 'https://a.com/sitemap-1.xml') return urlset
      if (url === 'https://a.com/sitemap-2.xml') return urlset // same urls on purpose
      return null
    })

    const result = await collectSitemapPages(['https://a.com/root.xml'], { fetchText })

    expect(fetchText).toHaveBeenCalledTimes(3)
    expect(result.sitemapsFetched).toBe(3)
    expect(result.urls).toEqual(['https://a.com/one', 'https://a.com/two', 'https://a.com/three?a=1&b=2'])
    expect(result.errors).toEqual([])
  })

  it('records unreadable sitemaps instead of throwing', async () => {
    const fetchText = vi.fn(async (url: string) => (url.endsWith('bad.xml') ? null : urlset))
    const result = await collectSitemapPages(['https://a.com/bad.xml'], { fetchText })
    expect(result.urls).toEqual([])
    expect(result.errors).toEqual(['https://a.com/bad.xml'])
  })

  it('honours the maxUrls cap', async () => {
    const many = `<?xml version="1.0"?><urlset>${Array.from(
      { length: 50 },
      (_, index) => `<url><loc>https://a.com/${index}</loc></url>`
    ).join('')}</urlset>`

    const result = await collectSitemapPages(['https://a.com/one.xml'], {
      maxUrls: 5,
      fetchText: async () => many,
    })
    expect(result.urls).toHaveLength(5)
  })

  it('reports progress', async () => {
    const onProgress = vi.fn()
    await collectSitemapPages(['https://a.com/one.xml'], {
      fetchText: async () => urlset,
      onProgress,
    })
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ sitemapsFetched: 1, urlsFound: 0, current: 'https://a.com/one.xml' })
    )
  })
})
