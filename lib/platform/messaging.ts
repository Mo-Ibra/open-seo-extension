/**
 * The only module that talks to `chrome.runtime` messaging.
 *
 * Keeping it in one place means the popup, the background worker and the tests
 * all agree on the message shapes (`lib/crawl/types.ts`) and on the awkward
 * `sendResponse` handshake.
 */

import { browser } from 'wxt/browser'

import type { SiteEvent, SiteRequest, SiteScanState } from '../crawl/types'

/**
 * How long to wait for the worker to answer a state request before giving up.
 *
 * MV3 service workers are killed by the browser when idle, and a popup opened
 * right after that has to wake it up again. Waking is usually fast, but if the
 * worker is wedged we would rather show an error than spin forever.
 */
const HANDSHAKE_TIMEOUT_MS = 4000

/** Sends a request to the worker. Resolves `null` if nothing answers. */
export async function sendSiteRequest(request: SiteRequest): Promise<SiteScanState | null> {
  const response = await browser.runtime
    .sendMessage(request)
    .then((value) => (value as SiteScanState | undefined) ?? null)
    .catch(() => null)
  return response
}

/**
 * Reads the live scan state from the worker, giving up after
 * `HANDSHAKE_TIMEOUT_MS`.
 *
 * Distinct from `sendSiteRequest`, which never times out and so can hang the
 * popup forever. This is the call the popup makes on open and on every retry:
 * it always settles, with either the state or `null`.
 */
export async function getSiteStateWithTimeout(origin: string): Promise<SiteScanState | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), HANDSHAKE_TIMEOUT_MS)
  })

  try {
    return await Promise.race([sendSiteRequest({ type: 'site:getState', origin }), timeout])
  } finally {
    // Clear the timer on the happy path too, otherwise the popup keeps a
    // pending task alive for four seconds after every successful open.
    if (timer) clearTimeout(timer)
  }
}

/** Subscribes to state broadcasts. Returns an unsubscribe function. */
export function onSiteState(listener: (state: SiteScanState) => void): () => void {
  const handler = (message: unknown): undefined => {
    const event = message as SiteEvent | undefined
    if (event?.type === 'site:state') listener(event.state)
    return undefined
  }

  browser.runtime.onMessage.addListener(handler)
  return () => {
    const runtime = browser.runtime as unknown as {
      onMessage: { removeListener?: (listener: (message: unknown) => undefined) => void }
    }
    runtime.onMessage.removeListener?.(handler)
  }
}

/** Pushes the current state to the popup. Failures (no popup open) are ignored. */
export function broadcastSiteState(state: SiteScanState): void {
  const event: SiteEvent = { type: 'site:state', state }
  void browser.runtime.sendMessage(event).catch(() => undefined)
}

type SiteRequestListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void
) => boolean

/**
 * Registers the worker-side listener.
 *
 * Uses the callback style on purpose: `wxt/browser` is the raw `chrome` API, and
 * promise-returning `onMessage` listeners are not supported everywhere.
 */
export function listenSiteRequests(
  handler: (request: SiteRequest) => Promise<SiteScanState>,
  onError: (error: unknown) => SiteScanState
): () => void {
  const listener: SiteRequestListener = (message, _sender, sendResponse) => {
    if (!isSiteRequest(message)) return false

    handler(message).then(
      (next) => sendResponse(next),
      (error: unknown) => sendResponse(onError(error))
    )
    return true
  }

  browser.runtime.onMessage.addListener(
    listener as unknown as Parameters<typeof browser.runtime.onMessage.addListener>[0]
  )
  return () => {
    const runtime = browser.runtime as unknown as {
      onMessage: { removeListener?: (listener: SiteRequestListener) => void }
    }
    runtime.onMessage.removeListener?.(listener)
  }
}

function isSiteRequest(message: unknown): message is SiteRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof (message as { type?: unknown }).type === 'string' &&
    (message as { type: string }).type.startsWith('site:')
  )
}
