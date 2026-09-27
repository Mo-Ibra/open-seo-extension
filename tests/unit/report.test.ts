import { describe, expect, it } from 'vitest'

import { buildReport, toCsv, toJson, worstStatus } from '../../lib/crawl/report'
import type { Finding, Status } from '../../lib/types'
import type { PageReport } from '../../lib/crawl/types'

function finding(id: string, status: Status, label = id): Finding {
  return { id, label, value: null, status, message: `${id} message`, fix: `${id} fix` }
}

function page(url: string, findings: Finding[], overrides: Partial<PageReport> = {}): PageReport {
  return {
    url,
    status: 200,
    ok: true,
    finalUrl: url,
    contentType: 'text/html',
    durationMs: 5,
    title: 'Title',
    wordCount: 500,
    findings,
    ...overrides,
  }
}

describe('worstStatus', () => {
  it('picks the most severe finding', () => {
    expect(worstStatus([finding('a', 'pass'), finding('b', 'warn')])).toBe('warn')
    expect(worstStatus([finding('a', 'warn'), finding('b', 'fail')])).toBe('fail')
    expect(worstStatus([])).toBe('pass')
  })
})

describe('buildReport', () => {
  const results: PageReport[] = [
    page('https://a.com/', [finding('title-missing', 'fail'), finding('social-none', 'warn')]),
    page('https://a.com/b', [finding('title-missing', 'fail'), finding('social-none', 'warn')]),
    page('https://a.com/c', [finding('social-none', 'warn')]),
    page('https://a.com/gone', [finding('http-error', 'fail')], { ok: false, status: 404 }),
  ]

  it('groups issues by id and counts affected pages', () => {
    const report = buildReport(results)
    const titleIssue = report.issues.find((issue) => issue.id === 'title-missing')

    expect(titleIssue).toMatchObject({ count: 2, status: 'fail', label: 'title-missing' })
    expect(titleIssue?.urls).toEqual(['https://a.com/', 'https://a.com/b'])
  })

  it('sorts the most widespread issues first', () => {
    const report = buildReport(results)
    expect(report.issues.map((issue) => issue.id)).toEqual([
      'social-none',
      'title-missing',
      'http-error',
    ])
    expect(report.issues.every((issue) => issue.status !== 'pass')).toBe(true)
  })

  it('counts severities and ok pages', () => {
    const report = buildReport(results)
    expect(report.totalPages).toBe(4)
    expect(report.okPages).toBe(3)
    expect(report.fails).toBe(3)
    expect(report.warns).toBe(3)
  })

  it('scores pages by severity and averages them', () => {
    // 100 - 15*1 - 5*1 = 80, twice; 100 - 5 = 95; 100 - 15 = 85.
    expect(buildReport(results).score).toBe(Math.round((80 + 80 + 95 + 85) / 4))
  })

  it('lists the worst pages first, breaking ties by issue counts', () => {
    const report = buildReport(results)
    expect(report.pages.map((page) => page.url)).toEqual([
      'https://a.com/',
      'https://a.com/b',
      'https://a.com/gone',
      'https://a.com/c',
    ])
  })

  it('handles an empty result set', () => {
    const report = buildReport([])
    expect(report).toMatchObject({ totalPages: 0, score: 0, issues: [], pages: [] })
  })
})

describe('exports', () => {
  const results = [
    page('https://a.com/', [finding('title-missing', 'fail')]),
    page('https://a.com/q?a=1&b=2', [], { status: null, ok: false, wordCount: 0, title: 'a, "quoted"' }),
  ]

  it('writes a CSV with a header and one row per page', () => {
    const rows = toCsv('https://a.com', results).split('\n')
    expect(rows[0]).toBe('url,status,title,word_count,issues,fails,warns,issue_ids')
    expect(rows).toHaveLength(3)
    expect(rows[1]).toContain('https://a.com/,200,Title,500,1,1,0,title-missing')
  })

  it('escapes commas and quotes in CSV cells', () => {
    const row = toCsv('https://a.com', results).split('\n')[2]
    expect(row).toContain('"a, ""quoted"""')
  })

  it('leaves the status column empty when the fetch failed', () => {
    const row = toCsv('https://a.com', results).split('\n')[2]
    expect(row.split(',')[1]).toBe('')
  })

  it('writes JSON with the origin and a timestamp', () => {
    const parsed = JSON.parse(toJson('https://a.com', results))
    expect(parsed.origin).toBe('https://a.com')
    expect(parsed.pages).toHaveLength(2)
    expect(typeof parsed.exportedAt).toBe('string')
  })
})
