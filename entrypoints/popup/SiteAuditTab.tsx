import { useCallback, useEffect, useMemo, useState } from 'react'
import { browser } from 'wxt/browser'

import { isPersistent, loadState } from '../../lib/crawl/store'
import { createIdleState, type SiteEvent, type SiteRequest, type SiteScanState } from '../../lib/crawl/types'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'
import { ProgressRing } from './ProgressRing'
import { ReportPanel } from './ReportPanel'

const PRESETS = [10, 25, 50, 100, 250, 500]
/** Checkbox list is capped so a 1000-URL site stays responsive. */
const LIST_LIMIT = 200

type Phase = 'loading' | 'unsupported' | SiteScanState['status']

const STEPS = ['Discover', 'Choose', 'Scan', 'Report']

/** The background must answer quickly; if it does not, say so instead of spinning. */
const HANDSHAKE_TIMEOUT_MS = 4000

export function SiteAuditTab() {
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
  useEffect(() => {
    const listener = (message: unknown): undefined => {
      const event = message as SiteEvent
      if (event?.type === 'site:state') {
        setState(event.state)
        setPhase(event.state.status)
      }
      return undefined
    }
    browser.runtime.onMessage.addListener(listener)
    return () => {
      const runtime = browser.runtime as unknown as {
        onMessage: { removeListener?: (listener: (message: unknown) => undefined) => void }
      }
      runtime.onMessage.removeListener?.(listener)
    }
  }, [])

  const send = useCallback(async (request: SiteRequest): Promise<void> => {
    setPermissionError(null)
    try {
      const next = (await browser.runtime.sendMessage(request)) as SiteScanState | undefined
      if (!next) throw new Error('The background worker did not respond.')
      setState(next)
      setPhase(next.status)
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : String(error))
      setLoadError(
        'Could not talk to the background worker. Reload the extension in chrome://extensions, then try again.'
      )
    }
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
          <button className="btn subtle" onClick={() => setAttempt((value) => value + 1)}>
            <Icon name="refresh" size={14} />
            Retry
          </button>
        }
      />
    )
  }

  const step =
    phase === 'idle' || phase === 'loading' ? 0 : phase === 'ready' ? 1 : phase === 'scanning' || phase === 'discovering' ? 2 : 3

  return (
    <div className="site">
      <Stepper current={step} />

      {permissionError && (
        <p className="notice fail" role="alert">
          <Icon name="alert" size={13} />
          <span>{permissionError}</span>
        </p>
      )}

      {loadError && (
        <p className="notice warn" role="alert">
          <Icon name="info" size={13} />
          <span>{loadError}</span>
          <button className="btn tiny" onClick={() => setAttempt((value) => value + 1)}>
            Retry
          </button>
        </p>
      )}

      {!isPersistent() && (
        <p className="notice fail" role="alert">
          <Icon name="alert" size={13} />
          <span>
            Scans cannot be saved: the <code>storage</code> permission is missing. Reload or reinstall
            the extension from <code>.output/chrome-mv3</code>.
          </span>
        </p>
      )}

      {phase === 'loading' && <div className="sk-block tall" />}

      {phase === 'idle' && (
        <section className="site-intro">
          <h2 className="site-title">Audit a whole site</h2>
          <p className="site-lead">
            Find every page, pick how many to scan, then get one report with everything that needs
            fixing.
          </p>
          <ul className="feature-list">
            <li>
              <Icon name="check" size={13} /> Reads sitemap.xml, falls back to link crawling
            </li>
            <li>
              <Icon name="check" size={13} /> Respects robots.txt and crawl-delay
            </li>
            <li>
              <Icon name="check" size={13} /> Runs in the background — you can close the popup
            </li>
          </ul>
          <p className="site-seed" title={seedUrl}>
            {seedUrl}
          </p>
          <button className="btn primary block" onClick={() => void onDiscover()}>
            <Icon name="sparkle" size={14} />
            Find pages
          </button>
        </section>
      )}

      {phase === 'discovering' && (
        <section className="site-progress">
          <p className="hint">
            {state?.note ?? 'Looking for pages\u2026'}
          </p>
          <button className="btn subtle" onClick={() => void send({ type: 'site:cancel' })}>
            <Icon name="stop" size={13} />
            Stop
          </button>
        </section>
      )}

      {phase === 'ready' && state?.discovery && (
        <section className="site-select">
          <div className="site-summary">
            <div>
              <span className="site-count">{urls.length.toLocaleString('en-US')}</span>
              <span className="site-count-label">pages found</span>
            </div>
            <span className={`badge ${sourceTone(state.discovery.source)}`}>
              {sourceLabel(state.discovery.source)}
            </span>
          </div>

          {state.discovery.notes.map((note) => (
            <p className="hint" key={note}>
              <Icon name="info" size={12} /> {note}
            </p>
          ))}

          <p className="field-label">How many pages to scan?</p>
          <div className="preset-row">
            {PRESETS.filter((preset) => preset < urls.length).map((preset) => (
              <button
                key={preset}
                className={totalSelected === preset ? 'preset active' : 'preset'}
                onClick={() => {
                  setCustom('')
                  setSelected(urls.slice(0, preset).map((entry) => entry.url))
                }}
              >
                {preset}
              </button>
            ))}
            <button
              className={custom.trim() !== '' ? 'preset active' : 'preset'}
              onClick={() => setCustom(String(Math.min(urls.length, 100)))}
            >
              Custom
            </button>
            {custom.trim() !== '' && (
              <input
                className="custom-input"
                type="number"
                min={1}
                max={urls.length}
                autoFocus
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
              />
            )}
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
            <span className="search-count">{shown.length}</span>
          </div>

          <ul className="url-list">
            {shown.map((entry) => {
              const checked = custom.trim() === '' && selected.includes(entry.url)
              return (
                <li key={entry.url} className={checked ? 'url-row checked' : 'url-row'}>
                  <label>
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
                    <span className="url-text" title={entry.url}>
                      {entry.url.replace(/^https?:\/\//, '')}
                    </span>
                    <span className={`tag ${entry.from}`}>
                      {entry.from === 'sitemap' ? 'map' : `d${entry.depth}`}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {urls.length > shown.length && (
            <p className="hint">Showing {shown.length} of {urls.length}.</p>
          )}

          <div className="action-bar">
            <span className="action-count">
              {totalSelected.toLocaleString('en-US')} selected
            </span>
            <button
              className="btn primary"
              disabled={totalSelected === 0}
              onClick={() => void onScan(totalSelected)}
            >
              <Icon name="play" size={12} />
              Scan
            </button>
            <button className="btn subtle icon-only" title="Re-discover pages" onClick={() => void onDiscover()}>
              <Icon name="refresh" size={14} />
            </button>
          </div>
        </section>
      )}

      {phase === 'scanning' && state && (
        <section className="site-progress">
          <ProgressRing done={state.scanned} total={state.queue.length} />
          <div className="progress-meta">
            <p className="progress-title">
              {state.scanned.toLocaleString('en-US')} of{' '}
              {state.queue.length.toLocaleString('en-US')} pages
            </p>
            <p className="hint">
              {state.failed > 0 ? `${state.failed} could not be fetched \u00b7 ` : ''}
              {state.currentUrls[0] ? `Now: ${shortUrl(state.currentUrls[0])}` : 'Starting\u2026'}
            </p>
          </div>
          <p className="notice">
            <Icon name="info" size={13} />
            <span>You can close this popup — the scan keeps running.</span>
          </p>
          <button className="btn subtle block" onClick={() => void send({ type: 'site:cancel' })}>
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
            <button className="btn primary" onClick={() => void onDiscover()}>
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
    const response = await Promise.race([
      browser.runtime
        .sendMessage({ type: 'site:getState', origin } satisfies SiteRequest)
        .catch((error: unknown) => {
          throw new Error(error instanceof Error ? error.message : String(error))
        }),
      timeout,
    ])
    return (response as SiteScanState | undefined) ?? null
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="stepper" aria-label="Progress">
      {STEPS.map((label, index) => (
        <li
          key={label}
          className={index === current ? 'step active' : index < current ? 'step done' : 'step'}
        >
          <span className="step-dot">{index < current ? <Icon name="check" size={10} /> : index + 1}</span>
          <span className="step-label">{label}</span>
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

function sourceTone(source: string): string {
  if (source === 'crawl') return 'warn'
  return 'pass'
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.pathname}`
  } catch {
    return url
  }
}
