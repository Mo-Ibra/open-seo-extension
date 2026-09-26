import { browser } from 'wxt/browser'

import { createIdleState, type SiteScanState } from './types'

/** The subset of `chrome.storage.local` this module needs. */
interface StorageArea {
  get(keys?: unknown): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: unknown): Promise<void>
}

/** State is kept per origin so switching sites does not clobber a report. */
const key = (origin: string): string => `open-seo:site:${origin}`
const LAST_ORIGIN_KEY = 'open-seo:site:last'

/**
 * Used when the extension has no usable `storage` area (missing permission, or
 * a browser that does not expose it). Scans then live only as long as the
 * background worker does.
 */
const memory = new Map<string, unknown>()

function area(): StorageArea | null {
  try {
    const candidate = (browser as unknown as { storage?: { local?: StorageArea } })?.storage?.local
    return candidate ?? null
  } catch {
    return null
  }
}

/** False when scan results cannot be persisted between browser sessions. */
export function isPersistent(): boolean {
  return area() !== null
}

export async function loadState(origin: string): Promise<SiteScanState | null> {
  const storageKey = key(origin)
  const local = area()

  if (!local) return (memory.get(storageKey) as SiteScanState | undefined) ?? null

  try {
    const stored = await local.get(storageKey)
    return (stored[storageKey] as SiteScanState | undefined) ?? null
  } catch {
    return null
  }
}

export async function loadStateOrIdle(origin: string, seedUrl: string): Promise<SiteScanState> {
  return (await loadState(origin)) ?? createIdleState(origin, seedUrl)
}

export async function saveState(state: SiteScanState): Promise<void> {
  const local = area()
  if (!local) {
    memory.set(key(state.origin), state)
    memory.set(LAST_ORIGIN_KEY, state.origin)
    return
  }
  try {
    await local.set({ [key(state.origin)]: state, [LAST_ORIGIN_KEY]: state.origin })
  } catch {
    // Quota or a revoked permission: keep the scan usable in memory.
    memory.set(key(state.origin), state)
    memory.set(LAST_ORIGIN_KEY, state.origin)
  }
}

export async function clearState(origin: string): Promise<void> {
  const local = area()
  if (!local) {
    memory.delete(key(origin))
    return
  }
  try {
    await local.remove(key(origin))
  } catch {
    // Ignore: the in-memory copy is dropped below either way.
  }
  memory.delete(key(origin))
}

/** The origin of the most recent scan, used to resume after a worker restart. */
export async function loadLastOrigin(): Promise<string | null> {
  const local = area()
  if (!local) return (memory.get(LAST_ORIGIN_KEY) as string | undefined) ?? null

  try {
    const stored = await local.get(LAST_ORIGIN_KEY)
    return (stored[LAST_ORIGIN_KEY] as string | undefined) ?? null
  } catch {
    return null
  }
}
