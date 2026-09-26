import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'

import { runAudit } from '../../lib/audit'
import { extractFromDocument } from '../../lib/extract'
import { extractSiteContext } from '../../lib/site-context'
import type { Finding, PageData, SiteContext } from '../../lib/types'
import { SerpPreview } from './SerpPreview'
import { FindingCard } from './FindingCard'
import { LinksPanel } from './LinksPanel'
import { SocialPanel } from './SocialPanel'
import { SiteAuditTab } from './SiteAuditTab'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; page: PageData; findings: Finding[] }

type Tab = 'audit' | 'links' | 'social' | 'site'

const TABS: { id: Tab; label: string }[] = [
  { id: 'audit', label: 'Audit' },
  { id: 'links', label: 'Links' },
  { id: 'social', label: 'Social' },
  { id: 'site', label: 'Site' },
]

export default function App() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [tab, setTab] = useState<Tab>('audit')

  const scan = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (!activeTab?.id) {
        throw new Error('No active tab found.')
      }

      const [pageResult] = await browser.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: extractFromDocument,
      })

      const page = pageResult?.result as PageData | undefined
      if (!page) {
        throw new Error('Could not read this page. Try reloading it.')
      }

      const [contextResult] = await browser.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: extractSiteContext,
      })

      const context = contextResult?.result as SiteContext | undefined
      if (!context) {
        throw new Error('Could not read the server response headers.')
      }

      setState({ status: 'ready', page, findings: runAudit(page, context) })
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }, [])

  useEffect(() => {
    void scan()
  }, [scan])

  return (
    <div className="app">
      <header className="header">
        <span className="brand">
          Open <b>SEO</b>
        </span>
        <button className="rescan" onClick={() => void scan()} disabled={state.status === 'loading'}>
          {state.status === 'loading' ? 'Scanning…' : 'Rescan'}
        </button>
      </header>

      {state.status === 'loading' && <p className="hint">Reading the page…</p>}

      {state.status === 'error' && (
        <p className="error" role="alert">
          {state.message}
        </p>
      )}

      <nav className="tabs" role="tablist">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'tab active' : 'tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {state.status === 'ready' && tab !== 'site' && (
        <>
          {tab === 'audit' && (
            <>
              <SerpPreview page={state.page} />
              <div className="findings">
                {state.findings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))}
              </div>
            </>
          )}
          {tab === 'links' && <LinksPanel page={state.page} />}
          {tab === 'social' && <SocialPanel page={state.page} />}
        </>
      )}

      {tab === 'site' && <SiteAuditTab />}

      <footer className="footer">Local-only audit · nothing leaves your browser</footer>
    </div>
  )
}
