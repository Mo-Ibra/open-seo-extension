import robotsParser from 'robots-parser'

import { fetchUrl } from './http'

/** robots.txt is checked for Googlebot, matching `lib/checks/robots-txt.ts`. */
export const CHECK_USER_AGENT = 'Googlebot'
/** Politeness: we look up our own crawling rules as a generic agent. */
const CRAWL_USER_AGENT = '*'

export interface RobotsRules {
  checked: boolean
  /** Raw robots.txt text, or `null` when missing/unreachable. */
  text: string | null
  /** Sitemaps declared via `Sitemap:` lines. */
  sitemaps: string[]
  /** False when robots.txt disallows the URL. */
  isAllowed(url: string): boolean
  /** Crawl-delay in milliseconds (0 when unset). */
  crawlDelayMs: number
}

const ALLOW_ALL: RobotsRules = {
  checked: false,
  text: null,
  sitemaps: [],
  isAllowed: () => true,
  crawlDelayMs: 0,
}

/** Downloads and parses `/robots.txt` for an origin. Never throws. */
export async function loadRobots(origin: string, signal?: AbortSignal): Promise<RobotsRules> {
  const result = await fetchUrl(`${origin}/robots.txt`, { timeoutMs: 10_000, signal })

  if (!result.ok || !result.body) return ALLOW_ALL

  const robotsUrl = new URL('/robots.txt', origin).href
  try {
    const robots = robotsParser(robotsUrl, result.body)
    const delay = robots.getCrawlDelay(CRAWL_USER_AGENT) ?? robots.getCrawlDelay(CHECK_USER_AGENT)

    return {
      checked: true,
      text: result.body,
      sitemaps: Array.from(robots.getSitemaps() || []),
      isAllowed: (url: string) => robots.isAllowed(url, CRAWL_USER_AGENT) !== false,
      crawlDelayMs: typeof delay === 'number' && delay > 0 ? Math.min(delay * 1000, 5000) : 0,
    }
  } catch {
    return { ...ALLOW_ALL, checked: false }
  }
}
