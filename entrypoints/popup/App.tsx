import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'

import { runAudit } from '../../lib/audit'
import { extractFromDocument } from '../../lib/extract'
import { extractSiteContext } from '../../lib/site-context'
import type { Finding, PageData, SiteContext } from '../../lib/types'
import { AuditSummary } from './AuditSummary'
import { EmptyState } from './EmptyState'
import { FindingCard } from './FindingCard'
import { Icon, type IconName } from './Icon'
import { LinksPanel } from './LinksPanel'
import { SerpPreview } from './SerpPreview'
import { SiteAuditTab } from './SiteAuditTab'
import { SocialPanel } from './SocialPanel'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; page: PageData; findings: Finding[] }

type Tab = 'audit' | 'links' | 'social' | 'site'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'audit', label: 'Audit', icon: 'gauge' },
  { id: 'links', label: 'Links', icon: 'link' },
  { id: 'social', label: 'Social', icon: 'share' },
  { id: 'site', label: 'Site', icon: 'globe' },
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

  const isPageTab = tab !== 'site'
  const busy = state.status === 'loading'

  return (
    <div className="app">
      <header className="header">
        <span className="brand">
          Open<b>SEO</b>
        </span>
        {isPageTab && (
          <button
            className="btn subtle icon-only"
            onClick={() => void scan()}
            disabled={busy}
            title="Re-run the audit on this page"
            aria-label="Re-run the audit"
          >
            <Icon name="refresh" size={14} className={busy ? 'spin' : undefined} />
            {!busy && <span>Rescan</span>}
          </button>
        )}
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'tab active' : 'tab'}
            onClick={() => setTab(id)}
          >
            <Icon name={icon} size={14} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <main className="content">
        {state.status === 'loading' && <Skeleton />}

        {state.status === 'error' && isPageTab && (
          <EmptyState
            icon="alert"
            title="This page cannot be audited"
            hint={state.message}
            action={
              <button className="btn primary" onClick={() => void scan()}>
                <Icon name="refresh" size={14} />
                Try again
              </button>
            }
          />
        )}

        {state.status === 'ready' && isPageTab && (
          <>
            {tab === 'audit' && (
              <>
                <SerpPreview page={state.page} />
                <AuditSummary findings={state.findings} />
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
      </main>

      <footer className="footer">
        <Icon name="info" size={12} />
        <span>Local-only — nothing leaves your browser</span>
      </footer>
    </div>
  )
}

/** Shown while the page is being read, so the popup never flashes empty. */
function Skeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <div className="sk-block tall" />
      <div className="sk-block" />
      <div className="sk-block" />
      <div className="sk-block short" />
    </div>
  )
}
