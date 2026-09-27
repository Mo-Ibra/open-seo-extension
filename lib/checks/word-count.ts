import type { Check, Finding } from '../types'

const LABEL = 'Word count'
/** Below this, a content page is usually considered thin. */
const THIN_WORDS = 300
const WORDS_PER_MINUTE = 200

/**
 * Share of the page's text that a reader cannot see without interacting.
 *
 * Search engines index hidden text, so this is not a "your content is invisible"
 * error. It is a "most of your content needs a click" risk, which matters for
 * anyone skimming on a phone and for anything that reads the DOM linearly.
 */
const HIDDEN_SHARE = 0.25

/**
 * Absolute floor for the same warning.
 *
 * A page with 30 words behind a disclosure does not have a hidden-content
 * problem; without this, a genuinely thin page would report two issues for one
 * underlying cause.
 */
const HIDDEN_MIN_WORDS = 50

const format = (words: number): string => `${words.toLocaleString('en-US')} words`

export const wordCountCheck: Check = (page): Finding[] => {
  const { wordCount, hiddenWordCount = 0 } = page
  const findings: Finding[] = []
  const readingTime = `about ${Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE))} min read`
  const value = format(wordCount)

  if (wordCount === 0) {
    findings.push({
      id: 'word-count-empty',
      label: LABEL,
      value: '0 words',
      status: 'warn',
      message: 'No readable text found in the page content.',
      fix: 'If the content loads after the page renders, check it in the browser; otherwise add real, readable text.',
    })
  } else if (wordCount < THIN_WORDS) {
    findings.push({
      id: 'word-count-thin',
      label: LABEL,
      value,
      status: 'warn',
      message: `${value} (${readingTime}) \u2014 thin compared with typical content pages (${THIN_WORDS}+).`,
      fix: 'Expand the page with useful, original detail that answers the searcher\u2019s intent.',
    })
  } else {
    findings.push({
      id: 'word-count-ok',
      label: LABEL,
      value,
      status: 'pass',
      message: `${value} \u00b7 ${readingTime} at ${WORDS_PER_MINUTE} words per minute.`,
    })
  }

  // Graded on the total, never on what happens to be on screen: a stepper or a
  // tabbed page would otherwise be permanently flagged as thin, which is a
  // false positive on a very common pattern. Reported as its own finding
  // because the words are there — the problem is where they sit.
  //
  // The `?? 0` default keeps a scan persisted by an older build, which predates
  // the field, from producing NaN.
  if (hiddenWordCount >= HIDDEN_MIN_WORDS && hiddenWordCount / wordCount >= HIDDEN_SHARE) {
    const percent = Math.round((hiddenWordCount / wordCount) * 100)
    findings.push({
      id: 'word-count-hidden',
      label: 'Hidden content',
      value: format(hiddenWordCount),
      status: 'warn',
      message: `${percent}% of this page\u2019s text (${format(hiddenWordCount)} of ${value}) is hidden until the reader clicks, expands or steps through it.`,
      fix: 'Search engines can read it, but visitors skim. Make each hidden section reachable and linkable, and put the key answer in the visible text too.',
    })
  }

  return findings
}
