/**
 * The only module that talks to `chrome.runtime` messaging.
 *
 * Keeping it in one place means the popup, the background worker and the tests
 * all agree on the message shapes (`lib/crawl/types.ts`) and on the awkward
 * `sendResponse` handshake.
 */

import { browser } from 'wxt/browser'

import type { SiteEvent, SiteRequest, SiteScanState } from '../crawl/types'

/** Sends a request to the worker. Resolves `null` if nothing answers. */
export async function sendSiteRequest(request: SiteRequest): Promise<SiteScanState | null> {
  const response = await browser.runtime
    .sendMessage(request)
    .then((value) => (value as SiteScanState | undefined) ?? null)
    .catch(() => null)
  return response
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
