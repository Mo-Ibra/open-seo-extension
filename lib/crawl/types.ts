import type { Finding } from '../types'

/** Where the URL list came from. */
export type DiscoverySource = 'sitemap' | 'crawl' | 'mixed'

export interface DiscoveredUrl {
  url: string
  /** How the crawler learned about this URL. */
  from: 'sitemap' | 'link'
  /** Link distance from the seed page (0 for sitemap entries). */
  depth: number
}

export interface DiscoveryResult {
  origin: string
  seedUrl: string
  source: DiscoverySource
  urls: DiscoveredUrl[]
  robotsTxt: string | null
  robotsChecked: boolean
  /** Pages actually fetched while discovering (0 when a sitemap answered). */
  fetched: number
  /** Human-readable remarks about the discovery run. */
  notes: string[]
}

export interface PageReport {
  url: string
  /** HTTP status, or `null` when the request failed (timeout, network, blocked). */
  status: number | null
  ok: boolean
  /** URL after redirects. */
  finalUrl: string
  contentType: string | null
  durationMs: number
  title: string
  wordCount: number
  findings: Finding[]
}

export type ScanStatus =
  | 'idle'
  | 'discovering'
  | 'ready'
  | 'scanning'
  | 'paused'
  | 'done'
  | 'error'

/** The single source of truth for the site-audit feature, persisted per origin. */
export interface SiteScanState {
  origin: string
  seedUrl: string
  status: ScanStatus
  discovery: DiscoveryResult | null
  /** URLs queued for the current run, in scan order. */
  queue: string[]
  scanned: number
  failed: number
  /** URLs robots.txt disallows. */
  skipped: number
  /** URLs being fetched right now (up to the concurrency limit). */
  currentUrls: string[]
  startedAt: number | null
  finishedAt: number | null
  results: PageReport[]
  /** Progress text while discovering/scanning. */
  note: string | null
  /** Set when the last run failed. */
  error: string | null
}

/** Messages sent from the popup to the background worker. */
export type SiteRequest =
  | { type: 'site:getState'; origin: string }
  | { type: 'site:discover'; seedUrl: string }
  | { type: 'site:scan'; origin: string; urls: string[] }
  | { type: 'site:cancel' }
  | { type: 'site:clear'; origin: string }

/** Messages broadcast by the background worker whenever the state changes. */
export type SiteEvent = { type: 'site:state'; state: SiteScanState }

export function createIdleState(origin: string, seedUrl: string): SiteScanState {
  return {
    origin,
    seedUrl,
    status: 'idle',
    discovery: null,
    queue: [],
    scanned: 0,
    failed: 0,
    skipped: 0,
    currentUrls: [],
    startedAt: null,
    finishedAt: null,
    results: [],
    note: null,
    error: null,
  }
}
