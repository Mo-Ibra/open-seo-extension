import type { LinkInfo } from '../../../../lib/types'
import { cn } from '../../shared/cn'
import { Icon } from '../../shared/Icon'
import { SectionTitle } from '../../shared/SectionTitle'
import { displayHref } from '../../utils/url'

/**
 * One titled, scrollable list of links.
 *
 * Rendered with no chrome of its own beyond the heading, so a tab can show one
 * section (external only) or several stacked (all). Renders `null` rather than
 * an empty box when there is nothing to list — a "External (0)" heading is
 * noise, and the tab already has a global empty state.
 */
export function LinkSection({
  title,
  links,
  pageUrl,
  onCopy,
  copied,
}: {
  title: string
  links: LinkInfo[]
  /** The page the links were found on, used to shorten internal hrefs. */
  pageUrl: string
  /** Writes `href` to the clipboard and flashes the button. */
  onCopy: (href: string) => void
  /** The href currently showing as copied, or `null`. */
  copied: string | null
}) {
  if (links.length === 0) return null

  return (
    <section className="flex flex-col gap-1.5">
      <SectionTitle count={links.length}>{title}</SectionTitle>
      <ul className="max-h-60 list-none overflow-auto rounded-md border border-line bg-surface">
        {links.map((link, index) => (
          <li
            className="group flex items-center gap-2 border-b border-line px-2 py-1.5 text-xs transition-colors duration-150 last:border-b-0 hover:bg-surface-2"
            // The same href can legitimately appear twice on a page, so the
            // index is needed to keep the key unique.
            key={`${link.href}-${index}`}
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-accent" title={link.href}>
              {displayHref(link.href, pageUrl)}
            </span>
            <span
              className={cn('max-w-[45%] shrink-0 truncate text-right text-muted', !link.text && 'text-fail italic')}
            >
              {link.text || 'No anchor text'}
            </span>
            <button
              className="grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-sm border border-transparent bg-transparent text-muted opacity-0 transition hover:bg-surface-3 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
              title="Copy URL"
              aria-label={`Copy ${link.href}`}
              onClick={() => onCopy(link.href)}
            >
              <Icon name={copied === link.href ? 'check' : 'copy'} size={12} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
