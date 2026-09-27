import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { discoverSite } from '../../lib/crawl/discover'
import { buildReport } from '../../lib/crawl/report'
import { loadRobots } from '../../lib/crawl/robots'
import { scanUrls } from '../../lib/crawl/scan'
import { startSite, type TestSite } from '../helpers/test-site'

let site: TestSite

beforeEach(async () => {
  site = await startSite({ disallow: ['/private'] })
})

afterEach(async () => {
  await site.close()
})

const paths = (urls: string[]): string[] => urls.map((url) => new URL(url).pathname)

describe('crawl pipeline', () => {
  it('discovers a sitemap site without fetching any page', async () => {
    const discovery = await discoverSite({ seedUrl: `${site.origin}/`, maxUrls: 50 })

    expect(discovery.source).toBe('sitemap')
    expect(discovery.fetched).toBe(0)
    expect(paths(discovery.urls.map((entry) => entry.url))).toEqual(
      expect.arrayContaining(['/', '/a', '/b', '/missing'])
    )
    expect(discovery.urls.every((entry) => entry.from === 'sitemap')).toBe(true)
  })

  it('falls back to crawling internal links when there is no sitemap', async () => {
    const noSitemap = await startSite({ sitemap: false, pages: ['/a', '/b'] })
    try {
      const discovery = await discoverSite({ seedUrl: `${noSitemap.origin}/`, maxUrls: 20 })

      expect(discovery.source).toBe('crawl')
      expect(discovery.fetched).toBeGreaterThan(0)
      expect(paths(discovery.urls.map((entry) => entry.url))).toEqual(
        expect.arrayContaining(['/', '/a', '/b'])
      )
      // Only same-origin html pages survive.
      expect(discovery.urls.every((entry) => new URL(entry.url).origin === noSitemap.origin)).toBe(true)
    } finally {
      await noSitemap.close()
    }
  })

  it('never offers urls that robots.txt disallows', async () => {
    const discovery = await discoverSite({ seedUrl: `${site.origin}/`, maxUrls: 50 })
    expect(paths(discovery.urls.map((entry) => entry.url))).not.toContain('/private/secret')
  })

  it('scans the discovered urls and produces a report', async () => {
    const discovery = await discoverSite({ seedUrl: `${site.origin}/`, maxUrls: 50 })
    const robots = await loadRobots(site.origin)

    const reports = await scanUrls({
      urls: discovery.urls.map((entry) => entry.url),
      robotsTxt: robots.text,
      robotsChecked: robots.checked,
      robotsAllowed: robots.isAllowed,
      concurrency: 4,
      signal: new AbortController().signal,
      onPage: () => {},
      onProgress: () => {},
    })

    expect(reports).toHaveLength(discovery.urls.length)

    const broken = reports.find((report) => report.url.endsWith('/missing'))
    expect(broken?.status).toBe(404)
    expect(broken?.ok).toBe(false)

    const home = reports.find((report) => report.url === `${site.origin}/`)
    expect(home?.ok).toBe(true)
    expect(home?.wordCount).toBeGreaterThan(100)
    expect(home?.findings.map((finding) => finding.id)).toContain('links-summary')
    expect(home?.findings.every((finding) => finding.items === undefined)).toBe(true)

    const report = buildReport(reports)
    expect(report.totalPages).toBe(reports.length)
    expect(report.okPages).toBe(reports.length - 1)
    expect(report.issues.some((issue) => issue.id === 'http-error')).toBe(true)
    // The report can only be built from pages that were actually fetched.
    expect(report.pages.every((page) => page.url.startsWith(site.origin))).toBe(true)
  })

  it('turns a network failure into a finding instead of throwing', async () => {
    const reports = await scanUrls({
      urls: [`${site.origin}/`, 'http://127.0.0.1:1/unreachable'],
      robotsTxt: null,
      robotsChecked: false,
      robotsAllowed: () => true,
      signal: new AbortController().signal,
      onPage: () => {},
      onProgress: () => {},
    })

    const failed = reports.find((report) => report.url.includes('unreachable'))
    expect(failed?.ok).toBe(false)
    expect(failed?.status).toBeNull()
    expect(failed?.findings[0].id).toMatch(/^http-(network|timeout)$/)
  })

  it('skips urls robots.txt disallows and counts them', async () => {
    const skipped: string[] = []
    const robots = await loadRobots(site.origin)

    const reports = await scanUrls({
      urls: [`${site.origin}/`, `${site.origin}/private/secret`],
      robotsTxt: robots.text,
      robotsChecked: robots.checked,
      robotsAllowed: robots.isAllowed,
      signal: new AbortController().signal,
      onPage: () => {},
      onSkip: (url) => skipped.push(url),
      onProgress: () => {},
    })

    expect(reports).toHaveLength(1)
    expect(skipped).toEqual([`${site.origin}/private/secret`])
  })

  it('stops early when the scan is aborted', async () => {
    const controller = new AbortController()
    const urls = Array.from({ length: 30 }, (_, index) => `${site.origin}/page-${index}`)
    let done = 0

    const reports = await scanUrls({
      urls,
      robotsTxt: null,
      robotsChecked: false,
      robotsAllowed: () => true,
      concurrency: 2,
      signal: controller.signal,
      onPage: () => {
        done++
        if (done === 2) controller.abort()
      },
      onProgress: () => {},
    })

    expect(reports.length).toBeLessThan(urls.length)
  })
})

/**
 * The bug this covers: word count depended on render state, so a browser and
 * the crawler returned different numbers for the same URL — a browser hid a
 * closed `<details>` and a stepper's inactive panels, while `linkedom` (no
 * layout engine) counted them. Counting from markup alone makes the two agree,
 * and the hidden share is now a finding instead of a silently smaller total.
 */
describe('hidden content in a site scan', () => {
  let faq: TestSite

  beforeEach(async () => {
    faq = await startSite({ disallow: ['/private'], accordionPage: '/faq' })
  })

  afterEach(async () => {
    await faq.close()
  })

  it('counts accordion text and reports the hidden share', async () => {
    const [result] = await scanUrls({
      urls: [`${faq.origin}/faq`],
      robotsTxt: null,
      robotsChecked: false,
      robotsAllowed: () => true,
      concurrency: 1,
      signal: new AbortController().signal,
      onPage: () => {},
      onProgress: () => {},
    })

    expect(result.ok).toBe(true)
    // The FAQ alone is well over the threshold, so the page cannot be "thin".
    expect(result.wordCount).toBeGreaterThan(300)
    expect(result.findings.map((finding) => finding.id)).toContain('word-count-hidden')
  })
})
