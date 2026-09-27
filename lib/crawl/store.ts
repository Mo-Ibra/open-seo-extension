/**
 * Per-origin persistence for site scans.
 *
 * Thin domain layer over `lib/platform/storage.ts`: the crawl code knows about
 * origins and scan state, but never about `chrome`.
 */

import { getValue, isPersistent, removeValue, setValue } from '../platform/storage'
import { createIdleState, type SiteScanState } from './types'

/** State is kept per origin so switching sites does not clobber a report. */
const key = (origin: string): string => `open-seo:site:${origin}`
const LAST_ORIGIN_KEY = 'open-seo:site:last'

export { isPersistent }

export interface ScanStore {
  loadState(origin: string): Promise<SiteScanState | null>
  loadStateOrIdle(origin: string, seedUrl: string): Promise<SiteScanState>
  saveState(state: SiteScanState): Promise<void>
  clearState(origin: string): Promise<void>
  loadLastOrigin(): Promise<string | null>
}

export async function loadState(origin: string): Promise<SiteScanState | null> {
  return getValue<SiteScanState>(key(origin))
}

export async function loadStateOrIdle(origin: string, seedUrl: string): Promise<SiteScanState> {
  return (await loadState(origin)) ?? createIdleState(origin, seedUrl)
}

export async function saveState(state: SiteScanState): Promise<void> {
  await setValue(key(state.origin), state)
  await setValue(LAST_ORIGIN_KEY, state.origin)
}

export async function clearState(origin: string): Promise<void> {
  await removeValue(key(origin))
}

/** The origin of the most recent scan, used to resume after a worker restart. */
export async function loadLastOrigin(): Promise<string | null> {
  return getValue<string>(LAST_ORIGIN_KEY)
}
