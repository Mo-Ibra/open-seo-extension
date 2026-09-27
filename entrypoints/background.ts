import { defineBackground } from 'wxt/sandbox'

import { createJob } from '../lib/crawl/job'
import { clearState, loadLastOrigin, loadStateOrIdle, saveState } from '../lib/crawl/store'
import { createIdleState, type SiteScanState } from '../lib/crawl/types'
import { broadcastSiteState, listenSiteRequests } from '../lib/platform/messaging'

/**
 * All this entrypoint does is wire the platform to the job. The behaviour lives
 * in `lib/crawl/job.ts`, which has no extension dependencies and is unit-tested.
 */
export default defineBackground(() => {
  const job = createJob({
    store: { loadStateOrIdle, saveState, clearState, loadLastOrigin },
    broadcast: broadcastSiteState,
  })

  listenSiteRequests(
    (request) => job.handle(request),
    (error) => ({
      ...createIdleState('', ''),
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    }) satisfies SiteScanState
  )

  // A service worker is torn down aggressively; pick a half-finished scan back
  // up instead of silently leaving the popup spinning.
  void job.resumeIfNeeded()
})
