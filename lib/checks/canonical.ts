import type { Check } from '../types'

const LABEL = 'Canonical'

function stripHash(url: string): string {
  const index = url.indexOf('#')
  return index === -1 ? url : url.slice(0, index)
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export const canonicalCheck: Check = (page) => {
  const value = page.canonical || null

  if (!value) {
    return [
      {
        id: 'canonical-missing',
        label: LABEL,
        value: null,
        status: 'warn',
        message: 'No canonical link found.',
        fix: 'Add <link rel="canonical" href="\u2026"> pointing to the preferred URL.',
      },
    ]
  }

  if (stripHash(value) === stripHash(page.url)) {
    return [
      {
        id: 'canonical-self',
        label: LABEL,
        value,
        status: 'pass',
        message: 'Self-referencing canonical.',
      },
    ]
  }

  const isCrossOrigin = safeOrigin(value) !== safeOrigin(page.url)

  return [
    {
      id: isCrossOrigin ? 'canonical-cross-origin' : 'canonical-different',
      label: LABEL,
      value,
      status: 'warn',
      message: isCrossOrigin
        ? 'Canonical points to a different website.'
        : 'Canonical points to a different URL on this site.',
      fix: 'Confirm this is intentional (duplicates, pagination, or syndicated content).',
    },
  ]
}
