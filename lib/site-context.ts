import type { SiteContext } from './types'

/**
 * Reads the server-side indexability signals for the current page.
 *
 * This function is injected with `browser.scripting.executeScript`. It runs in
 * the page itself and only makes **same-origin** requests, so it needs no host
 * permissions beyond the `activeTab` grant already used to inspect the page.
 * It must stay self-contained (no imports, no outer-scope references).
 */
export async function extractSiteContext(): Promise<SiteContext> {
  let robotsTxt: string | null = null
  let robotsTxtChecked = false
  try {
    const response = await fetch(`${location.origin}/robots.txt`, { redirect: 'follow' })
    robotsTxtChecked = true
    if (response.ok) {
      robotsTxt = await response.text()
    }
  } catch {
    robotsTxtChecked = false
  }

  let xRobotsTag: string | null = null
  let xRobotsTagChecked = false
  try {
    const response = await fetch(location.href, { redirect: 'follow' })
    xRobotsTagChecked = true
    xRobotsTag = response.headers.get('x-robots-tag')
    // Only the headers were needed; don't download the body.
    try {
      await response.body?.cancel()
    } catch {
      // Ignore: the body may already be consumed.
    }
  } catch {
    xRobotsTagChecked = false
  }

  return { robotsTxt, robotsTxtChecked, xRobotsTag, xRobotsTagChecked }
}
