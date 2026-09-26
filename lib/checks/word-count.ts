import type { Check, Finding } from '../types'

const LABEL = 'Word count'
/** Below this, a content page is usually considered thin. */
const THIN_WORDS = 300
const WORDS_PER_MINUTE = 200

export const wordCountCheck: Check = (page): Finding[] => {
  const { wordCount } = page

  if (wordCount === 0) {
    return [
      {
        id: 'word-count-empty',
        label: LABEL,
        value: '0 words',
        status: 'warn',
        message: 'No visible text found on the page.',
        fix: 'If the content loads after the page renders, check it in the browser; otherwise add real, readable text.',
      },
    ]
  }

  const value = `${wordCount.toLocaleString('en-US')} words`
  const readingTime = `about ${Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE))} min read`

  if (wordCount < THIN_WORDS) {
    return [
      {
        id: 'word-count-thin',
        label: LABEL,
        value,
        status: 'warn',
        message: `${value} (${readingTime}) \u2014 thin compared with typical content pages (${THIN_WORDS}+).`,
        fix: 'Expand the page with useful, original detail that answers the searcher\u2019s intent.',
      },
    ]
  }

  return [
    {
      id: 'word-count-ok',
      label: LABEL,
      value,
      status: 'pass',
      message: `${value} \u00b7 ${readingTime} at ${WORDS_PER_MINUTE} words per minute.`,
    },
  ]
}
