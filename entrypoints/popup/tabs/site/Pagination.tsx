import { URL_PAGE_SIZES } from '../../constants/site'
import { formatCount } from '../../utils/format'
import type { Page } from '../../utils/paginate'
import { cn } from '../../shared/cn'
import { Icon } from '../../shared/Icon'

/**
 * Page controls and a "showing X–Y of Z" label for a long list.
 *
 * Lives in `tabs/site/` because the page picker is the only thing that needs it
 * today. It is deliberately free of site-specific knowledge, so if a second tab
 * grows a long list it should move to `shared/` rather than be imported across
 * from here.
 *
 * Takes an already-computed `Page` rather than the raw list, so the clamping
 * rules live in one place (`utils/paginate.ts`) instead of being re-implemented
 * by every caller. The `page` it renders is the *clamped* one, which means a
 * stale page number can never leave the label reading "Showing 700–800 of 769".
 */
export function Pagination<T>({
  page,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: Page<T>
  /** Total across all pages, for the "of Z" label. */
  total: number
  pageSize: number
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  // An empty result set is the search box's "no matches" case, not a page to
  // navigate. The caller renders its own empty message.
  if (total === 0) return null

  const { items, first, last, pageIndex, pageCount } = page
  const isFirst = pageIndex === 0
  const isLast = pageIndex === pageCount - 1

  return (
    <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
      <span className="flex-1 whitespace-nowrap">
        Showing {formatCount(first + 1)}–{formatCount(last)} of {formatCount(total)}
      </span>

      {/* Only worth offering when it changes the number of pages. */}
      {URL_PAGE_SIZES[URL_PAGE_SIZES.length - 1] < total && (
        <select
          className="cursor-pointer rounded-sm border border-line bg-surface px-1 py-0.5 text-[11px] text-ink-soft outline-none"
          aria-label="URLs per page"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {URL_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      )}

      <StepButton
        label="Previous page"
        disabled={isFirst}
        onClick={() => onPageChange(pageIndex - 1)}
        direction="previous"
      />
      <span className="whitespace-nowrap tabular-nums">
        {formatCount(pageIndex + 1)} / {formatCount(pageCount)}
      </span>
      <StepButton
        label="Next page"
        disabled={isLast}
        onClick={() => onPageChange(pageIndex + 1)}
        direction="next"
      />

      {/* Announce the move for screen readers; the visual change is far away. */}
      <span className="sr-only" aria-live="polite">
        {`Showing ${items.length} of ${total} URLs`}
      </span>
    </div>
  )
}

/** A previous/next chevron. Icon-only, so the accessible name is explicit. */
function StepButton({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  direction: 'previous' | 'next'
}) {
  return (
    <button
      className={cn(
        'grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-sm border border-line bg-surface',
        disabled
          ? 'text-muted opacity-40'
          : 'text-ink-soft hover:border-line-strong hover:bg-surface-2'
      )}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {/* One chevron glyph, rotated for the previous direction. */}
      <Icon name="chevron" size={12} className={direction === 'previous' ? 'rotate-180' : undefined} />
    </button>
  )
}
