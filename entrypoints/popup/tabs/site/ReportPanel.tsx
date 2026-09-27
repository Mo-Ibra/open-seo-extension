import { useMemo, useState } from 'react'

import { buildReport, toCsv, toJson } from '../../../../lib/crawl/report'
import type { SiteScanState } from '../../../../lib/crawl/types'
import { cn } from '../../shared/cn'
import { EmptyState } from '../../shared/EmptyState'
import { FindingCard } from './FindingCard'
import { Icon } from '../../shared/Icon'
import { ScoreRing } from './ScoreRing'
import { download, host } from './funcs'

type Filter = 'issues' | 'fail' | 'warn' | 'pass' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'issues', label: 'Needs work' },
  { id: 'fail', label: 'Fails' },
  { id: 'warn', label: 'Warnings' },
  { id: 'pass', label: 'Clean' },
  { id: 'all', label: 'All' },
]

const SEVERITY_BORDER = {
  pass: 'border-l-pass',
  warn: 'border-l-warn',
  fail: 'border-l-fail',
} as const

const SEVERITY_ICON = {
  pass: 'bg-pass-soft text-pass',
  warn: 'bg-warn-soft text-warn',
  fail: 'bg-fail-soft text-fail',
} as const

const PAGE_DOT = {
  pass: 'bg-pass',
  warn: 'bg-warn',
  fail: 'bg-fail',
} as const

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
    <div className="flex flex-col gap-2.5">
      <section className="flex items-center gap-3.5 rounded-lg border border-line bg-linear-to-b from-surface to-canvas px-3 py-3 shadow-soft">
        <ScoreRing score={report.score} />
        <div className="flex flex-col gap-0.5 text-xs text-muted">
          <div>
            <b className="text-[13px] text-ink">{report.totalPages}</b> pages scanned
          </div>
          <div>
            <b className="text-[13px] text-fail">{report.fails}</b> failures
          </div>
          <div>
            <b className="text-[13px] text-warn">{report.warns}</b> warnings
          </div>
          <div className="text-[11px]">
            {duration ? `${duration}s` : ''} {state.skipped > 0 && `· ${state.skipped} skipped`}
          </div>
        </div>
      </section>

      <div className="flex gap-1.5">
        <button
          className="btn flex-1 border-line-strong bg-surface text-ink-soft hover:bg-surface-3"
          onClick={() => download(`${host(state.origin)}.csv`, toCsv(state.origin, state.results), 'text/csv')}
        >
          <Icon name="download" size={13} /> CSV
        </button>
        <button
          className="btn flex-1 border-line-strong bg-surface text-ink-soft hover:bg-surface-3"
          onClick={() => download(`${host(state.origin)}.json`, toJson(state.origin, state.results), 'application/json')}
        >
          <Icon name="download" size={13} /> JSON
        </button>
        <button className="btn flex-1 border-line-strong bg-surface text-ink-soft hover:bg-surface-3" onClick={onRestart}>
          <Icon name="refresh" size={13} /> New scan
        </button>
      </div>

      <h3 className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
        Issues by type
        <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10.5px] font-semibold text-muted">
          {report.issues.length}
        </span>
      </h3>

      {report.issues.length === 0 ? (
        <EmptyState icon="check" title="Nothing to fix" hint="Every scanned page passed its checks." />
      ) : (
        <ul className="flex list-none flex-col gap-1.25">
          {report.issues.map((issue) => (
            <li
              key={issue.id}
              className={cn(
                'rounded-md border border-line border-l-[3px] bg-surface shadow-soft transition-shadow duration-150 hover:shadow-lift',
                SEVERITY_BORDER[issue.status]
              )}
            >
              <button className="flex w-full cursor-pointer items-center gap-1.5 px-2 py-2 text-left" onClick={() => onToggleIssue(issue.id)}>
                <span
                  className={cn('grid size-4 shrink-0 place-items-center rounded-full', SEVERITY_ICON[issue.status])}
                  aria-hidden="true"
                >
                  <Icon name={issue.status === 'fail' ? 'close' : 'alert'} size={11} />
                </span>
                <strong className="text-[12.5px]">{issue.label}</strong>
                <span className="ml-auto rounded-full bg-surface-2 px-1.5 py-px text-[10.5px] font-semibold text-muted">
                  {issue.count}
                </span>
                <Icon
                  name="chevron"
                  size={13}
                  className={cn('text-muted transition-transform duration-200', openIssue === issue.id && 'rotate-180')}
                />
              </button>
              <div className="pr-2.5 pb-2.25 pl-8">
                <p className="text-[11.5px] text-ink-soft">{issue.message}</p>
                {issue.fix && (
                  <p className="mt-1.5 flex gap-1.5 text-[11px] text-accent">
                    <Icon name="sparkle" size={12} className="mt-0.5" />
                    <span>{issue.fix}</span>
                  </p>
                )}
                {openIssue === issue.id && (
                  <ul className="mt-1.5 max-h-[130px] list-disc overflow-auto rounded-sm bg-surface-2 py-1.5 pr-2 pl-5 font-mono text-[10.5px] text-muted">
                    {issue.urls.slice(0, 30).map((url) => (
                      <li key={url} className="break-all">
                        {url.replace(/^https?:\/\//, '')}
                      </li>
                    ))}
                    {issue.urls.length > 30 && <li>…and {issue.urls.length - 30} more</li>}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
        Pages
        <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10.5px] font-semibold text-muted">
          {pages.length}
        </span>
      </h3>

      <div className="no-scrollbar flex gap-0.5 overflow-x-auto rounded-md border border-line bg-surface-2 p-0.5" role="tablist" aria-label="Filter pages">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            role="tab"
            aria-selected={filter === option.id}
            className={cn(
              'flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-[11.5px] whitespace-nowrap transition-colors duration-150',
              filter === option.id ? 'bg-surface font-semibold text-accent shadow-soft' : 'text-muted hover:text-ink'
            )}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 rounded-sm border border-line bg-surface px-2 text-muted focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
        <Icon name="search" size={13} />
        <input
          className="w-full min-w-0 flex-1 bg-transparent py-1.5 text-xs text-ink outline-none"
          type="search"
          placeholder="Filter pages\u2026"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {pages.length === 0 ? (
        <p className="text-xs text-muted">No pages match this filter.</p>
      ) : (
        <ul className="flex list-none flex-col gap-1.25">
          {pages.map((page) => (
            <li
              key={page.url}
              className={cn(
                'rounded-md border border-line border-l-[3px] bg-surface shadow-soft transition-shadow duration-150 hover:shadow-lift',
                SEVERITY_BORDER[page.worst]
              )}
            >
              <button
                className="flex w-full cursor-pointer items-center gap-1.5 px-2 py-2 text-left"
                onClick={() => setOpenPage((current) => (current === page.url ? null : page.url))}
              >
                <span
                  className={cn('size-[7px] shrink-0 rounded-full', PAGE_DOT[page.worst])}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px]" title={page.url}>
                  {page.url.replace(/^https?:\/\//, '')}
                </span>
                <span className="text-[10.5px] whitespace-nowrap text-muted">
                  {page.status ?? '—'} · {page.wordCount}w
                </span>
                <span className="flex gap-1 text-[10.5px]">
                  {page.fail > 0 && (
                    <b className="min-w-[15px] rounded-full bg-fail-soft px-1 text-center text-[10px] text-fail">
                      {page.fail}
                    </b>
                  )}
                  {page.warn > 0 && (
                    <b className="min-w-[15px] rounded-full bg-warn-soft px-1 text-center text-[10px] text-warn">
                      {page.warn}
                    </b>
                  )}
                </span>
                <Icon
                  name="chevron"
                  size={13}
                  className={cn('text-muted transition-transform duration-200', openPage === page.url && 'rotate-180')}
                />
              </button>
              {openPage === page.url && (
                <div className="flex flex-col gap-1.5 border-t border-dashed border-line p-2">
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