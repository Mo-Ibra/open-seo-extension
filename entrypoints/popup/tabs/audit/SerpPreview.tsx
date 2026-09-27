import type { PageData } from '../../../../lib/types'
import { cn } from '../../shared/cn'

const TITLE_LIMIT = 60
const DESCRIPTION_LIMIT = 160

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}\u2026` : value
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** A rough preview of how the page's title/description may appear in search. */
export function SerpPreview({ page }: { page: PageData }) {
  const titleLength = page.title.length
  const descriptionLength = page.description?.length ?? 0

  return (
    <section className="rounded-lg border border-line bg-surface px-3 py-2.5 shadow-soft" aria-label="Search result preview">
      <header className="mb-1.5 flex items-center gap-1.5">
        <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px] font-semibold tracking-[0.05em] text-muted uppercase">
          Search preview
        </span>
        <span className="truncate text-[11.5px] text-muted">{hostname(page.url)}</span>
      </header>

      <div className="mb-1 text-[16px] leading-snug font-medium text-[#1a0dab] dark:text-[#8ab4f8]">
        {page.title ? truncate(page.title, TITLE_LIMIT) : 'No title'}
      </div>
      <Meter
        label="title"
        value={titleLength}
        limit={TITLE_LIMIT}
        tone={titleLength > TITLE_LIMIT ? 'fail' : titleLength < 20 ? 'warn' : 'pass'}
      />

      <p className="mt-1.5 mb-1 text-xs text-ink-soft">
        {page.description
          ? truncate(page.description, DESCRIPTION_LIMIT)
          : 'No meta description — search engines will improvise one.'}
      </p>
      <Meter
        label="description"
        value={descriptionLength}
        limit={DESCRIPTION_LIMIT}
        tone={
          descriptionLength === 0
            ? 'fail'
            : descriptionLength > DESCRIPTION_LIMIT
              ? 'warn'
              : descriptionLength < 70
                ? 'warn'
                : 'pass'
        }
      />
    </section>
  )
}

const FILL_TONE = { pass: 'bg-pass', warn: 'bg-warn', fail: 'bg-fail' } as const

function Meter({
  label,
  value,
  limit,
  tone,
}: {
  label: string
  value: number
  limit: number
  tone: 'pass' | 'warn' | 'fail'
}) {
  const width = Math.min(100, (value / limit) * 100)
  return (
    <div className="mt-1.25 flex items-center gap-2">
      <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3">
        <span
          className={cn('block h-full rounded-full transition-[width] duration-200', FILL_TONE[tone])}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="text-[10.5px] whitespace-nowrap text-muted">
        {label} {value}/{limit}
      </span>
    </div>
  )
}
