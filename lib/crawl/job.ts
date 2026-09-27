/**
 * The site-audit state machine: discovery, the scan queue, persistence and
 * progress broadcasts.
 *
 * Deliberately free of extension APIs — storage and messaging arrive as
 * dependencies — so the whole worker can be unit-tested in Node. See
 * `tests/unit/job.test.ts`.
 */

import { discoverSite } from './discover'
import { loadRobots } from './robots'
import { scanUrls } from './scan'
import type { ScanStore } from './store'
import { createIdleState, type SiteRequest, type SiteScanState } from './types'

export interface JobLimits {
  /** Hard cap per run so a huge site cannot wedge the browser. */
  maxPages: number
  /** Parallel page fetches. */
  concurrency: number
  /** Per-request timeout. */
  timeoutMs: number
}

export const DEFAULT_LIMITS: JobLimits = {
  maxPages: 1000,
  concurrency: 4,
  timeoutMs: 10_000,
}

export type JobStore = Pick<
  ScanStore,
  'loadStateOrIdle' | 'saveState' | 'clearState' | 'loadLastOrigin'
>

export interface JobDeps {
  store: JobStore
  /** Pushes the current state to the UI. */
  broadcast: (state: SiteScanState) => void
  limits?: Partial<JobLimits>
  /** Injectable for deterministic tests. */
  now?: () => number
  saveDebounceMs?: number
  broadcastThrottleMs?: number
}

export interface Job {
  handle(request: SiteRequest): Promise<SiteScanState>
  /** Picks a half-finished scan back up after a worker restart. */
  resumeIfNeeded(): Promise<void>
  /** Current state, for tests and diagnostics. */
  snapshot(): SiteScanState
}

type RobotsAllowed = (url: string) => boolean

export function createJob(deps: JobDeps): Job {
  const { store } = deps
  const limits = { ...DEFAULT_LIMITS, ...deps.limits }
  const now = deps.now ?? (() => Date.now())
  const saveDebounceMs = deps.saveDebounceMs ?? 400
  const broadcastThrottleMs = deps.broadcastThrottleMs ?? 300

  let state: SiteScanState = createIdleState('', '')
  let running: AbortController | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let broadcastTimer: ReturnType<typeof setTimeout> | null = null
  let lastBroadcast = 0

  // -- messaging ------------------------------------------------------------

  async function handle(request: SiteRequest): Promise<SiteScanState> {
    switch (request.type) {
      case 'site:getState': {
        const seedUrl = request.origin ? `${request.origin}/` : ''
        state = await store.loadStateOrIdle(request.origin, seedUrl)
        return state
      }
      case 'site:discover':
        return discover(request.seedUrl)
      case 'site:scan':
        return startScan(request.origin, request.urls)
      case 'site:cancel':
        return stopScan()
      case 'site:clear':
        running?.abort()
        running = null
        state = createIdleState(request.origin, `${request.origin}/`)
        await store.clearState(request.origin)
        return broadcast(true)
    }
  }

  // -- discovery ------------------------------------------------------------

  /**
   * Kicks off discovery and returns immediately: the popup gets its answer while
   * the crawler keeps working and pushes progress updates.
   */
  function discover(seedUrl: string): SiteScanState {
    running?.abort()

    const origin = new URL(seedUrl).origin
    const controller = new AbortController()
    running = controller
    state = { ...createIdleState(origin, seedUrl), status: 'discovering' }
    broadcast(true)

    void discoverSite({
      seedUrl,
      maxUrls: limits.maxPages,
      signal: controller.signal,
      onProgress: ({ phase, fetched, discovered, current }) => {
        state = {
          ...state,
          note:
            phase === 'sitemap'
              ? `Reading sitemap… ${discovered} URLs found (${current})`
              : `Crawling… ${discovered} URLs found, ${fetched} pages fetched`,
        }
        broadcast()
      },
    })
      .then((discovery) => {
        state = {
          ...state,
          status: 'ready',
          discovery,
          queue: [],
          results: [],
          scanned: 0,
          failed: 0,
          skipped: 0,
          currentUrls: [],
          note: discovery.notes[0] ?? null,
          error: null,
        }
      })
      .catch((error: unknown) => {
        state = {
          ...state,
          status: 'error',
          note: null,
          error: message(error),
        }
      })
      .finally(() => {
        if (running === controller) running = null
        void flush()
        broadcast(true)
      })

    return state
  }

  // -- scanning -------------------------------------------------------------

  /** Starts a scan and returns as soon as the queue is set up. */
  async function startScan(origin: string, urls: string[]): Promise<SiteScanState> {
    if (running) await stopScan()
    if (!state.discovery || state.origin !== origin) {
      state = await store.loadStateOrIdle(origin, `${origin}/`)
    }

    const queue = urls.slice(0, limits.maxPages)
    if (queue.length === 0) return broadcast(true)

    const robots = await loadRobots(origin)
    const controller = new AbortController()
    running = controller

    state = {
      ...state,
      status: 'scanning',
      queue,
      results: [],
      scanned: 0,
      failed: 0,
      skipped: 0,
      currentUrls: [],
      startedAt: now(),
      finishedAt: null,
      note: null,
      error: null,
    }
    broadcast(true)

    void runScan(controller, {
      robotsTxt: robots.text,
      robotsChecked: robots.checked,
      robotsAllowed: robots.isAllowed as RobotsAllowed,
      queue,
    })

    return state
  }

  interface ScanContext {
    robotsTxt: string | null
    robotsChecked: boolean
    robotsAllowed: RobotsAllowed
    queue: string[]
  }

  async function runScan(controller: AbortController, context: ScanContext): Promise<void> {
    try {
      await scanUrls({
        urls: context.queue,
        robotsTxt: context.robotsTxt,
        robotsChecked: context.robotsChecked,
        robotsAllowed: context.robotsAllowed,
        concurrency: limits.concurrency,
        timeoutMs: limits.timeoutMs,
        signal: controller.signal,
        onPage: (report) => {
          state = {
            ...state,
            results: [...state.results, report],
            scanned: state.scanned + 1,
            failed: state.failed + (report.ok ? 0 : 1),
          }
          scheduleSave()
          broadcast()
        },
        onSkip: () => {
          state = { ...state, skipped: state.skipped + 1 }
        },
        onProgress: ({ current }) => {
          state = { ...state, currentUrls: current }
          broadcast()
        },
      })
    } catch (error) {
      state = { ...state, error: message(error) }
    }

    if (running === controller) running = null

    if (!controller.signal.aborted) {
      state = {
        ...state,
        status: 'done',
        currentUrls: [],
        finishedAt: now(),
      }
    }

    await flush()
    broadcast(true)
  }

  async function stopScan(): Promise<SiteScanState> {
    running?.abort()
    running = null

    if (state.status === 'scanning' || state.status === 'discovering') {
      state = {
        ...state,
        status: state.discovery ? 'ready' : 'idle',
        currentUrls: [],
        queue: [],
      }
    }

    return broadcast(true)
  }

  /** Restarts a scan that was interrupted by a service-worker restart. */
  async function resumeIfNeeded(): Promise<void> {
    const origin = await store.loadLastOrigin()
    if (!origin) return

    const saved = await store.loadStateOrIdle(origin, `${origin}/`)
    if (saved.status !== 'scanning' || saved.queue.length === 0) return

    const done = new Set(saved.results.map((result) => result.url))
    const remaining = saved.queue.filter((url) => !done.has(url))

    if (remaining.length === 0) {
      await store.saveState({ ...saved, status: 'done', currentUrls: [], finishedAt: now() })
      return
    }

    await startScan(origin, remaining)
  }

  // -- persistence + broadcast ---------------------------------------------

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void flush(), saveDebounceMs)
  }

  async function flush(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (state.origin) await store.saveState(state)
  }

  /**
   * Publishes the current state. Every message carries the whole report, so
   * mid-scan updates are throttled and always coalesced into a trailing send.
   */
  function broadcast(force = false): SiteScanState {
    if (!force && now() - lastBroadcast < broadcastThrottleMs) {
      if (!broadcastTimer) {
        broadcastTimer = setTimeout(() => {
          broadcastTimer = null
          broadcast(true)
        }, broadcastThrottleMs)
      }
      return state
    }

    if (broadcastTimer) {
      clearTimeout(broadcastTimer)
      broadcastTimer = null
    }
    lastBroadcast = now()
    deps.broadcast(state)
    return state
  }

  return {
    handle,
    resumeIfNeeded,
    snapshot: () => state,
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
