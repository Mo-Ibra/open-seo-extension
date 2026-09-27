/**
 * Tunables for the site (whole-domain) tab.
 *
 * These live in the popup because only the popup's `SiteTab` and
 * `ReportPanel` read them. Anything the background worker or the crawler needs
 * belongs in `lib/crawl/` instead — keep platform behaviour out of this file.
 */

import type { DiscoverySource } from '../../../lib/crawl/types'
import type { Tone } from './tone'

/** How many pages the user can pick with one click, e.g. "25". */
export const SCAN_PRESETS = [10, 25, 50, 100, 250, 500] as const

/**
 * The four stages of a site scan, in order. `SiteTab` maps a scan status onto
 * one of these indexes to drive the stepper.
 */
export const SCAN_STEPS = ['Discover', 'Choose', 'Scan', 'Report'] as const

/**
 * How many URLs the page picker shows at once.
 *
 * This replaces an earlier hard cap of 200 rendered rows, which existed only to
 * keep the DOM small. Pagination means the row count is now fixed regardless of
 * how large the site is, so every discovered URL is browsable and the popup
 * still renders the same amount of DOM. A 769-URL site shows 8 pages instead of
 * an unreachable tail.
 */
export const URL_PAGE_SIZE = 100

/** Page sizes offered in the picker. Must include `URL_PAGE_SIZE`. */
export const URL_PAGE_SIZES = [50, 100, 200] as const

/**
 * How many URLs are listed inside an expanded issue in the report. The full
 * list is in the CSV/JSON export; the popup stays readable.
 */
export const ISSUE_URL_PREVIEW_LIMIT = 30

/**
 * Label and tone for the source pill next to the page count.
 *
 * A pure link crawl is flagged as a warning because it means no usable
 * sitemap.xml was found, so the list is shallower than the site really is.
 */
export const DISCOVERY_SOURCE = {
  sitemap: { label: 'from sitemap', tone: 'pass' },
  crawl: { label: 'from link crawl', tone: 'warn' },
  mixed: { label: 'sitemap + crawl', tone: 'pass' },
} as const satisfies Record<DiscoverySource, { label: string; tone: Tone }>
