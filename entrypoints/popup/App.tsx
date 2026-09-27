import { useCallback, useEffect, useState } from 'react'
import { browser } from 'wxt/browser'

import { runAudit } from '../../lib/audit'
import { extractFromDocument } from '../../lib/extract'
import { extractSiteContext } from '../../lib/site-context'
import type { Finding, PageData, SiteContext } from '../../lib/types'
import { AuditTab } from './tabs/audit/AuditTab'
import { SerpPreview } from './tabs/audit/SerpPreview'
import { LinksTab } from './tabs/links/LinksTab'
import { FindingCard } from './tabs/site/FindingCard'
import { SiteTab } from './tabs/site/SiteTab'
import { SocialTab } from './tabs/social/SocialTab'
import { EmptyState } from './shared/EmptyState'
import { Footer } from './shared/Footer'
import { Header } from './shared/Header'
import { Icon } from './shared/Icon'
import { NavTabs, type Tab } from './shared/NavTabs'
import { Skeleton } from './shared/Skeleton'

/**
 * What the page audit produced. A discriminated union rather than three
 * `useState` calls, so "loading" and "ready" can never both be true.
 */
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; page: PageData; findings: Finding[] }

/**
 * The popup shell: chrome, tab switching, and the page audit that three of the
 * four tabs depend on.
 *
 * The site tab is independent of that audit — it talks to the background worker
 * itself — so it renders regardless of the page's status, which is why the
 * `isPageTab` guard wraps the loading/error/ready branches.
 */
export default function App() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [tab, setTab] = useState<Tab>('audit')

  /**
   * Reads the active tab and runs the audit on it.
   *
   * `executeScript` with a function reference (rather than a file) is required
   * here: the extractor has to run inside the page's own JS context, and the
   * function is serialised, so it cannot close over anything from this module —
   * it receives the document as its only argument.
   */
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

      // Second injected call: the response headers are not in the DOM, so they
      // have to be fetched from the page to keep the request same-origin.
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
                <AuditTab findings={state.findings} />
                <div className="flex flex-col gap-1.5">
                  {state.findings.map((finding) => (
                    <FindingCard key={finding.id} finding={finding} />
                  ))}
                </div>
              </>
            )}
            {tab === 'links' && <LinksTab page={state.page} />}
            {tab === 'social' && <SocialTab page={state.page} />}
          </>
        )}

        {tab === 'site' && <SiteTab />}
      </main>

      <Footer />
    </div>
  )
}
