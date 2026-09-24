import type { Check } from '../types'

const LABEL = 'Robots meta'

export const robotsMetaCheck: Check = (page) => {
  if (page.robotsMeta.length === 0) {
    return [
      {
        id: 'robots-meta-none',
        label: LABEL,
        value: 'Not set',
        status: 'pass',
        message: 'No robots meta tag \u2014 the page is indexable by default.',
      },
    ]
  }

  const raw = page.robotsMeta.join(', ').toLowerCase()
  const directives = raw.split(/[\s,]+/).filter(Boolean)

  if (directives.includes('noindex')) {
    return [
      {
        id: 'robots-meta-noindex',
        label: LABEL,
        value: raw,
        status: 'fail',
        message: 'The page is set to noindex and will be excluded from search.',
        fix: 'Remove "noindex" if this page should appear in search results.',
      },
    ]
  }

  if (directives.includes('nofollow')) {
    return [
      {
        id: 'robots-meta-nofollow',
        label: LABEL,
        value: raw,
        status: 'warn',
        message: 'The page is set to nofollow; links on it will not be followed.',
        fix: 'Remove "nofollow" unless it is intentional.',
      },
    ]
  }

  return [
    {
      id: 'robots-meta-ok',
      label: LABEL,
      value: raw,
      status: 'pass',
      message: 'Robots meta allows indexing and following.',
    },
  ]
}
