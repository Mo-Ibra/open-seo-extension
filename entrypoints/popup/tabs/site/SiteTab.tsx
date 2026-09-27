import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { browser } from 'wxt/browser'

import { isPersistent, loadState } from '../../../../lib/crawl/store'
import {
  createIdleState,
  type DiscoverySource,
  type SiteRequest,
  type SiteScanState,
} from '../../../../lib/crawl/types'
import { getSiteStateWithTimeout, onSiteState, sendSiteRequest } from '../../../../lib/platform/messaging'
import { DISCOVERY_SOURCE, SCAN_PRESETS, SCAN_STEPS, URL_PAGE_SIZE } from '../../constants/site'
import { NEUTRAL_CHIP, TONE } from '../../constants/tone'
import { cn } from '../../shared/cn'
import { EmptyState } from '../../shared/EmptyState'
import { Icon } from '../../shared/Icon'
import { ProgressRing } from '../../shared/ProgressRing'
import { SearchInput } from '../../shared/SearchInput'
import { Stepper } from '../../shared/Stepper'
import { formatCount } from '../../utils/format'
import { paginate } from '../../utils/paginate'
import { stripScheme, shortUrl } from '../../utils/url'
import { Pagination } from './Pagination'
import { PHASE_MESSAGES, type Phase, stepForPhase } from './phase'
import { ReportPanel } from './ReportPanel'

/**
 * Crawls and audits a whole site.
 *
 * This component owns the state machine and the messaging; the individual
 * screens live inline below because each one is a single `phase` branch and
 * splitting them into files would only move JSX around. The report — the one
 * screen with real depth — is its own component.
 *
 * The load sequence matters and is deliberate: read the persisted state first so
 * the last scan is on screen immediately, *then* ask the worker for the live
 * state. Doing it the other way round would show a spinner on every open even
 * when there is a report to show.
 */
export function SiteTab() {
  const [state, setState] = useState<SiteScanState | null>(null)
  const [seedUrl, setSeedUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('loading')
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [custom, setCustom] = useState('')
  const [openIssue, setOpenIssue] = useState<string | null>(null)
  /** Zero-based page of the URL picker. Clamped on read, never trusted on write. */
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(URL_PAGE_SIZE)
  /** Bumped by the Retry buttons to re-run the load effect. */
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  // Current page = seed site, plus whatever the background already knows.
  useEffect(() => {
    const load = async (): Promise<void> => {
      setLoadError(null)
      setPhase('loading')

      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
        const url = tab?.url ?? ''
        if (!/^https?:\/\//i.test(url)) {
          setPhase('unsupported')
          return
        }

        const origin = new URL(url).origin
        setSeedUrl(url)

        // 1) Render immediately from local storage: the popup has the same
        //    permissions as the worker, so the last scan is always visible.
        const saved = await loadState(origin)
        setState(saved ?? createIdleState(origin, url))
        setPhase(saved?.status ?? 'idle')

        // 2) Then ask the background for the live state (it may be mid-scan).
        const current = await getSiteStateWithTimeout(origin)
        if (current) {
          setState(current)
          setPhase(current.status)
          return
        }

        setLoadError(PHASE_MESSAGES.workerUnresponsive)
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error))
        setPhase('unsupported')
      }
    }
    void load()
  }, [attempt])

  // Background broadcasts the full state on every change, so the popup does
  // not poll: this subscription is what makes progress advance live.
  useEffect(() => onSiteState((next) => {
    setState(next)
    setPhase(next.status)
  }), [])

  /** Sends a request to the worker and adopts whatever state comes back. */
  const send = useCallback(async (request: SiteRequest): Promise<void> => {
    setPermissionError(null)
    const next = await sendSiteRequest(request)
    if (next) {
      setState(next)
      setPhase(next.status)
      return
    }
    setPermissionError('The background worker did not respond.')
    setLoadError(PHASE_MESSAGES.workerUnreachable)
  }, [])

  const urls = useMemo(() => state?.discovery?.urls ?? [], [state])

  /**
   * URLs matching the search box, unpaged.
   *
   * Pagination is a view concern layered on top of this, so the search and the
   * pages stay independent: searching never discards selections, and paging
   * never re-filters.
   */
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? urls.filter((entry) => entry.url.toLowerCase().includes(needle)) : urls
  }, [urls, query])

  const page = useMemo(() => paginate(matches, currentPage, pageSize), [matches, currentPage, pageSize])

  // Membership as a Set: the row loop asks "is this URL selected?" once per
  // visible row, and `Array.includes` made that O(rows x selected). Harmless at
  // 200, wasteful once the list is unbounded.
  const selectedSet = useMemo(() => new Set(selected), [selected])

  /**
   * Searching starts the results over from the first page.
   *
   * Done here rather than in an effect on `query` because an effect would run
   * *after* the render, so one frame would still be showing the old page of the
   * new, much shorter result set.
   */
  const onQueryChange = useCallback((value: string) => {
    setQuery(value)
    setCurrentPage(0)
  }, [])

  /** Changing the page size keeps the first visible row in view. */
  const onPageSizeChange = useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(0)
  }, [])

  // Typing a custom count overrides the checkbox list, which is why the two are
  // mutually exclusive and why `selected` is ignored while `custom` is set.
  const totalSelected =
    custom.trim() === '' ? selected.length : Math.min(urls.length, Number(custom) || 0)

  /**
   * Requests host permission for the seed origin, returning whether we have it.
   *
   * Optional host permissions can only be requested from a user gesture, so this
   * must run synchronously enough after a click; every crawl action calls it
   * first and bails out when it returns false.
   */
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const origin = new URL(seedUrl).origin
    const pattern = `${origin}/*`
    try {
      if (await browser.permissions.contains({ origins: [pattern] })) return true
      return await browser.permissions.request({ origins: [pattern] })
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : String(error))
      return false
    }
  }, [seedUrl])

  const onDiscover = useCallback(async (): Promise<void> => {
    if (!(await ensurePermission())) return
    setPhase('discovering')
    // A new URL list is about to replace this one, so start reading it from the
    // top. The selection is deliberately left alone: re-discovering is often
    // "I want to add the pages I missed", not "start over".
    setCurrentPage(0)
    await send({ type: 'site:discover', seedUrl })
  }, [ensurePermission, send, seedUrl])

  const onScan = useCallback(
    async (count: number): Promise<void> => {
      if (!(await ensurePermission())) return
      // A preset means "the first N"; otherwise use the hand-picked checkboxes.
      const chosen = count > 0 ? urls.slice(0, count).map((entry) => entry.url) : selected
      if (chosen.length === 0) return
      setPhase('scanning')
      await send({ type: 'site:scan', origin: state?.origin ?? new URL(seedUrl).origin, urls: chosen })
    },
    [ensurePermission, seedUrl, selected, send, state?.origin, urls]
  )

  if (phase === 'unsupported') {
    return (
      <EmptyState
        icon="globe"
        title="No website to crawl"
        hint={loadError ?? PHASE_MESSAGES.unsupported}
        action={
          <button className="btn border-line-strong bg-surface text-ink-soft hover:bg-surface-3" onClick={retry}>
            <Icon name="refresh" size={14} />
            Retry
          </button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Stepper steps={SCAN_STEPS} current={stepForPhase(phase)} />

      {permissionError && <Alert tone="fail" icon="alert">{permissionError}</Alert>}

      {loadError && (
        <Alert
          tone="warn"
          icon="info"
          action={
            <button className="btn shrink-0 px-2 py-1 text-[11px]" onClick={retry}>
              Retry
            </button>
          }
        >
          {loadError}
        </Alert>
      )}

      {!isPersistent() && (
        <Alert tone="fail" icon="alert">
          Scans cannot be saved: the <code>storage</code> permission is missing. Reload or reinstall
          the extension from <code>.output/chrome-mv3</code>.
        </Alert>
      )}

      {phase === 'loading' && <div className="skeleton h-[84px] rounded-md" />}

      {phase === 'idle' && (
        <section className="flex flex-col gap-2.5 rounded-lg border border-line bg-linear-to-b from-surface to-canvas px-4 py-4 shadow-soft">
          <h2 className="text-[17px] tracking-tight">Audit a whole site</h2>
          <p className="text-xs text-muted">
            Find every page, pick how many to scan, then get one report with everything that needs
            fixing.
          </p>
          <ul className="flex list-none flex-col gap-1 text-xs text-ink-soft">
            <Bullet>Reads sitemap.xml, falls back to link crawling</Bullet>
            <Bullet>Respects robots.txt and crawl-delay</Bullet>
            <Bullet>Runs in the background — you can close the popup</Bullet>
          </ul>
          <p className="truncate rounded-sm bg-surface-2 px-2 py-1.5 font-mono text-[11px] text-muted" title={seedUrl}>
            {seedUrl}
          </p>
          <button className="btn w-full bg-accent text-accent-fg shadow-soft hover:brightness-105" onClick={() => void onDiscover()}>
            <Icon name="sparkle" size={14} />
            Find pages
          </button>
        </section>
      )}

      {phase === 'discovering' && (
        <section className="flex flex-col items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-5 text-center shadow-soft">
          <p className="text-xs text-muted">{state?.note ?? 'Looking for pages…'}</p>
          <button className="btn border-line-strong bg-surface text-ink-soft hover:bg-surface-3" onClick={() => void send({ type: 'site:cancel' })}>
            <Icon name="stop" size={13} />
            Stop
          </button>
        </section>
      )}

      {phase === 'ready' && state?.discovery && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2.5 shadow-soft">
            <div>
              <span className="mr-1.5 text-2xl leading-none font-bold">
                {formatCount(urls.length)}
              </span>
              <span className="text-xs text-muted">pages found</span>
            </div>
            <SourcePill source={state.discovery.source} />
          </div>

          {state.discovery.notes.map((note) => (
            <p className="flex items-start gap-1.5 text-xs text-muted" key={note}>
              <Icon name="info" size={12} className="mt-0.5" />
              {note}
            </p>
          ))}

          <p className="text-xs font-semibold text-ink-soft">How many pages to scan?</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Presets larger than the site are pointless, so they are hidden. */}
            {SCAN_PRESETS.filter((preset) => preset < urls.length).map((preset) => (
              <button
                key={preset}
                className={cn(PRESET_CLASS, totalSelected === preset && PRESET_CLASS_ACTIVE)}
                onClick={() => {
                  setCustom('')
                  setSelected(urls.slice(0, preset).map((entry) => entry.url))
                }}
              >
                {preset}
              </button>
            ))}
            <button
              className={cn(PRESET_CLASS, custom.trim() !== '' && PRESET_CLASS_ACTIVE)}
              onClick={() => setCustom(String(Math.min(urls.length, 100)))}
            >
              Custom
            </button>
            {custom.trim() !== '' && (
              <input
                className="w-16 rounded-full border border-accent bg-surface px-2 py-1.25 text-xs text-ink outline-none"
                type="number"
                min={1}
                max={urls.length}
                autoFocus
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
              />
            )}
          </div>

          <SearchInput
            value={query}
            onChange={onQueryChange}
            placeholder="Filter pages…"
            count={matches.length}
          />

          <ul className="max-h-[210px] list-none overflow-auto rounded-md border border-line bg-surface">
            {page.items.map((entry) => {
              const checked = custom.trim() === '' && selectedSet.has(entry.url)
              return (
                <li
                  key={entry.url}
                  className={cn(
                    'border-b border-line transition-colors duration-150 last:border-b-0 hover:bg-surface-2',
                    checked && 'bg-accent-soft'
                  )}
                >
                  <label className="flex cursor-pointer items-center gap-1.5 px-2 py-1.25">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setCustom('')
                        setSelected((previous) =>
                          event.target.checked
                            ? [...previous, entry.url]
                            : previous.filter((url) => url !== entry.url)
                        )
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{stripScheme(entry.url)}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded px-1 text-[9.5px] font-semibold',
                        entry.from === 'sitemap' ? TONE.chip.pass : NEUTRAL_CHIP
                      )}
                    >
                      {entry.from === 'sitemap' ? 'map' : `d${entry.depth}`}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>

          {matches.length === 0 ? (
            <p className="text-xs text-muted">No pages match “{query.trim()}”.</p>
          ) : (
            <Pagination
              page={page}
              total={matches.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={onPageSizeChange}
            />
          )}

          <div className="sticky bottom-0 flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-2 shadow-lift">
            <span className="flex-1 text-[11.5px] text-muted">
              {formatCount(totalSelected)} selected
            </span>
            <button
              className="btn bg-accent text-accent-fg shadow-soft hover:brightness-105"
              disabled={totalSelected === 0}
              onClick={() => void onScan(totalSelected)}
            >
              <Icon name="play" size={12} />
              Scan
            </button>
            <button
              className="btn border-line-strong bg-surface px-2 text-ink-soft hover:bg-surface-3"
              title="Re-discover pages"
              onClick={() => void onDiscover()}
            >
              <Icon name="refresh" size={14} />
            </button>
          </div>
        </section>
      )}

      {phase === 'scanning' && state && (
        <section className="flex flex-col items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-5 text-center shadow-soft">
          <ProgressRing done={state.scanned} total={state.queue.length} />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">
              {formatCount(state.scanned)} of {formatCount(state.queue.length)} pages
            </p>
            <p className="flex flex-wrap items-center justify-center gap-1 text-xs text-muted">
              {state.failed > 0 && `${state.failed} could not be fetched · `}
              {state.currentUrls[0] ? `Now: ${shortUrl(state.currentUrls[0])}` : 'Starting…'}
            </p>
          </div>
          <p className="flex items-center gap-1.5 rounded-sm bg-surface-2 px-2 py-1.5 text-xs text-ink-soft">
            <Icon name="info" size={13} />
            <span>You can close this popup — the scan keeps running.</span>
          </p>
          <button
            className="btn w-full border-line-strong bg-surface text-ink-soft hover:bg-surface-3"
            onClick={() => void send({ type: 'site:cancel' })}
          >
            <Icon name="stop" size={13} />
            Stop scan
          </button>
        </section>
      )}

      {phase === 'done' && state && (
        <ReportPanel
          state={state}
          openIssue={openIssue}
          onToggleIssue={(id) => setOpenIssue((current) => (current === id ? null : id))}
          onRestart={() => void send({ type: 'site:clear', origin: state.origin })}
        />
      )}

      {phase === 'error' && (
        <EmptyState
          icon="alert"
          title="Discovery failed"
          hint={state?.error ?? 'Something went wrong.'}
          action={
            <button className="btn bg-accent text-accent-fg shadow-soft hover:brightness-105" onClick={() => void onDiscover()}>
              <Icon name="refresh" size={14} />
              Try again
            </button>
          }
        />
      )}
    </div>
  )
}

/** Shared base class for the "how many pages" pills, so active/inactive match. */
const PRESET_CLASS =
  'cursor-pointer rounded-full border border-line-strong bg-surface px-2.5 py-1.25 text-xs font-medium text-ink-soft transition duration-150 hover:border-accent hover:text-accent'

/** The selected state, layered on top of `PRESET_CLASS`. */
const PRESET_CLASS_ACTIVE = 'border-accent bg-accent font-semibold text-accent-fg'

/** An inline notice above the current screen, optionally with a Retry button. */
function Alert({
  tone,
  icon,
  action,
  children,
}: {
  tone: 'warn' | 'fail'
  icon: 'alert' | 'info'
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <p className={cn('flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs', TONE.chip[tone])} role="alert">
      <Icon name={icon} size={13} />
      <span className="flex-1">{children}</span>
      {action}
    </p>
  )
}

/** One "what this does" line in the idle screen's feature list. */
function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <Icon name="check" size={13} className="text-pass" />
      {children}
    </li>
  )
}

/** Where the page list came from: sitemap, crawl, or both. */
function SourcePill({ source }: { source: DiscoverySource }) {
  const { label, tone } = DISCOVERY_SOURCE[source]
  return <span className={cn('rounded-full px-1.5 py-px text-[10.5px] font-semibold', TONE.chip[tone])}>{label}</span>
}
