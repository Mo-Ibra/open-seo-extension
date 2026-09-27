import { useCallback, useEffect, useMemo, useState } from 'react'
import { browser } from 'wxt/browser'

import { isPersistent, loadState } from '../../../../lib/crawl/store'
import { createIdleState, type SiteRequest, type SiteScanState } from '../../../../lib/crawl/types'
import { onSiteState, sendSiteRequest } from '../../../../lib/platform/messaging'
import { cn } from '../../shared/cn'
import { EmptyState } from '../../shared/EmptyState'
import { Icon } from '../../shared/Icon'
import { ProgressRing } from '../../shared/ProgressRing'
import { ReportPanel } from './ReportPanel'

const PRESETS = [10, 25, 50, 100, 250, 500]
/** Checkbox list is capped so a 1000-URL site stays responsive. */
const LIST_LIMIT = 200

type Phase = 'loading' | 'unsupported' | SiteScanState['status']

const STEPS = ['Discover', 'Choose', 'Scan', 'Report']

/** The background must answer quickly; if it does not, say so instead of spinning. */
const HANDSHAKE_TIMEOUT_MS = 4000

export function SiteTab() {
  const [state, setState] = useState<SiteScanState | null>(null)
  const [seedUrl, setSeedUrl] = useState<string>('')
  const [phase, setPhase] = useState<Phase>('loading')
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [custom, setCustom] = useState('')
  const [openIssue, setOpenIssue] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

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
        const current = await handshake(origin)
        if (current) {
          setState(current)
          setPhase(current.status)
          return
        }

        setLoadError(
          'The background worker did not respond. Reload the extension in chrome://extensions, then start the scan again.'
        )
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error))
        setPhase('unsupported')
      }
    }
    void load()
  }, [attempt])

  // Background broadcasts the full state on every change.
  useEffect(() => onSiteState((next) => {
    setState(next)
    setPhase(next.status)
  }), [])

  const send = useCallback(async (request: SiteRequest): Promise<void> => {
    setPermissionError(null)
    const next = await sendSiteRequest(request)
    if (next) {
      setState(next)
      setPhase(next.status)
      return
    }
    setPermissionError('The background worker did not respond.')
    setLoadError(
      'Could not talk to the background worker. Reload the extension in chrome://extensions, then try again.'
    )
  }, [])

  const urls = useMemo(() => state?.discovery?.urls ?? [], [state])
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = needle ? urls.filter((entry) => entry.url.toLowerCase().includes(needle)) : urls
    return filtered.slice(0, LIST_LIMIT)
  }, [urls, query])

  const totalSelected =
    custom.trim() === '' ? selected.length : Math.min(urls.length, Number(custom) || 0)

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
    await send({ type: 'site:discover', seedUrl })
  }, [ensurePermission, send, seedUrl])

  const onScan = useCallback(
    async (count: number): Promise<void> => {
      if (!(await ensurePermission())) return
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
        hint={loadError ?? 'Open a normal web page first — the crawler reads that site.'}
        action={
          <button className="btn border-line-strong bg-surface text-ink-soft hover:bg-surface-3" onClick={() => setAttempt((value) => value + 1)}>
            <Icon name="refresh" size={14} />
            Retry
          </button>
        }
      />
    )
  }

  const step =
    phase === 'idle' || phase === 'loading'
      ? 0
      : phase === 'ready'
        ? 1
        : phase === 'scanning' || phase === 'discovering'
          ? 2
          : 3

  return (
    <div className="flex flex-col gap-3">
      <Stepper current={step} />

      {permissionError && (
        <p className="flex items-center gap-1.5 rounded-sm bg-fail-soft px-2 py-1.5 text-xs text-fail" role="alert">
          <Icon name="alert" size={13} />
          <span>{permissionError}</span>
        </p>
      )}

      {loadError && (
        <p className="flex items-center gap-1.5 rounded-sm bg-warn-soft px-2 py-1.5 text-xs text-warn" role="alert">
          <Icon name="info" size={13} />
          <span className="flex-1">{loadError}</span>
          <button className="btn px-2 py-1 text-[11px]" onClick={() => setAttempt((value) => value + 1)}>
            Retry
          </button>
        </p>
      )}

      {!isPersistent() && (
        <p className="flex items-center gap-1.5 rounded-sm bg-fail-soft px-2 py-1.5 text-xs text-fail" role="alert">
          <Icon name="alert" size={13} />
          <span>
            Scans cannot be saved: the <code>storage</code> permission is missing. Reload or reinstall
            the extension from <code>.output/chrome-mv3</code>.
          </span>
        </p>
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
            <li className="flex items-center gap-1.5">
              <Icon name="check" size={13} className="text-pass" />
              Reads sitemap.xml, falls back to link crawling
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="check" size={13} className="text-pass" />
              Respects robots.txt and crawl-delay
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="check" size={13} className="text-pass" />
              Runs in the background — you can close the popup
            </li>
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
          <p className="text-xs text-muted">{state?.note ?? 'Looking for pages\u2026'}</p>
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
                {urls.length.toLocaleString('en-US')}
              </span>
              <span className="text-xs text-muted">pages found</span>
            </div>
            <span
              className={cn(
                'rounded-full px-1.5 py-px text-[10.5px] font-semibold',
                state.discovery.source === 'crawl' ? 'bg-warn-soft text-warn' : 'bg-pass-soft text-pass'
              )}
            >
              {sourceLabel(state.discovery.source)}
            </span>
          </div>

          {state.discovery.notes.map((note) => (
            <p className="flex items-start gap-1.5 text-xs text-muted" key={note}>
              <Icon name="info" size={12} className="mt-0.5" />
              {note}
            </p>
          ))}

          <p className="text-xs font-semibold text-ink-soft">How many pages to scan?</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.filter((preset) => preset < urls.length).map((preset) => (
              <button
                key={preset}
                className={cn(
                  'cursor-pointer rounded-full border px-2.5 py-1.25 text-xs font-medium transition duration-150',
                  totalSelected === preset
                    ? 'border-accent bg-accent font-semibold text-accent-fg'
                    : 'border-line-strong bg-surface text-ink-soft hover:border-accent hover:text-accent'
                )}
                onClick={() => {
                  setCustom('')
                  setSelected(urls.slice(0, preset).map((entry) => entry.url))
                }}
              >
                {preset}
              </button>
            ))}
            <button
              className={cn(
                'cursor-pointer rounded-full border px-2.5 py-1.25 text-xs font-medium transition duration-150',
                custom.trim() !== ''
                  ? 'border-accent bg-accent font-semibold text-accent-fg'
                  : 'border-line-strong bg-surface text-ink-soft hover:border-accent hover:text-accent'
              )}
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

          <div className="flex items-center gap-1.5 rounded-sm border border-line bg-surface px-2 text-muted focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
            <Icon name="search" size={13} />
            <input
              className="w-full min-w-0 flex-1 bg-transparent py-1.5 text-xs text-ink outline-none"
              type="search"
              placeholder="Filter pages\u2026"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="text-[11px]">{shown.length}</span>
          </div>

          <ul className="max-h-[210px] list-none overflow-auto rounded-md border border-line bg-surface">
            {shown.map((entry) => {
              const checked = custom.trim() === '' && selected.includes(entry.url)
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
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{entry.url.replace(/^https?:\/\//, '')}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded px-1 text-[9.5px] font-semibold',
                        entry.from === 'sitemap' ? 'bg-pass-soft text-pass' : 'bg-surface-3 text-muted'
                      )}
                    >
                      {entry.from === 'sitemap' ? 'map' : `d${entry.depth}`}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {urls.length > shown.length && (
            <p className="text-xs text-muted">Showing {shown.length} of {urls.length}.</p>
          )}

          <div className="sticky bottom-0 flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-2 shadow-lift">
            <span className="flex-1 text-[11.5px] text-muted">
              {totalSelected.toLocaleString('en-US')} selected
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
              {state.scanned.toLocaleString('en-US')} of {state.queue.length.toLocaleString('en-US')} pages
            </p>
            <p className="flex flex-wrap items-center justify-center gap-1 text-xs text-muted">
              {state.failed > 0 && `${state.failed} could not be fetched \u00b7 `}
              {state.currentUrls[0] ? `Now: ${shortUrl(state.currentUrls[0])}` : 'Starting\u2026'}
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

/**
 * Asks the background for the current state, giving up after a short while so a
 * dead/unregistered service worker shows a message instead of a spinner.
 */
async function handshake(origin: string): Promise<SiteScanState | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), HANDSHAKE_TIMEOUT_MS)
  })

  try {
    return await Promise.race([sendSiteRequest({ type: 'site:getState', origin }), timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex list-none items-center gap-0.5" aria-label="Progress">
      {STEPS.map((label, index) => (
        <li
          key={label}
          className={cn(
            'flex flex-1 items-center gap-1.25 text-[10.5px] font-semibold tracking-[0.05em] text-muted uppercase',
            index === current && 'text-accent',
            index < current && 'text-pass',
            index < STEPS.length - 1 &&
              "after:h-px after:flex-1 after:bg-line after:content-[''] after:my-1"
          )}
        >
          <span
            className={cn(
              'grid size-[18px] shrink-0 place-items-center rounded-full border bg-surface text-[10px]',
              index === current && 'border-accent bg-accent-soft text-accent',
              index < current && 'border-pass bg-pass-soft text-pass'
            )}
          >
            {index < current ? <Icon name="check" size={10} /> : index + 1}
          </span>
          <span className="truncate">{label}</span>
        </li>
      ))}
    </ol>
  )
}

function sourceLabel(source: string): string {
  if (source === 'sitemap') return 'from sitemap'
  if (source === 'crawl') return 'from link crawl'
  return 'sitemap + crawl'
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.pathname}`
  } catch {
    return url
  }
}
