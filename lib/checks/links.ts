import type { Check, Finding } from '../types'

const LABEL = 'Links'

function isInternal(href: string, pageUrl: string): boolean {
  try {
    return new URL(href).origin === new URL(pageUrl).origin
  } catch {
    return true
  }
}

export const linksCheck: Check = (page) => {
  const internal: string[] = []
  const external: string[] = []
  const withoutText: string[] = []

  for (const link of page.links) {
    if (!link.href || link.href.startsWith('javascript:')) {
      continue
    }
    if (isInternal(link.href, page.url)) {
      internal.push(link.href)
    } else {
      external.push(link.href)
    }
    if (!link.text) {
      withoutText.push(link.href)
    }
  }

  const findings: Finding[] = [
    {
      id: 'links-summary',
      label: LABEL,
      value: `${internal.length} internal \u00b7 ${external.length} external`,
      status: 'pass',
      message: `Found ${internal.length} internal and ${external.length} external links.`,
    },
  ]

  if (withoutText.length > 0) {
    findings.push({
      id: 'links-empty-anchor',
      label: 'Link text',
      value: `${withoutText.length} without text`,
      status: 'warn',
      message: `${withoutText.length} link(s) have no anchor text.`,
      fix: 'Give every link descriptive text (or an image alt) for users and search engines.',
    })
  }

  return findings
}
