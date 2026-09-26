import { useMemo, useState } from 'react'

import { buildReport, toCsv, toJson } from '../../lib/crawl/report'
import type { SiteScanState } from '../../lib/crawl/types'
import { FindingCard } from './FindingCard'

type Filter = 'issues' | 'fail' | 'warn' | 'pass' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'issues', label: 'With issues' },
  { id: 'fail', label: 'Fails' },
  { id: 'warn', label: 'Warnings' },
  { id: 'pass', label: 'Clean' },
  { id: 'all', label: 'All' },
]

export function ReportPanel({
  state,
  openIssue,
  onToggleIssue,
  onRestart,
}: {
  state: SiteScanState
  openIssue: string | null
  onToggleIssue: (id: string) => void
  onRestart: () => void
}) {
  const [filter, setFilter] = useState<Filter>('issues')
  const [query, setQuery] = useState('')
  const [openPage, setOpenPage] = useState<string | null>(null)

  const report = useMemo(() => buildReport(state.results), [state.results])
  const byUrl = useMemo(
    () => new Map(state.results.map((result) => [result.url, result])),
    [state.results]
  )

  const pages = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return report.pages.filter((page) => {
      if (needle && !page.url.toLowerCase().includes(needle)) return false
      if (filter === 'fail') return page.fail > 0
      if (filter === 'warn') return page.warn > 0
      if (filter === 'pass') return page.fail === 0 && page.warn === 0
      if (filter === 'issues') return page.fail > 0 || page.warn > 0
      return true
    })
  }, [filter, query, report.pages])

  const duration =
    state.startedAt && state.finishedAt
      ? Math.max(1, Math.round((state.finishedAt - state.startedAt) / 1000))
      : null

  return (
    <div className="report">
      <div className="report-head">
        <div className="score">
          <div className="score-value">{report.score}</div>
          <div className="score-label">score</div>
        </div>
        <div className="report-stats">
          <div>
            <b>{report.totalPages}</b> pages
          </div>
          <div>
            <b className="fail">{report.fails}</b> failures
          </div>
          <div>
            <b className="warn">{report.warns}</b> warnings
          </div>
          {duration && <div>{duration}s</div>}
          {state.skipped > 0 && <div>{state.skipped} skipped</div>}
        </div>
      </div>

      <div className="export-row">
        <button className="ghost" onClick={() => download(`${host(state.origin)}.csv`, toCsv(state.origin, state.results), 'text/csv')}>
          Export CSV
        </button>
        <button className="ghost" onClick={() => download(`${host(state.origin)}.json`, toJson(state.origin, state.results), 'application/json')}>
          Export JSON
        </button>
        <button className="ghost" onClick={onRestart}>
          New scan
        </button>
      </div>

      <h3 className="report-title">Issues by type</h3>
      {report.issues.length === 0 && <p className="hint">Nothing to fix. Nice.</p>}
      <ul className="issue-list">
        {report.issues.map((issue) => (
          <li key={issue.id} className={`issue ${issue.status}`}>
            <button className="issue-head" onClick={() => onToggleIssue(issue.id)}>
              <span className="dot" aria-hidden="true" />
              <strong>{issue.label}</strong>
              <span className="issue-count">{issue.count} pages</span>
            </button>
            <div className="issue-message">{issue.message}</div>
            {issue.fix && <div className="issue-fix">Fix: {issue.fix}</div>}
            {openIssue === issue.id && (
              <ul className="issue-urls">
                {issue.urls.slice(0, 25).map((url) => (
                  <li key={url} title={url}>
                    {url.replace(/^https?:\/\//, '')}
                  </li>
                ))}
                {issue.urls.length > 25 && <li className="hint">…and {issue.urls.length - 25} more</li>}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <h3 className="report-title">Pages</h3>
      <div className="filter-row">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            className={filter === option.id ? 'preset active' : 'preset'}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <input
        className="search"
        type="search"
        placeholder="Filter pages…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <ul className="page-list">
        {pages.map((page) => (
          <li key={page.url} className={`page ${page.worst}`}>
            <button className="page-head" onClick={() => setOpenPage((current) => (current === page.url ? null : page.url))}>
              <span className="dot" aria-hidden="true" />
              <span className="page-url" title={page.url}>
                {page.url.replace(/^https?:\/\//, '')}
              </span>
              <span className="page-meta">
                {page.status ?? '—'} · {page.wordCount}w
                {page.fail > 0 && <b className="fail"> · {page.fail}</b>}
                {page.warn > 0 && <b className="warn"> · {page.warn}</b>}
              </span>
            </button>
            {openPage === page.url && (
              <div className="page-body">
                {(byUrl.get(page.url)?.findings ?? []).map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {pages.length === 0 && <p className="hint">No pages match this filter.</p>}
    </div>
  )
}

function host(origin: string): string {
  return origin.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '-') || 'site'
}

function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
