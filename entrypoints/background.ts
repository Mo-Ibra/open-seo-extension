import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/sandbox'

import { discoverSite } from '../lib/crawl/discover'
import { loadRobots } from '../lib/crawl/robots'
import { scanUrls } from '../lib/crawl/scan'
import { clearState, loadLastOrigin, loadStateOrIdle, saveState } from '../lib/crawl/store'
import { createIdleState, type SiteEvent, type SiteRequest, type SiteScanState } from '../lib/crawl/types'

/** Hard cap per run so a huge site cannot wedge the browser. */
const MAX_PAGES = 1000
const SAVE_DEBOUNCE_MS = 400
const BROADCAST_THROTTLE_MS = 300

let state: SiteScanState = createIdleState('', '')
let running: AbortController | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let broadcastTimer: ReturnType<typeof setTimeout> | null = null
let lastBroadcast = 0

export default defineBackground(() => {
  // Callback style (not a returned promise): `wxt/browser` is the raw `chrome`
  // API, and promise-returning `onMessage` listeners are not supported
  // everywhere. `sendResponse` + `return true` works everywhere.
  type Listener = (
    message: unknown,
    sender: unknown,
    sendResponse: (response: unknown) => void
  ) => boolean

  const listener: Listener = (message, _sender, sendResponse) => {
    if (!isSiteRequest(message)) return false

    handle(message).then(
      (next) => sendResponse(next),
      (error: unknown) =>
        sendResponse({
          ...createIdleState('', ''),
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
    )
    return true
  }

  browser.runtime.onMessage.addListener(listener as unknown as Parameters<
    typeof browser.runtime.onMessage.addListener
  >[0])

  // A service worker is torn down aggressively; pick a half-finished scan back
  // up instead of silently leaving the popup spinning.
  void resumeIfNeeded()
})

function isSiteRequest(message: unknown): message is SiteRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof (message as { type?: unknown }).type === 'string' &&
    (message as { type: string }).type.startsWith('site:')
  )
}

async function handle(request: SiteRequest): Promise<SiteScanState> {
  switch (request.type) {
    case 'site:getState': {
      const seedUrl = request.origin ? `${request.origin}/` : ''
      state = await loadStateOrIdle(request.origin, seedUrl)
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
      await clearState(request.origin)
      return broadcast()
  }
}

/**
 * Kicks off discovery and returns immediately: the popup gets its answer while
 * the crawler keeps working in the background and pushes progress updates.
 */
async function discover(seedUrl: string): Promise<SiteScanState> {
  running?.abort()

  const origin = new URL(seedUrl).origin
  const controller = new AbortController()
  running = controller
  state = { ...createIdleState(origin, seedUrl), status: 'discovering' }
  broadcast(true)

  void discoverSite({
    seedUrl,
    maxUrls: MAX_PAGES,
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
        error: error instanceof Error ? error.message : String(error),
      }
    })
    .finally(() => {
      if (running === controller) running = null
      void flush()
      broadcast(true)
    })

  return state
}

/** Starts a scan and returns as soon as the queue is set up. */
async function startScan(origin: string, urls: string[]): Promise<SiteScanState> {
  if (running) await stopScan()
  if (!state.discovery || state.origin !== origin) {
    state = await loadStateOrIdle(origin, `${origin}/`)
  }

  const queue = urls.slice(0, MAX_PAGES)
  if (queue.length === 0) return broadcast()

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
    startedAt: Date.now(),
    finishedAt: null,
    note: null,
    error: null,
  }
  broadcast(true)

  void runScan(controller, robots.text, robots.checked, robots.isAllowed, queue)

  return state
}

type RobotsAllowed = (url: string) => boolean

async function runScan(
  controller: AbortController,
  robotsTxt: string | null,
  robotsChecked: boolean,
  robotsAllowed: RobotsAllowed,
  queue: string[]
): Promise<void> {
  try {
    await scanUrls({
      urls: queue,
      robotsTxt,
      robotsChecked,
      robotsAllowed,
      concurrency: 4,
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
    state = {
      ...state,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  if (running === controller) running = null

  if (!controller.signal.aborted) {
    state = {
      ...state,
      status: 'done',
      currentUrls: [],
      finishedAt: Date.now(),
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

  return broadcast()
}

/** Restarts a scan that was interrupted by a service-worker restart. */
async function resumeIfNeeded(): Promise<void> {
  const origin = await loadLastOrigin()
  if (!origin) return

  const saved = await loadStateOrIdle(origin, `${origin}/`)
  if (saved.status !== 'scanning' || saved.queue.length === 0) return

  const done = new Set(saved.results.map((result) => result.url))
  const remaining = saved.queue.filter((url) => !done.has(url))
  if (remaining.length === 0) {
    await saveState({ ...saved, status: 'done', currentUrls: [], finishedAt: Date.now() })
    return
  }

  await startScan(origin, remaining)
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS)
}

async function flush(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (state.origin) await saveState(state)
}

/**
 * Sends the current state to the popup. Every message carries the whole report,
 * so mid-scan updates are throttled and always coalesced into a trailing send.
 */
function broadcast(force = false): SiteScanState {
  const now = Date.now()

  if (!force && now - lastBroadcast < BROADCAST_THROTTLE_MS) {
    if (!broadcastTimer) {
      broadcastTimer = setTimeout(() => {
        broadcastTimer = null
        broadcast(true)
      }, BROADCAST_THROTTLE_MS)
    }
    return state
  }

  if (broadcastTimer) {
    clearTimeout(broadcastTimer)
    broadcastTimer = null
  }
  lastBroadcast = now

  const event: SiteEvent = { type: 'site:state', state }
  // The popup may not be open; that rejection is expected and harmless.
  void browser.runtime.sendMessage(event).catch(() => undefined)
  return state
}
