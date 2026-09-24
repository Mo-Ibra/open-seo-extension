import type { Check } from '../types'

// Rough guidance based on search-result truncation, measured in characters.
const MIN_LENGTH = 70
const MAX_LENGTH = 160

const LABEL = 'Meta description'
const AIM = `Aim for ${MIN_LENGTH}\u2013${MAX_LENGTH} characters.`

export const descriptionCheck: Check = (page) => {
  const value = page.description || null
  const length = value?.length ?? 0

  if (!value) {
    return [
      {
        id: 'description-missing',
        label: LABEL,
        value: null,
        length,
        status: 'fail',
        message: 'Missing meta description.',
        fix: 'Add a concise summary with the page\u2019s main keywords and a call to action.',
      },
    ]
  }

  if (length < MIN_LENGTH) {
    return [
      {
        id: 'description-too-short',
        label: LABEL,
        value,
        length,
        status: 'warn',
        message: `Description is short (${length} characters). ${AIM}`,
        fix: 'Expand the description; make it compelling.',
      },
    ]
  }

  if (length > MAX_LENGTH) {
    return [
      {
        id: 'description-too-long',
        label: LABEL,
        value,
        length,
        status: 'warn',
        message: `Description is long (${length} characters) and may be truncated. ${AIM}`,
        fix: 'Shorten the description; keep the key message first.',
      },
    ]
  }

  return [
    {
      id: 'description-ok',
      label: LABEL,
      value,
      length,
      status: 'pass',
      message: `Good description length (${length} characters).`,
    },
  ]
}
