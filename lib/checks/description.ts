import { aimHint, isTooLong, isTooShort, DESCRIPTION_BUDGET } from '../limits'
import type { Check } from '../types'

const LABEL = 'Meta description'
const AIM = aimHint(DESCRIPTION_BUDGET)

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
        budget: DESCRIPTION_BUDGET,
        status: 'fail',
        message: 'Missing meta description.',
        fix: 'Add a concise summary with the page\u2019s main keywords and a call to action.',
      },
    ]
  }

  if (isTooShort(value, DESCRIPTION_BUDGET)) {
    return [
      {
        id: 'description-too-short',
        label: LABEL,
        value,
        length,
        budget: DESCRIPTION_BUDGET,
        status: 'warn',
        message: `Description is short (${length} characters). ${AIM}`,
        fix: 'Expand the description; make it compelling.',
      },
    ]
  }

  if (isTooLong(value, DESCRIPTION_BUDGET)) {
    return [
      {
        id: 'description-too-long',
        label: LABEL,
        value,
        length,
        budget: DESCRIPTION_BUDGET,
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
