import type { PageData, SiteContext } from '../../lib/types'

/**
 * Minimal valid `PageData`, with overrides for the fields a check reads.
 *
 * Checks take a whole `PageData` but usually look at one or two fields, so
 * building one inline in every test gets noisy. Start from this and override
 * only what the test is about.
 */
export function makePage(overrides: Partial<PageData> = {}): PageData {
  return {
    url: 'https://example.com/page',
    title: 'Example page',
    description: 'An example page used in tests.',
    canonical: null,
    robotsMeta: [],
    social: { openGraph: {}, twitter: {} },
    headings: [],
    links: [],
    wordCount: 0,
    hiddenWordCount: 0,
    ...overrides,
  }
}

/** The `SiteContext` a check receives. Defaults to "nothing was fetched". */
export function makeContext(overrides: Partial<SiteContext> = {}): SiteContext {
  return {
    robotsTxt: null,
    robotsTxtChecked: false,
    xRobotsTag: null,
    xRobotsTagChecked: false,
    ...overrides,
  }
}
