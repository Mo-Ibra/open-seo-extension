import type { Check } from '../types'

const LABEL = 'X-Robots-Tag'

export const xRobotsTagCheck: Check = (_page, context) => {
  if (!context.xRobotsTagChecked) {
    return [
      {
        id: 'x-robots-tag-unknown',
        label: LABEL,
        value: null,
        status: 'warn',
        message: 'Could not read the X-Robots-Tag response header.',
      },
    ]
  }

  const value = context.xRobotsTag
  if (!value) {
    return [
      {
        id: 'x-robots-tag-none',
        label: LABEL,
        value: 'Not set',
        status: 'pass',
        message: 'No X-Robots-Tag response header.',
      },
    ]
  }

  const lower = value.toLowerCase()

  if (lower.includes('noindex')) {
    return [
      {
        id: 'x-robots-tag-noindex',
        label: LABEL,
        value,
        status: 'fail',
        message: 'The X-Robots-Tag header sets noindex; the page will be excluded from search.',
        fix: 'Remove noindex from the X-Robots-Tag response header if this page should rank.',
      },
    ]
  }

  if (lower.includes('nofollow')) {
    return [
      {
        id: 'x-robots-tag-nofollow',
        label: LABEL,
        value,
        status: 'warn',
        message: 'The X-Robots-Tag header sets nofollow.',
      },
    ]
  }

  return [
    {
      id: 'x-robots-tag-ok',
      label: LABEL,
      value,
      status: 'pass',
      message: 'X-Robots-Tag allows indexing.',
    },
  ]
}
