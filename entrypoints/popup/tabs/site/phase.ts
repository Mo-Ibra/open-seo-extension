/**
 * The site tab's view state.
 *
 * `SiteScanState.status` describes what the *worker* is doing; `Phase` is what
 * the *popup* should draw. The two are not the same: the popup adds a
 * `loading` state for its own initial read, and an `unsupported` state for
 * pages it cannot crawl (chrome://, the web store, a PDF viewer).
 *
 * Keeping the translation here — instead of inline in the component — means the
 * stepper and the error messages cannot disagree with the render branches.
 */

import { SCAN_STEPS } from '../../constants/site'
import type { SiteScanState } from '../../../../lib/crawl/types'

/** What the site tab is currently showing. */
export type Phase = 'loading' | 'unsupported' | SiteScanState['status']

/**
 * Maps a phase onto an index into `SCAN_STEPS`, for the stepper.
 *
 * `idle` and `loading` are both "nothing started yet"; the two busy phases
 * share one step; `done` and `error` both land on the report, because after a
 * failure the user is looking at whatever was collected.
 */
export function stepForPhase(phase: Phase): number {
  if (phase === 'idle' || phase === 'loading') return 0
  if (phase === 'ready') return 1
  if (phase === 'scanning' || phase === 'discovering') return 2
  return SCAN_STEPS.length - 1
}

/** True for the two phases in which a request is in flight to the worker. */
export function isBusyPhase(phase: Phase): boolean {
  return phase === 'discovering' || phase === 'scanning'
}

/**
 * Copy for the two conditions that stop the tab from rendering anything.
 *
 * Both mention reloading from `chrome://extensions` because a silent MV3
 * service worker can be unregistered by the browser at any time; that is the
 * single most common cause of a popup that used to work and now does not.
 */
export const PHASE_MESSAGES = {
  /** The worker never answered a state request within the timeout. */
  workerUnresponsive:
    'The background worker did not respond. Reload the extension in chrome://extensions, then start the scan again.',
  /** A request was sent but the worker could not be reached at all. */
  workerUnreachable:
    'Could not talk to the background worker. Reload the extension in chrome://extensions, then try again.',
  /** Shown when the active tab is not an http(s) page. */
  unsupported: 'Open a normal web page first — the crawler reads that site.',
} as const
