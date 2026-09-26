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
  // Without a timeout a slow origin (or a hung connection) leaves the popup
  // waiting forever, so every request here is bounded.
  const withTimeout = (input: string): Promise<Response> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    return fetch(input, { redirect: 'follow', signal: controller.signal }).finally(() =>
      clearTimeout(timer)
    )
  }

  let robotsTxt: string | null = null
  let robotsTxtChecked = false
  try {
    const response = await withTimeout(`${location.origin}/robots.txt`)
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
    const response = await withTimeout(location.href)
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
