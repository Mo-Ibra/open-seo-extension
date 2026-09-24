import type { Check } from '../types'

// Rough guidance based on search-result truncation, measured in characters.
// A pixel-width measurement is more accurate and can replace this later.
const MIN_LENGTH = 30
const MAX_LENGTH = 60

const LABEL = 'Title'
const AIM = `Aim for ${MIN_LENGTH}\u2013${MAX_LENGTH} characters.`

export const titleCheck: Check = (page) => {
  const value = page.title || null
  const length = value?.length ?? 0

  if (!value) {
    return [
      {
        id: 'title-missing',
        label: LABEL,
        value: null,
        length,
        status: 'fail',
        message: 'Missing <title> tag.',
        fix: 'Add a unique, descriptive <title>.',
      },
    ]
  }

  if (length < MIN_LENGTH) {
    return [
      {
        id: 'title-too-short',
        label: LABEL,
        value,
        length,
        status: 'warn',
        message: `Title is short (${length} characters). ${AIM}`,
        fix: 'Add more descriptive words to the title.',
      },
    ]
  }

  if (length > MAX_LENGTH) {
    return [
      {
        id: 'title-too-long',
        label: LABEL,
        value,
        length,
        status: 'warn',
        message: `Title is long (${length} characters) and may be truncated. ${AIM}`,
        fix: 'Shorten the title; front-load the important words.',
      },
    ]
  }

  return [
    {
      id: 'title-ok',
      label: LABEL,
      value,
      length,
      status: 'pass',
      message: `Good title length (${length} characters).`,
    },
  ]
}
