import { aimHint, isTooLong, isTooShort, TITLE_BUDGET } from '../limits'
import type { Check } from '../types'

const LABEL = 'Title'
const AIM = aimHint(TITLE_BUDGET)

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
        budget: TITLE_BUDGET,
        status: 'fail',
        message: 'Missing <title> tag.',
        fix: 'Add a unique, descriptive <title>.',
      },
    ]
  }

  if (isTooShort(value, TITLE_BUDGET)) {
    return [
      {
        id: 'title-too-short',
        label: LABEL,
        value,
        length,
        budget: TITLE_BUDGET,
        status: 'warn',
        message: `Title is short (${length} characters). ${AIM}`,
        fix: 'Add more descriptive words to the title.',
      },
    ]
  }

  if (isTooLong(value, TITLE_BUDGET)) {
    return [
      {
        id: 'title-too-long',
        label: LABEL,
        value,
        length,
        budget: TITLE_BUDGET,
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
