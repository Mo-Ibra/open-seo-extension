import type { Check, Finding } from '../types'

const LABEL = 'Headings'
const OUTLINE_LIMIT = 20

export const headingsCheck: Check = (page) => {
  const { headings } = page

  if (headings.length === 0) {
    return [
      {
        id: 'headings-none',
        label: LABEL,
        value: null,
        status: 'warn',
        message: 'No headings found on the page.',
        fix: 'Use a logical heading structure: one H1 for the main title, H2/H3 for sections.',
      },
    ]
  }

  const outline = headings
    .slice(0, OUTLINE_LIMIT)
    .map((heading) => `H${heading.level} \u00b7 ${heading.text || '(empty)'}`)
  if (headings.length > OUTLINE_LIMIT) {
    outline.push(`\u2026and ${headings.length - OUTLINE_LIMIT} more`)
  }

  const h1Count = headings.filter((heading) => heading.level === 1).length

  const problems: string[] = []
  if (h1Count === 0) {
    problems.push('no H1')
  } else if (h1Count > 1) {
    problems.push(`${h1Count} H1 headings`)
  }

  let previousLevel = 0
  for (const heading of headings) {
    if (previousLevel > 0 && heading.level > previousLevel + 1) {
      problems.push(`skipped level (H${previousLevel} \u2192 H${heading.level})`)
      break
    }
    previousLevel = heading.level
  }

  if (problems.length > 0) {
    return [
      {
        id: 'headings-structure',
        label: LABEL,
        value: `${headings.length} headings`,
        // A missing H1 is the more serious problem.
        status: h1Count === 0 ? 'fail' : 'warn',
        message: `Issues: ${problems.join(', ')}.`,
        fix: 'Use a single H1 and nest headings (H2, H3, \u2026) in order without skipping levels.',
        items: outline,
      },
    ]
  }

  return [
    {
      id: 'headings-ok',
      label: LABEL,
      value: `${headings.length} headings`,
      status: 'pass',
      message: `Good structure: one H1, no skipped levels.`,
      items: outline,
    },
  ]
}
