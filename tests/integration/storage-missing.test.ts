import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * An install without the `storage` permission has no `chrome.storage`
 * namespace at all. `wxt/browser` copies the API when it is first imported, so
 * this state has to be simulated by mocking the module — and the module under
 * test has to be imported afterwards.
 */
vi.mock('wxt/browser', () => ({ browser: {} }))

const { isPersistent, loadState, saveState } = await import('../../lib/crawl/store')
const { createIdleState } = await import('../../lib/crawl/types')

const origin = 'https://example.com'

describe('scan store without the storage permission', () => {
  beforeEach(() => {
    // Nothing to reset: the mocked browser is stateless.
  })

  it('reports that nothing can be persisted', () => {
    expect(isPersistent()).toBe(false)
  })

  it('still works, in memory, instead of throwing', async () => {
    const state = { ...createIdleState(origin, `${origin}/`), status: 'scanning' as const }

    await expect(saveState(state)).resolves.toBeUndefined()
    expect((await loadState(origin))?.status).toBe('scanning')
  })
})
