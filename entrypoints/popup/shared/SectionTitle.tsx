import type { ReactNode } from 'react'

/**
 * A small uppercase heading with an optional trailing count pill.
 *
 * Repeated for every collapsible group in the report, the page list and each
 * link section.
 */
export function SectionTitle({
  children,
  count,
  trailing,
}: {
  children: ReactNode
  /** Right-aligned count. Omit for sections without one. */
  count?: number
  /** Extra element pinned to the right of the title, before the count. */
  trailing?: ReactNode
}) {
  return (
    <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
      {children}
      {trailing}
      {count !== undefined && (
        <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10.5px] font-semibold text-muted">
          {count}
        </span>
      )}
    </h3>
  )
}
