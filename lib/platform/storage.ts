/**
 * The only module that talks to `chrome.storage`.
 *
 * Everything else in `lib/` uses this indirectly through `lib/crawl/store.ts`,
 * which keeps the crawl code free of extension APIs and therefore testable in a
 * plain Node process.
 */

import { browser } from 'wxt/browser'

interface StorageArea {
  get(keys?: unknown): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
  remove(keys: unknown): Promise<void>
}

/** Used when the extension has no usable `storage` area, or a call is rejected. */
const memory = new Map<string, unknown>()

/**
 * Resolves `chrome.storage.local` defensively: an install without the
 * `storage` permission has no such namespace at all, and reading through it
 * would throw `Cannot read properties of undefined`.
 */
function area(): StorageArea | null {
  try {
    return (browser as { storage?: { local?: StorageArea } })?.storage?.local ?? null
  } catch {
    return null
  }
}

/** False when data cannot be persisted between browser sessions. */
export function isPersistent(): boolean {
  return area() !== null
}

export async function getValue<T>(key: string): Promise<T | null> {
  const local = area()
  if (!local) return (memory.get(key) as T | undefined) ?? null

  try {
    const items = await local.get(key)
    const value = items[key]
    if (value !== undefined) return value as T
  } catch {
    // Fall through: a write may have been downgraded to the in-memory copy.
  }
  return (memory.get(key) as T | undefined) ?? null
}

export async function setValue(key: string, value: unknown): Promise<void> {
  const local = area()
  if (!local) {
    memory.set(key, value)
    return
  }
  try {
    await local.set({ [key]: value })
  } catch {
    // Quota or a revoked permission: keep the scan usable in memory.
    memory.set(key, value)
  }
}

export async function removeValue(key: string): Promise<void> {
  const local = area()
  memory.delete(key)
  if (!local) return
  try {
    await local.remove(key)
  } catch {
    // Already dropped from the in-memory copy.
  }
}
