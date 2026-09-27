import { describe, expect, it } from 'vitest'

import { wordCountCheck } from '../../lib/checks/word-count'
import { makeContext, makePage } from '../helpers/page'

/** Runs the check and indexes the findings by id. */
function findingsFor(wordCount: number, hiddenWordCount = 0) {
  const page = makePage({ wordCount, hiddenWordCount })
  return new Map(wordCountCheck(page, makeContext()).map((f) => [f.id, f]))
}

describe('wordCountCheck', () => {
  it('warns when the page has no text at all', () => {
    const finding = findingsFor(0).get('word-count-empty')
    expect(finding?.status).toBe('warn')
  })

  it('warns below the thin threshold', () => {
    expect(findingsFor(299).get('word-count-thin')?.status).toBe('warn')
  })

  it('passes at the thin threshold and above', () => {
    expect(findingsFor(300).get('word-count-ok')?.status).toBe('pass')
    expect(findingsFor(5_000).get('word-count-ok')?.status).toBe('pass')
  })

  it('never emits both the thin and the ok finding', () => {
    const ids = [...findingsFor(10).keys()]
    expect(ids).toEqual(['word-count-thin'])
  })
})

describe('wordCountCheck: hidden content', () => {
  it('flags a page whose text is mostly behind a click', () => {
    const finding = findingsFor(2_100, 1_850).get('word-count-hidden')
    expect(finding?.status).toBe('warn')
    // 1850 / 2100 = 88.1%
    expect(finding?.message).toContain('88%')
  })

  it('reports the share and both totals', () => {
    const finding = findingsFor(2_100, 1_850).get('word-count-hidden')
    expect(finding?.value).toBe('1,850 words')
    expect(finding?.message).toContain('1,850 words of 2,100 words')
  })

  it('still passes the word count, because the words are there', () => {
    const ids = findingsFor(2_100, 1_850)
    expect(ids.get('word-count-ok')?.status).toBe('pass')
    expect(ids.get('word-count-hidden')?.status).toBe('warn')
  })

  it('stays quiet below the absolute floor', () => {
    // 49 of 100 words hidden clears the share but not the floor.
    expect(findingsFor(100, 49).has('word-count-hidden')).toBe(false)
  })

  it('stays quiet below the share threshold', () => {
    // 100 of 900 clears the floor but is only 11%.
    expect(findingsFor(900, 100).has('word-count-hidden')).toBe(false)
  })

  it('fires exactly at both thresholds', () => {
    expect(findingsFor(200, 50).has('word-count-hidden')).toBe(true)
  })

  it('does not divide by zero on an empty page', () => {
    const findings = wordCountCheck(makePage({ wordCount: 0, hiddenWordCount: 0 }), makeContext())
    expect(findings).toHaveLength(1)
  })

  it('does not flag a stepper page as thin, because the words are counted', () => {
    // A tutorial split into steps: 428 words in total, only ~60 of them on
    // screen. Grading on the visible count would wrongly call this thin.
    const ids = findingsFor(428, 369)
    expect(ids.get('word-count-ok')?.status).toBe('pass')
    expect(ids.get('word-count-thin')).toBeUndefined()
    expect(ids.get('word-count-hidden')?.status).toBe('warn')
  })

  it('tolerates a missing hiddenWordCount, e.g. a scan saved by an older build', () => {
    const page = makePage({ wordCount: 900 })
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    delete (page as Partial<typeof page>).hiddenWordCount
    const findings = wordCountCheck(page, makeContext())
    expect(findings.map((f) => f.id)).toEqual(['word-count-ok'])
  })
})
