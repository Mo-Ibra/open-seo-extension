import robotsParser from 'robots-parser'

import type { Check } from '../types'

const LABEL = 'robots.txt'
const USER_AGENT = 'Googlebot'

export const robotsTxtCheck: Check = (page, context) => {
  if (!context.robotsTxtChecked) {
    return [
      {
        id: 'robots-txt-unknown',
        label: LABEL,
        value: null,
        status: 'warn',
        message: 'Could not fetch robots.txt.',
      },
    ]
  }

  if (!context.robotsTxt) {
    return [
      {
        id: 'robots-txt-none',
        label: LABEL,
        value: 'Not found',
        status: 'pass',
        message: 'No robots.txt \u2014 all pages are crawlable by default.',
      },
    ]
  }

  try {
    const robotsFileUrl = new URL('/robots.txt', page.url).href
    const robots = robotsParser(robotsFileUrl, context.robotsTxt)
    const allowed = robots.isAllowed(page.url, USER_AGENT)

    if (allowed === false) {
      return [
        {
          id: 'robots-txt-disallowed',
          label: LABEL,
          value: 'Disallowed',
          status: 'fail',
          message: `This URL is disallowed for ${USER_AGENT} in robots.txt.`,
          fix: 'Allow crawling for this URL if it should rank in search.',
        },
      ]
    }

    return [
      {
        id: 'robots-txt-allowed',
        label: LABEL,
        value: 'Allowed',
        status: 'pass',
        message: `Allowed for ${USER_AGENT} in robots.txt.`,
      },
    ]
  } catch {
    return [
      {
        id: 'robots-txt-error',
        label: LABEL,
        value: null,
        status: 'warn',
        message: 'Could not parse robots.txt.',
      },
    ]
  }
}
