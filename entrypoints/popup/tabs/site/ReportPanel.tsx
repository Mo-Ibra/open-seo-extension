import { useMemo, useState } from 'react'

import { buildReport, toCsv, toJson } from '../../../../lib/crawl/report'
import type { SiteScanState } from '../../../../lib/crawl/types'
import { ISSUE_URL_PREVIEW_LIMIT } from '../../constants/site'
import { TONE } from '../../constants/tone'
import { cn } from '../../shared/cn'
import { EmptyState } from '../../shared/EmptyState'
import { FilterTabs, type FilterOption } from '../../shared/FilterTabs'
import { Icon } from '../../shared/Icon'
import { SearchInput } from '../../shared/SearchInput'
import { SectionTitle } from '../../shared/SectionTitle'
import { downloadTextFile } from '../../utils/download'
import { formatCount } from '../../utils/format'
import { hostSlug, stripScheme } from '../../utils/url'
import { FindingCard } from './FindingCard'
import { ScoreRing } from './ScoreRing'

/** Which pages of the report to list. */
type Filter = 'issues' | 'fail' | 'warn' | 'pass' | 'all'

const FILTERS: FilterOption<Filter>[] = [
  { id: 'issues', label: 'Needs work' },
  { id: 'fail', label: 'Fails' },
  { id: 'warn', label: 'Warnings' },
  { id: 'pass', label: 'Clean' },
  { id: 'all', label: 'All' },
]

/** Icons for a severity badge. `close` is a hard fail, `alert` a warning. */
const SEVERITY_ICON = {
  pass: 'check',
  warn: 'alert',
  fail: 'close',
} as const

/**
 * The finished site audit: score, exports, issues grouped by type, and every
 * scanned page.
 *
 * The report is derived, never stored: `buildReport` runs over the raw results
 * on render (memoised on `state.results`), so the popup does not have to keep a
 * second copy of the data in sync with the worker's state.
 */
export function ReportPanel({
  state,
  openIssue,
  onToggleIssue,
  onRestart,
}: {
  state: SiteScanState
  /** Id of the expanded issue, or `null`. Lifted so the row can be controlled. */
  openIssue: string | null
  onToggleIssue: (id: string) => void
  onRestart: () => void
}) {
  const [filter, setFilter] = useState<Filter>('issues')
  const [query, setQuery] = useState('')
  const [openPage, setOpenPage] = useState<string | null>(null)

  const report = useMemo(() => buildReport(state.results), [state.results])
  // O(1) lookup for a page's findings when its row is expanded. Built once per
  // results change instead of `find`-ing inside the list on every render.
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

  // Wall-clock seconds, floored at 1 so a sub-second scan does not read "0s".
  const duration =
    state.startedAt && state.finishedAt
      ? Math.max(1, Math.round((state.finishedAt - state.startedAt) / 1000))
      : null

  // Exports are named after the host so a user who downloads several reports
  // can tell them apart in their downloads folder.
  const exportBase = hostSlug(state.origin)

  return (
    <div className="flex flex-col gap-2.5">
      <section className="flex items-center gap-3.5 rounded-lg border border-line bg-linear-to-b from-surface to-canvas px-3 py-3 shadow-soft">
        <ScoreRing score={report.score} />
        <div className="flex flex-col gap-0.5 text-xs text-muted">
          <div>
            <b className="text-[13px] text-ink">{formatCount(report.totalPages)}</b> pages scanned
          </div>
          <div>
            <b className="text-[13px] text-fail">{formatCount(report.fails)}</b> failures
          </div>
          <div>
            <b className="text-[13px] text-warn">{formatCount(report.warns)}</b> warnings
          </div>
          <div className="text-[11px]">
            {duration ? `${duration}s` : ''} {state.skipped > 0 && `· ${formatCount(state.skipped)} skipped`}
          </div>
        </div>
      </section>

      <div className="flex gap-1.5">
        <ExportButton
          label="CSV"
          filename={`${exportBase}.csv`}
          onClick={() => downloadTextFile(`${exportBase}.csv`, toCsv(state.origin, state.results), 'text/csv')}
        />
        <ExportButton
          label="JSON"
          filename={`${exportBase}.json`}
          onClick={() => downloadTextFile(`${exportBase}.json`, toJson(state.origin, state.results), 'application/json')}
        />
        <button className="btn flex-1 border-line-strong bg-surface text-ink-soft hover:bg-surface-3" onClick={onRestart}>
          <Icon name="refresh" size={13} /> New scan
        </button>
      </div>

      <SectionTitle count={report.issues.length}>Issues by type</SectionTitle>

      {report.issues.length === 0 ? (
        <EmptyState icon="check" title="Nothing to fix" hint="Every scanned page passed its checks." />
      ) : (
        <ul className="flex list-none flex-col gap-1.25">
          {report.issues.map((issue) => {
            const open = openIssue === issue.id
            const hidden = issue.urls.length - ISSUE_URL_PREVIEW_LIMIT
            return (
              <li
                key={issue.id}
                className={cn(
                  'rounded-md border border-line border-l-[3px] bg-surface shadow-soft transition-shadow duration-150 hover:shadow-lift',
                  TONE.stripe[issue.status]
                )}
              >
                <button
                  className="flex w-full cursor-pointer items-center gap-1.5 px-2 py-2 text-left"
                  aria-expanded={open}
                  onClick={() => onToggleIssue(issue.id)}
                >
                  <span
                    className={cn('grid size-4 shrink-0 place-items-center rounded-full', TONE.icon[issue.status])}
                    aria-hidden="true"
                  >
                    <Icon name={SEVERITY_ICON[issue.status]} size={11} />
                  </span>
                  <strong className="text-[12.5px]">{issue.label}</strong>
                  <span className="ml-auto rounded-full bg-surface-2 px-1.5 py-px text-[10.5px] font-semibold text-muted">
                    {formatCount(issue.count)}
                  </span>
                  <Icon
                    name="chevron"
                    size={13}
                    className={cn('text-muted transition-transform duration-200', open && 'rotate-180')}
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
                  {open && (
                    <ul className="mt-1.5 max-h-[130px] list-disc overflow-auto rounded-sm bg-surface-2 py-1.5 pr-2 pl-5 font-mono text-[10.5px] text-muted">
                      {issue.urls.slice(0, ISSUE_URL_PREVIEW_LIMIT).map((url) => (
                        <li key={url} className="break-all">
                          {stripScheme(url)}
                        </li>
                      ))}
                      {/* The full list is in the export; the popup stays readable. */}
                      {hidden > 0 && <li>…and {formatCount(hidden)} more</li>}
                    </ul>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <SectionTitle count={pages.length}>Pages</SectionTitle>

      <FilterTabs options={FILTERS} value={filter} onChange={setFilter} label="Filter pages" />

      <SearchInput value={query} onChange={setQuery} placeholder="Filter pages…" />

      {pages.length === 0 ? (
        <p className="text-xs text-muted">No pages match this filter.</p>
      ) : (
        <ul className="flex list-none flex-col gap-1.25">
          {pages.map((page) => {
            const open = openPage === page.url
            return (
              <li
                key={page.url}
                className={cn(
                  'rounded-md border border-line border-l-[3px] bg-surface shadow-soft transition-shadow duration-150 hover:shadow-lift',
                  TONE.stripe[page.worst]
                )}
              >
                <button
                  className="flex w-full cursor-pointer items-center gap-1.5 px-2 py-2 text-left"
                  aria-expanded={open}
                  onClick={() => setOpenPage((current) => (current === page.url ? null : page.url))}
                >
                  <span
                    className={cn('size-[7px] shrink-0 rounded-full', TONE.fill[page.worst])}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px]" title={page.url}>
                    {stripScheme(page.url)}
                  </span>
                  <span className="text-[10.5px] whitespace-nowrap text-muted">
                    {page.status ?? '—'} · {formatCount(page.wordCount)}w
                  </span>
                  {page.fail > 0 && <CountBadge tone="fail" value={page.fail} />}
                  {page.warn > 0 && <CountBadge tone="warn" value={page.warn} />}
                  <Icon
                    name="chevron"
                    size={13}
                    className={cn('text-muted transition-transform duration-200', open && 'rotate-180')}
                  />
                </button>
                {open && (
                  <div className="flex flex-col gap-1.5 border-t border-dashed border-line p-2">
                    {(byUrl.get(page.url)?.findings ?? []).map((finding) => (
                      <FindingCard key={finding.id} finding={finding} />
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** How many failures or warnings one page has, as a pill in its row. */
function CountBadge({ tone, value }: { tone: 'fail' | 'warn'; value: number }) {
  return (
    <b className={cn('min-w-[15px] rounded-full px-1 text-center text-[10px]', TONE.chip[tone])}>{value}</b>
  )
}

/** A download button for one of the report exports. */
function ExportButton({ label, filename, onClick }: { label: string; filename: string; onClick: () => void }) {
  return (
    <button
      className="btn flex-1 border-line-strong bg-surface text-ink-soft hover:bg-surface-3"
      // The filename is not visible, so surface it for screen readers and for
      // the browser's own "save as" dialog.
      title={`Download ${filename}`}
      aria-label={`Download ${filename}`}
      onClick={onClick}
    >
      <Icon name="download" size={13} /> {label}
    </button>
  )
}
