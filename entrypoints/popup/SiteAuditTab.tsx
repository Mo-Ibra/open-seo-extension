import { useCallback, useEffect, useMemo, useState } from 'react'
import { browser } from 'wxt/browser'

import { isPersistent, loadState } from '../../lib/crawl/store'
import { createIdleState, type SiteEvent, type SiteRequest, type SiteScanState } from '../../lib/crawl/types'
import { ReportPanel } from './ReportPanel'

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

const PRESETS = [10, 25, 50, 100, 250, 500]
/** Checkbox list is capped so a 1000-URL site stays responsive. */
const LIST_LIMIT = 200

type Phase = 'loading' | 'unsupported' | SiteScanState['status']

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

  const totalSelected = custom.trim() === '' ? selected.length : Math.min(urls.length, Number(custom) || 0)

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
      <p className="hint">
        {loadError ?? 'Open a normal web page first — the crawler reads that site.'}
        <button className="ghost" onClick={() => setAttempt((value) => value + 1)}>
          Retry
        </button>
      </p>
    )
  }

  return (
    <div className="site">
      {permissionError && (
        <p className="error" role="alert">
          {permissionError}
        </p>
      )}

      {loadError && (
        <p className="error" role="alert">
          {loadError}
          <button className="ghost" onClick={() => setAttempt((value) => value + 1)}>
            Retry
          </button>
        </p>
      )}

      {!isPersistent() && (
        <p className="error" role="alert">
          This build cannot save scans: the <code>storage</code> permission is missing. Reload or
          reinstall the extension from <code>.output/chrome-mv3</code>.
        </p>
      )}

      {phase === 'loading' && (
        <p className="hint">
          Preparing…
          <button className="ghost" onClick={() => setAttempt((value) => value + 1)}>
            Retry
          </button>
        </p>
      )}

      {phase === 'idle' && (
        <section className="site-intro">
          <p>
            Audit a whole site in your browser: find its pages, pick how many to scan, then get one
            report with every issue.
          </p>
          <p className="site-seed">{seedUrl}</p>
          <button className="primary" onClick={() => void onDiscover()}>
            Find pages
          </button>
        </section>
      )}

      {phase === 'discovering' && (
        <section className="site-progress">
          <p className="hint">{state?.note ?? 'Looking for pages…'}</p>
          <button className="ghost" onClick={() => void send({ type: 'site:cancel' })}>
            Stop
          </button>
        </section>
      )}

      {phase === 'ready' && state?.discovery && (
        <section className="site-select">
          <div className="site-summary">
            <strong>{urls.length.toLocaleString('en-US')}</strong> pages found
            <span className="site-source">
              via {state.discovery.source === 'sitemap' ? 'sitemap' : state.discovery.source === 'crawl' ? 'link crawl' : 'sitemap + crawl'}
            </span>
          </div>
          {state.discovery.notes.map((note) => (
            <p className="hint" key={note}>
              {note}
            </p>
          ))}

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
            <label className="custom">
              Custom
              <input
                type="number"
                min={1}
                max={urls.length}
                value={custom}
                placeholder={String(urls.length)}
                onChange={(event) => {
                  setCustom(event.target.value)
                  setSelected([])
                }}
              />
            </label>
          </div>

          <input
            className="search"
            type="search"
            placeholder="Filter pages…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <ul className="url-list">
            {shown.map((entry) => {
              const checked = custom === '' && selected.includes(entry.url)
              return (
                <li key={entry.url}>
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
                    <span className={`tag ${entry.from}`}>{entry.from === 'sitemap' ? 'map' : `d${entry.depth}`}</span>
                  </label>
                </li>
              )
            })}
          </ul>
          {urls.length > shown.length && (
            <p className="hint">Showing {shown.length} of {urls.length} — use the filter to narrow it down.</p>
          )}

          <div className="site-actions">
            <button className="primary" disabled={totalSelected === 0} onClick={() => void onScan(totalSelected)}>
              Scan {totalSelected.toLocaleString('en-US')} pages
            </button>
            <button className="ghost" onClick={() => void onDiscover()}>
              Re-discover
            </button>
          </div>
        </section>
      )}

      {phase === 'scanning' && state && (
        <section className="site-progress">
          <div className="progress-head">
            <strong>
              {state.scanned.toLocaleString('en-US')} / {state.queue.length.toLocaleString('en-US')}
            </strong>
            <span>{state.failed > 0 ? `${state.failed} failed` : 'pages scanned'}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${state.queue.length > 0 ? (state.scanned / state.queue.length) * 100 : 0}%` }}
            />
          </div>
          {state.currentUrls.length > 0 && <p className="hint">Now: {state.currentUrls[0]}</p>}
          <p className="hint">You can close this popup — the scan keeps running.</p>
          <button className="ghost" onClick={() => void send({ type: 'site:cancel' })}>
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

      {phase === 'paused' && state && <p className="hint">Scan paused.</p>}

      {phase === 'error' && (
        <section className="site-progress">
          <p className="error" role="alert">
            {state?.error ?? 'Something went wrong.'}
          </p>
          <button className="primary" onClick={() => void onDiscover()}>
            Try again
          </button>
        </section>
      )}

      {phase === 'ready' && !state?.discovery && state?.results.length === 0 && (
        <p className="hint">Nothing discovered yet.</p>
      )}
    </div>
  )
}
