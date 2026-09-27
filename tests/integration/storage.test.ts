import { afterEach, describe, expect, it } from 'vitest'

import { isPersistent, loadLastOrigin, loadState, saveState } from '../../lib/crawl/store'
import { createIdleState } from '../../lib/crawl/types'
import { fakeChrome } from '../helpers/fake-chrome'

afterEach(() => fakeChrome.reset())

const origin = 'https://example.com'

describe('scan store', () => {
  it('persists a scan through chrome.storage.local', async () => {
    expect(isPersistent()).toBe(true)

    const state = { ...createIdleState(origin, `${origin}/`), status: 'done' as const }
    await saveState(state)

    expect(Object.keys(fakeChrome.data)).toContain(`open-seo:site:${origin}`)
    expect((await loadState(origin))?.status).toBe('done')
    expect(await loadLastOrigin()).toBe(origin)
  })

  it('returns null for an origin that was never scanned', async () => {
    expect(await loadState(origin)).toBeNull()
    expect(await loadLastOrigin()).toBeNull()
  })

  it('falls back to memory when a write is rejected (quota, revoked permission)', async () => {
    fakeChrome.storageAvailable = false

    const state = { ...createIdleState(origin, `${origin}/`), status: 'done' as const }
    await saveState(state)

    // The write failed, but the scan is still readable for this session.
    expect((await loadState(origin))?.status).toBe('done')
    expect(Object.keys(fakeChrome.data)).toHaveLength(0)
  })
})
