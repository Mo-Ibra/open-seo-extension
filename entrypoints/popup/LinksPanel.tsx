import { useMemo } from 'react'

import type { LinkInfo, PageData } from '../../lib/types'

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
  const { total, unique, internal, external, withoutText } = useMemo(() => {
    const links = page.links.filter(isRealLink)
    const internalLinks = links.filter((link) => isInternal(link.href, page.url))
    const externalLinks = links.filter((link) => !isInternal(link.href, page.url))
    return {
      total: links.length,
      unique: new Set(links.map((link) => link.href)).size,
      internal: internalLinks,
      external: externalLinks,
      withoutText: links.filter((link) => !link.text).length,
    }
  }, [page])

  return (
    <div className="links-panel">
      <div className="stats">
        <Stat label="Total" value={total} />
        <Stat label="Unique" value={unique} />
        <Stat label="Internal" value={internal.length} />
        <Stat label="External" value={external.length} />
      </div>

      {withoutText > 0 && (
        <p className="links-warning">{withoutText} link(s) have no anchor text</p>
      )}

      <LinkSection title="Internal Links" links={internal} pageUrl={page.url} />
      <LinkSection title="External Links" links={external} pageUrl={page.url} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function LinkSection({
  title,
  links,
  pageUrl,
}: {
  title: string
  links: LinkInfo[]
  pageUrl: string
}) {
  return (
    <section className="link-section">
      <h3 className="link-section-title">
        {title} <span className="link-count">{links.length}</span>
      </h3>
      {links.length === 0 ? (
        <p className="link-empty">None</p>
      ) : (
        <ul className="link-list">
          {links.map((link, index) => (
            <li className="link-row" key={`${link.href}-${index}`}>
              <span className="link-href" title={link.href}>
                {displayHref(link.href, pageUrl)}
              </span>
              <span className={link.text ? 'link-text' : 'link-text empty'}>
                {link.text || 'No anchor text'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
