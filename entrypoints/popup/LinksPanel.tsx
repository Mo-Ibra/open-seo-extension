import { useMemo, useState } from 'react'

import type { LinkInfo, PageData } from '../../lib/types'
import { cn } from './cn'
import { EmptyState } from './EmptyState'
import { Icon } from './Icon'

type Kind = 'all' | 'internal' | 'external' | 'empty'

const FILTERS: { id: Kind; label: (counts: Record<string, number>) => string }[] = [
  { id: 'all', label: (c) => `All ${c.total}` },
  { id: 'internal', label: (c) => `Internal ${c.internal}` },
  { id: 'external', label: (c) => `External ${c.external}` },
  { id: 'empty', label: (c) => `No text ${c.empty}` },
]

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
    const empty = links.filter((link) => !link.text)
    return {
      total: links.length,
      unique: new Set(links.map((link) => link.href)).size,
      internal,
      external,
      empty,
    }
  }, [page])

  const search = query.trim().toLowerCase()
  const match = (link: LinkInfo): boolean =>
    !search ||
    link.href.toLowerCase().includes(search) ||
    link.text.toLowerCase().includes(search)

  const internal = groups.internal.filter(match)
  const external = groups.external.filter(match)
  const empty = groups.empty.filter(match)
  const counts = {
    total: groups.total,
    internal: groups.internal.length,
    external: groups.external.length,
    empty: groups.empty.length,
  }

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
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-4 gap-1.5">
        <Stat label="Total" value={groups.total} />
        <Stat label="Unique" value={groups.unique} />
        <Stat label="Internal" value={groups.internal.length} accent />
        <Stat label="External" value={groups.external.length} />
      </div>

      {groups.empty.length > 0 && (
        <p className="flex items-center gap-1.5 rounded-sm bg-warn-soft px-2 py-1.5 text-xs text-warn">
          <Icon name="alert" size={13} />
          <span>
            {groups.empty.length} link{groups.empty.length === 1 ? '' : 's'} without anchor text
          </span>
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="no-scrollbar flex gap-0.5 overflow-x-auto rounded-md border border-line bg-surface-2 p-0.5" role="tablist" aria-label="Filter links">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              role="tab"
              aria-selected={kind === option.id}
              className={cn(
                'flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-[11.5px] whitespace-nowrap transition-colors duration-150',
                kind === option.id ? 'bg-surface font-semibold text-accent shadow-soft' : 'text-muted hover:text-ink'
              )}
              onClick={() => setKind(option.id)}
            >
              {option.label(counts)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 rounded-sm border border-line bg-surface px-2 text-muted focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
          <Icon name="search" size={13} />
          <input
            className="w-full min-w-0 flex-1 bg-transparent py-1.5 text-xs text-ink outline-none"
            type="search"
            placeholder="Filter links\u2026"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {kind === 'internal' && <LinkSection title="Internal" links={internal} pageUrl={page.url} onCopy={copy} copied={copied} />}
      {kind === 'external' && <LinkSection title="External" links={external} pageUrl={page.url} onCopy={copy} copied={copied} />}
      {kind === 'empty' && <LinkSection title="Missing anchor text" links={empty} pageUrl={page.url} onCopy={copy} copied={copied} />}
      {kind === 'all' && (
        <>
          <LinkSection title="Internal" links={internal} pageUrl={page.url} onCopy={copy} copied={copied} />
          <LinkSection title="External" links={external} pageUrl={page.url} onCopy={copy} copied={copied} />
        </>
      )}

      {groups.total === 0 && (
        <EmptyState
          icon="link"
          title="No links on this page"
          hint="Links found here will be listed with their anchor text."
        />
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-md border bg-surface px-1 py-2 text-center shadow-soft',
        accent ? 'border-accent bg-accent-soft' : 'border-line'
      )}
    >
      <div className="text-[17px] leading-tight font-bold">{value.toLocaleString('en-US')}</div>
      <div className="text-[10.5px] tracking-[0.05em] text-muted uppercase">{label}</div>
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
    <section className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
        {title}
        <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10.5px] font-semibold text-muted">
          {links.length}
        </span>
      </h3>
      <ul className="max-h-60 list-none overflow-auto rounded-md border border-line bg-surface">
        {links.map((link, index) => (
          <li
            className="group flex items-center gap-2 border-b border-line px-2 py-1.5 text-xs transition-colors duration-150 last:border-b-0 hover:bg-surface-2"
            key={`${link.href}-${index}`}
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-accent" title={link.href}>
              {displayHref(link.href, pageUrl)}
            </span>
            <span
              className={cn(
                'max-w-[45%] shrink-0 truncate text-right text-muted',
                !link.text && 'text-fail italic'
              )}
            >
              {link.text || 'No anchor text'}
            </span>
            <button
              className="grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-sm border border-transparent bg-transparent text-muted opacity-0 transition hover:bg-surface-3 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
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
