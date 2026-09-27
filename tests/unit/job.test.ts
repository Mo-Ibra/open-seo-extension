import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createJob, type Job, type JobStore } from '../../lib/crawl/job'
import { createIdleState, type SiteScanState } from '../../lib/crawl/types'
import { startSite, type TestSite } from '../helpers/test-site'

/** In-memory store with the same surface as the real one. */
function memoryStore(): JobStore & { data: Map<string, SiteScanState> } {
  const data = new Map<string, SiteScanState>()
  return {
    data,
    loadStateOrIdle: async (origin, seedUrl) => data.get(origin) ?? createIdleState(origin, seedUrl),
    saveState: async (state) => {
      data.set(state.origin, state)
    },
    clearState: async (origin) => {
      data.delete(origin)
    },
    loadLastOrigin: async () => (data.size > 0 ? [...data.keys()].pop()! : null),
  }
}

function setup(overrides: Partial<Parameters<typeof createJob>[0]> = {}) {
  const store = memoryStore()
  const broadcast: SiteScanState[] = []
  const job: Job = createJob({
    store,
    broadcast: (state) => broadcast.push(state),
    // Zero debounce keeps the tests fast and deterministic.
    saveDebounceMs: 0,
    broadcastThrottleMs: 0,
    ...overrides,
  })
  return { job, store, broadcast }
}

let site: TestSite

beforeEach(async () => {
  site = await startSite({ disallow: ['/private'] })
})

afterEach(async () => {
  await site.close()
})

describe('site-audit job', () => {
  it('starts idle and reports an empty state for a new origin', async () => {
    const { job } = setup()
    const state = await job.handle({ type: 'site:getState', origin: site.origin })

    expect(state.status).toBe('idle')
    expect(state.origin).toBe(site.origin)
    expect(state.results).toEqual([])
  })

  it('discovers pages from the sitemap and returns before the work finishes', async () => {
    const { job, broadcast } = setup()
    const returned = await job.handle({ type: 'site:discover', seedUrl: `${site.origin}/` })

    expect(returned.status).toBe('discovering')

    await waitFor(() => job.snapshot().status === 'ready')

    const ready = job.snapshot()
    expect(ready.discovery?.source).toBe('sitemap')
    const paths = ready.discovery!.urls.map((entry) => new URL(entry.url).pathname)
    expect(paths).toContain('/a')
    expect(paths).toContain('/b')
    // robots.txt disallows /private, so it must not be offered for scanning.
    expect(paths).not.toContain('/private/secret')
    expect(broadcast.some((state) => state.status === 'ready')).toBe(true)
  })

  it('scans the queue, stores results and finishes as done', async () => {
    const { job, store } = setup()
    await job.handle({ type: 'site:discover', seedUrl: `${site.origin}/` })
    await waitFor(() => job.snapshot().status === 'ready')

    const urls = job.snapshot().discovery!.urls.map((entry) => entry.url)
    const started = await job.handle({ type: 'site:scan', origin: site.origin, urls })

    expect(started.status).toBe('scanning')
    await waitFor(() => job.snapshot().status === 'done')

    const done = job.snapshot()
    expect(done.results).toHaveLength(urls.length)
    expect(done.scanned).toBe(urls.length)
    expect(done.finishedAt).not.toBeNull()

    const notFound = done.results.find((result) => result.url.endsWith('/missing'))
    expect(notFound?.status).toBe(404)
    expect(notFound?.ok).toBe(false)
    expect(notFound?.findings.map((finding) => finding.id)).toContain('http-error')

    const home = done.results.find((result) => new URL(result.url).pathname === '/')
    expect(home?.status).toBe(200)
    expect(home?.wordCount).toBeGreaterThan(100)
    expect(home?.findings.length).toBeGreaterThan(3)

    // The finished report is persisted for the next popup open.
    await waitFor(() => store.data.get(site.origin)?.status === 'done')
    expect(store.data.get(site.origin)?.results.length).toBe(urls.length)
  })

  it('caps the queue at the configured page limit', async () => {
    const { job } = setup({ limits: { maxPages: 2 } })
    const urls = Array.from({ length: 6 }, (_, index) => `${site.origin}/page-${index}`)

    await job.handle({ type: 'site:scan', origin: site.origin, urls })
    await waitFor(() => job.snapshot().status === 'done')

    expect(job.snapshot().queue).toHaveLength(2)
    expect(job.snapshot().results).toHaveLength(2)
  })

  it('stops a scan and keeps what it already found', async () => {
    const { job } = setup({ limits: { concurrency: 1 } })
    const urls = Array.from({ length: 40 }, (_, index) => `${site.origin}/page-${index}`)

    await job.handle({ type: 'site:scan', origin: site.origin, urls })
    await waitFor(() => job.snapshot().scanned > 0)
    await job.handle({ type: 'site:cancel' })

    // No discovery in this run, so there is nothing to go back to.
    expect(job.snapshot().status).toBe('idle')
    expect(job.snapshot().currentUrls).toEqual([])

    // A second cancel is harmless.
    await expect(job.handle({ type: 'site:cancel' })).resolves.toBeDefined()
  })

  it('returns to the selection step when a discovered scan is cancelled', async () => {
    const { job } = setup({ limits: { concurrency: 1 } })
    await job.handle({ type: 'site:discover', seedUrl: `${site.origin}/` })
    await waitFor(() => job.snapshot().status === 'ready')

    const urls = Array.from({ length: 40 }, (_, index) => `${site.origin}/page-${index}`)
    await job.handle({ type: 'site:scan', origin: site.origin, urls })
    await waitFor(() => job.snapshot().scanned > 0)
    await job.handle({ type: 'site:cancel' })

    expect(job.snapshot().status).toBe('ready')
    expect(job.snapshot().queue).toEqual([])
  })

  it('clears a stored report', async () => {
    const { job, store } = setup()
    await job.handle({ type: 'site:discover', seedUrl: `${site.origin}/` })
    await waitFor(() => job.snapshot().status === 'ready')
    expect(store.data.size).toBe(1)

    const cleared = await job.handle({ type: 'site:clear', origin: site.origin })
    expect(cleared.status).toBe('idle')
    expect(store.data.size).toBe(0)
  })

  describe('resumeIfNeeded', () => {
    it('does nothing when there is no stored scan', async () => {
      const { job, broadcast } = setup()
      await job.resumeIfNeeded()
      expect(broadcast).toHaveLength(0)
    })

    it('finishes a scan whose pages were all already done', async () => {
      const { job, store } = setup()
      const discovery = {
        origin: site.origin,
        seedUrl: `${site.origin}/`,
        source: 'sitemap' as const,
        urls: [],
        robotsTxt: null,
        robotsChecked: true,
        fetched: 0,
        notes: [],
      }
      await store.saveState({
        ...createIdleState(site.origin, `${site.origin}/`),
        status: 'scanning',
        discovery,
        queue: [`${site.origin}/`],
        results: [
          {
            url: `${site.origin}/`,
            status: 200,
            ok: true,
            finalUrl: `${site.origin}/`,
            contentType: 'text/html',
            durationMs: 1,
            title: 'Home',
            wordCount: 10,
            findings: [],
          },
        ],
      })

      await job.resumeIfNeeded()

      expect(store.data.get(site.origin)?.status).toBe('done')
    })

    it('scans only the pages that are still missing', async () => {
      const { job, store } = setup()
      await store.saveState({
        ...createIdleState(site.origin, `${site.origin}/`),
        status: 'scanning',
        queue: ['/a', '/b'].map((path) => `${site.origin}${path}`),
        results: [
          {
            url: `${site.origin}/a`,
            status: 200,
            ok: true,
            finalUrl: `${site.origin}/a`,
            contentType: 'text/html',
            durationMs: 1,
            title: 'Page A',
            wordCount: 10,
            findings: [],
          },
        ],
      })

      await job.resumeIfNeeded()
      await waitFor(() => job.snapshot().status === 'done')

      const done = store.data.get(site.origin)!
      expect(done.queue).toEqual([`${site.origin}/b`])
      expect(done.results.map((result) => result.url)).toEqual([`${site.origin}/b`])
    })
  })
})

async function waitFor(predicate: () => boolean, timeoutMs = 15_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('Timed out waiting for condition')
}
