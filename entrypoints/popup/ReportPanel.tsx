import { useMemo, useState } from 'react'

import { buildReport, toCsv, toJson } from '../../lib/crawl/report'
import type { SiteScanState } from '../../lib/crawl/types'
import { EmptyState } from './EmptyState'
import { FindingCard } from './FindingCard'
import { Icon } from './Icon'
import { ScoreRing } from './ScoreRing'

type Filter = 'issues' | 'fail' | 'warn' | 'pass' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'issues', label: 'Needs work' },
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
  const byUrl = useMemo(() => new Map(state.results.map((result) => [result.url, result])), [state.results])

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
      <section className="report-head">
        <ScoreRing score={report.score} />
        <div className="report-stats">
          <div className="stat-line">
            <b>{report.totalPages}</b> pages scanned
          </div>
          <div className="stat-line fail">
            <b>{report.fails}</b> failures
          </div>
          <div className="stat-line warn">
            <b>{report.warns}</b> warnings
          </div>
          <div className="stat-line muted">
            {duration ? `${duration}s` : ''} {state.skipped > 0 && `· ${state.skipped} skipped`}
          </div>
        </div>
      </section>

      <div className="export-row">
        <button
          className="btn subtle"
          onClick={() =>
            download(`${host(state.origin)}.csv`, toCsv(state.origin, state.results), 'text/csv')
          }
        >
          <Icon name="download" size={13} /> CSV
        </button>
        <button
          className="btn subtle"
          onClick={() =>
            download(`${host(state.origin)}.json`, toJson(state.origin, state.results), 'application/json')
          }
        >
          <Icon name="download" size={13} /> JSON
        </button>
        <button className="btn subtle" onClick={onRestart}>
          <Icon name="refresh" size={13} /> New scan
        </button>
      </div>

      <h3 className="section-title">
        Issues by type <span className="badge">{report.issues.length}</span>
      </h3>

      {report.issues.length === 0 ? (
        <EmptyState icon="check" title="Nothing to fix" hint="Every scanned page passed its checks." />
      ) : (
        <ul className="issue-list">
          {report.issues.map((issue) => (
            <li key={issue.id} className={`issue ${issue.status}`}>
              <button className="issue-head" onClick={() => onToggleIssue(issue.id)}>
                <span className="issue-icon">
                  <Icon name={issue.status === 'fail' ? 'close' : 'alert'} size={11} />
                </span>
                <strong>{issue.label}</strong>
                <span className="issue-count">{issue.count}</span>
                <Icon name="chevron" size={13} className={openIssue === issue.id ? 'chevron open' : 'chevron'} />
              </button>
              <div className="issue-body">
                <p className="issue-message">{issue.message}</p>
                {issue.fix && (
                  <p className="issue-fix">
                    <Icon name="sparkle" size={12} />
                    <span>{issue.fix}</span>
                  </p>
                )}
                {openIssue === issue.id && (
                  <ul className="issue-urls">
                    {issue.urls.slice(0, 30).map((url) => (
                      <li key={url} title={url}>
                        {url.replace(/^https?:\/\//, '')}
                      </li>
                    ))}
                    {issue.urls.length > 30 && <li className="hint">…and {issue.urls.length - 30} more</li>}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="section-title">
        Pages <span className="badge">{pages.length}</span>
      </h3>

      <div className="segmented" role="tablist" aria-label="Filter pages">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            role="tab"
            aria-selected={filter === option.id}
            className={filter === option.id ? 'seg-btn active' : 'seg-btn'}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="search-wrap">
        <Icon name="search" size={13} />
        <input
          className="search"
          type="search"
          placeholder="Filter pages\u2026"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {pages.length === 0 ? (
        <p className="hint">No pages match this filter.</p>
      ) : (
        <ul className="page-list">
          {pages.map((page) => (
            <li key={page.url} className={`page ${page.worst}`}>
              <button className="page-head" onClick={() => setOpenPage((current) => (current === page.url ? null : page.url))}>
                <span className="page-status" aria-hidden="true" />
                <span className="page-url" title={page.url}>
                  {page.url.replace(/^https?:\/\//, '')}
                </span>
                <span className="page-meta">
                  {page.status ?? '—'} · {page.wordCount}w
                </span>
                <span className="page-counts">
                  {page.fail > 0 && <b className="fail">{page.fail}</b>}
                  {page.warn > 0 && <b className="warn">{page.warn}</b>}
                </span>
                <Icon name="chevron" size={13} className={openPage === page.url ? 'chevron open' : 'chevron'} />
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
      )}
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
