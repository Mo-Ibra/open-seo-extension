import { LinkInfo } from "@/lib/types"
import { Icon } from "../../shared/Icon"
import { displayHref } from "./funcs"
import { cn } from "../../shared/cn"

export default function LinkSection({
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