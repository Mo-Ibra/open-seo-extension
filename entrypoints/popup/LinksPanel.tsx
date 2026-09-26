import { useMemo, useState } from 'react'

import type { LinkInfo, PageData } from '../../lib/types'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'

type Kind = 'all' | 'internal' | 'external' | 'empty'

function isInternal(href: string, pageUrl: string): boolean {
  try {
    return new URL(href).origin === new URL(pageUrl).origin
  } catch {
    return true
  }
}

/** A compact, readable label for a link: path for internal, host+path for external. */
function displayHref(href: string, pageUrl: string): string {
  try {
    const url = new URL(href)
    const path = `${url.pathname}${url.search}`
    if (url.origin === new URL(pageUrl).origin) {
      return path || '/'
    }
    return `${url.host}${path}`
  } catch {
    return href
  }
}

function isRealLink(link: LinkInfo): boolean {
  return Boolean(link.href) && !link.href.startsWith('javascript:')
}

export function LinksPanel({ page }: { page: PageData }) {
  const [kind, setKind] = useState<Kind>('all')
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const groups = useMemo(() => {
    const links = page.links.filter(isRealLink)
    const internal = links.filter((link) => isInternal(link.href, page.url))
    const external = links.filter((link) => !isInternal(link.href, page.url))
    return {
      total: links.length,
      unique: new Set(links.map((link) => link.href)).size,
      internal,
      external,
      withoutText: links.filter((link) => !link.text).length,
    }
  }, [page])

  const search = query.trim().toLowerCase()
  const match = (link: LinkInfo): boolean =>
    !search ||
    link.href.toLowerCase().includes(search) ||
    link.text.toLowerCase().includes(search)

  const internal = groups.internal.filter(match)
  const external = groups.external.filter(match)
  const empty = page.links.filter((link) => isRealLink(link) && !link.text).filter(match)

  const copy = async (href: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(href)
      setCopied(href)
      setTimeout(() => setCopied((current) => (current === href ? null : current)), 1200)
    } catch {
      // Clipboard access can be denied; ignore.
    }
  }

  return (
    <div className="links-panel">
      <div className="stats">
        <Stat label="Total" value={groups.total} />
        <Stat label="Unique" value={groups.unique} />
        <Stat label="Internal" value={groups.internal.length} tone="accent" />
        <Stat label="External" value={groups.external.length} />
      </div>

      {groups.withoutText > 0 && (
        <p className="notice warn">
          <Icon name="alert" size={13} />
          <span>
            {groups.withoutText} link{groups.withoutText === 1 ? '' : 's'} without anchor text
          </span>
        </p>
      )}

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Filter links">
          {(
            [
              ['all', `All ${groups.total}`],
              ['internal', `Internal ${groups.internal.length}`],
              ['external', `External ${groups.external.length}`],
              ['empty', `No text ${groups.withoutText}`],
            ] as [Kind, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={kind === id}
              className={kind === id ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setKind(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="search-wrap">
          <Icon name="search" size={13} />
          <input
            className="search"
            type="search"
            placeholder="Filter links\u2026"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {kind === 'internal' && (
        <LinkSection title="Internal" links={internal} pageUrl={page.url} onCopy={copy} copied={copied} />
      )}
      {kind === 'external' && (
        <LinkSection title="External" links={external} pageUrl={page.url} onCopy={copy} copied={copied} />
      )}
      {kind === 'empty' && (
        <LinkSection title="Missing anchor text" links={empty} pageUrl={page.url} onCopy={copy} copied={copied} />
      )}
      {kind === 'all' && (
        <>
          <LinkSection title="Internal" links={internal} pageUrl={page.url} onCopy={copy} copied={copied} />
          <LinkSection title="External" links={external} pageUrl={page.url} onCopy={copy} copied={copied} />
        </>
      )}

      {groups.total === 0 && (
        <EmptyState icon="link" title="No links on this page" hint="Links found here will be listed with their anchor text." />
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-value">{value.toLocaleString('en-US')}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function LinkSection({
  title,
  links,
  pageUrl,
  onCopy,
  copied,
}: {
  title: string
  links: LinkInfo[]
  pageUrl: string
  onCopy: (href: string) => void
  copied: string | null
}) {
  if (links.length === 0) return null

  return (
    <section className="link-section">
      <h3 className="section-title">
        {title} <span className="badge">{links.length}</span>
      </h3>
      <ul className="link-list">
        {links.map((link, index) => (
          <li className="link-row" key={`${link.href}-${index}`}>
            <span className="link-href" title={link.href}>
              {displayHref(link.href, pageUrl)}
            </span>
            <span className={link.text ? 'link-text' : 'link-text empty'}>
              {link.text || 'No anchor text'}
            </span>
            <button
              className="row-action"
              title="Copy URL"
              aria-label={`Copy ${link.href}`}
              onClick={() => void onCopy(link.href)}
            >
              <Icon name={copied === link.href ? 'check' : 'copy'} size={12} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
