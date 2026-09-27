import { afterEach, describe, expect, it } from 'vitest'

import { createIdleState, type SiteRequest, type SiteScanState } from '../../lib/crawl/types'
import { broadcastSiteState, listenSiteRequests, onSiteState, sendSiteRequest } from '../../lib/platform/messaging'
import { fakeChrome } from '../helpers/fake-chrome'

afterEach(() => fakeChrome.reset())

function idleState(origin = 'https://example.com'): SiteScanState {
  return { ...createIdleState(origin, `${origin}/`), status: 'ready' }
}

describe('platform messaging', () => {
  it('round-trips a request through the registered worker listener', async () => {
    const cleanup = listenSiteRequests(
      async (request: SiteRequest) => ({ ...idleState(), note: request.type }),
      () => ({ ...createIdleState('', ''), status: 'error' })
    )

    const state = await sendSiteRequest({ type: 'site:getState', origin: 'https://example.com' })

    expect(state?.status).toBe('ready')
    expect(state?.note).toBe('site:getState')
    cleanup()
  })

  it('returns an error state when the worker handler throws', async () => {
    const cleanup = listenSiteRequests(
      async () => {
        throw new Error('boom')
      },
      (error) => ({
        ...createIdleState('', ''),
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    )

    const state = await sendSiteRequest({ type: 'site:cancel' })
    expect(state).toMatchObject({ status: 'error', error: 'boom' })
    cleanup()
  })

  it('resolves null instead of throwing when the worker is unreachable', async () => {
    expect(await sendSiteRequest({ type: 'site:getState', origin: 'https://example.com' })).toBeNull()

    fakeChrome.messagingBroken = true
    await expect(
      sendSiteRequest({ type: 'site:getState', origin: 'https://example.com' })
    ).resolves.toBeNull()
  })

  it('delivers broadcasts to subscribers and stops after unsubscribe', async () => {
    const seen: SiteScanState[] = []
    const unsubscribe = onSiteState((state) => seen.push(state))

    broadcastSiteState(idleState())
    await tick()
    expect(seen).toHaveLength(1)
    expect(seen[0].status).toBe('ready')

    unsubscribe()
    broadcastSiteState(idleState())
    await tick()
    expect(seen).toHaveLength(1)
  })

  it('survives broadcasting with no subscriber (popup closed)', () => {
    expect(() => broadcastSiteState(idleState())).not.toThrow()
  })
})

/** `runtime.sendMessage` delivers asynchronously, like the real API. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
