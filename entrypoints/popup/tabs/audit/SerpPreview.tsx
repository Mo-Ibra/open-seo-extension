import {
  DESCRIPTION_BUDGET,
  TITLE_BUDGET,
  lengthStatus,
  type LengthBudget,
} from '../../../../lib/limits'
import type { PageData } from '../../../../lib/types'
import { TONE, type Tone } from '../../constants/tone'
import { cn } from '../../shared/cn'
import { truncate } from '../../utils/text'
import { hostname } from '../../utils/url'

/**
 * A rough preview of how the page's title and description may appear in search.
 *
 * Two length meters sit under the preview so the user can see *why* a field is
 * flagged, and they are graded by the same budgets the audit checks use
 * (`lib/limits.ts`) — otherwise this panel and the findings list could give
 * opposite verdicts on the same string.
 */
export function SerpPreview({ page }: { page: PageData }) {
  return (
    <section className="rounded-lg border border-line bg-surface px-3 py-2.5 shadow-soft" aria-label="Search result preview">
      <header className="mb-1.5 flex items-center gap-1.5">
        <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-semibold tracking-[0.05em] text-muted uppercase">
          Search preview
        </span>
        <span className="truncate text-[11.5px] text-muted">{hostname(page.url)}</span>
      </header>

      <div className="mb-1 text-[16px] leading-snug font-medium text-[#1a0dab] dark:text-[#8ab4f8]">
        {page.title ? truncate(page.title, TITLE_BUDGET.max) : 'No title'}
      </div>
      <Meter
        label="title"
        value={page.title}
        budget={TITLE_BUDGET}
        tone={lengthStatus(page.title, TITLE_BUDGET)}
      />

      <p className="mt-1.5 mb-1 text-xs text-ink-soft">
        {page.description
          ? truncate(page.description, DESCRIPTION_BUDGET.max)
          : 'No meta description — search engines will improvise one.'}
      </p>
      <Meter
        label="description"
        value={page.description}
        budget={DESCRIPTION_BUDGET}
        tone={lengthStatus(page.description, DESCRIPTION_BUDGET)}
      />
    </section>
  )
}

/**
 * A progress bar for one metadata field: how full it is against its budget,
 * tinted by the resulting status.
 *
 * The bar is drawn as a percentage of the budget's *maximum*, so a full bar
 * means "at the limit" rather than "good" — an over-long title pins the bar at
 * 100% and turns red-adjacent, which is the honest reading.
 */
function Meter({
  label,
  value,
  budget,
  tone,
}: {
  label: string
  /** The raw field, or `null` when it is missing. */
  value: string | null
  budget: LengthBudget
  tone: Tone
}) {
  const length = value?.length ?? 0
  const width = Math.min(100, (length / budget.max) * 100)

  return (
    <div className="mt-1.25 flex items-center gap-2">
      <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
        <span
          className={cn('block h-full rounded-full transition-[width] duration-200', TONE.fill[tone])}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="text-[10.5px] whitespace-nowrap text-muted">
        {label} {length}/{budget.max}
      </span>
    </div>
  )
}
