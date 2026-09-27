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
import Skeleton from './Skeleton'
import NavTabs, { Tab } from './NavTabs'
import Footer from './Footer'
import Header from './Header'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; page: PageData; findings: Finding[] }

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
    <div className="flex h-[600px] w-[420px] flex-col bg-canvas">
      <Header isPageTab={isPageTab} scan={scan} busy={busy} />

      <NavTabs tab={tab} setTab={setTab} />

      <main className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-3">
        {state.status === 'loading' && <Skeleton />}

        {state.status === 'error' && isPageTab && (
          <EmptyState
            icon="alert"
            title="This page cannot be audited"
            hint={state.message}
            action={
              <button className="btn bg-accent text-accent-fg shadow-soft hover:brightness-105" onClick={() => void scan()}>
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
                <div className="flex flex-col gap-1.5">
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

      <Footer />
    </div>
  )
}