import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'

import { runAudit } from '../../lib/audit'
import { extractPageData } from '../../lib/extract'
import type { Finding, PageData } from '../../lib/types'
import { SerpPreview } from './SerpPreview'
import { FindingCard } from './FindingCard'
import { LinksPanel } from './LinksPanel'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; page: PageData; findings: Finding[] }

type Tab = 'audit' | 'links'

const TABS: { id: Tab; label: string }[] = [
  { id: 'audit', label: 'Audit' },
  { id: 'links', label: 'Links' },
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

      const [result] = await browser.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: extractPageData,
      })

      const page = result?.result as PageData | undefined
      if (!page) {
        throw new Error('Could not read this page. Try reloading it.')
      }

      setState({ status: 'ready', page, findings: runAudit(page) })
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

      {state.status === 'ready' && (
        <>
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

          {tab === 'audit' ? (
            <>
              <SerpPreview page={state.page} />
              <div className="findings">
                {state.findings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))}
              </div>
            </>
          ) : (
            <LinksPanel page={state.page} />
          )}

          <footer className="footer">Local-only audit · nothing leaves your browser</footer>
        </>
      )}
    </div>
  )
}
