import type { PageData } from '../../lib/types'

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
    <section className="serp" aria-label="Search result preview">
      <header className="serp-head">
        <span className="serp-badge">Search preview</span>
        <span className="serp-host">{hostname(page.url)}</span>
      </header>

      <div className="serp-title">
        {page.title ? truncate(page.title, TITLE_LIMIT) : 'No title'}
      </div>
      <Meter
        label="title"
        value={titleLength}
        limit={TITLE_LIMIT}
        tone={titleLength > TITLE_LIMIT ? 'fail' : titleLength < 20 ? 'warn' : 'pass'}
      />

      <p className="serp-description">
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

function Meter({
  label,
  value,
  limit,
  tone,
}: {
  label: string
  value: number
  limit: number
  tone: string
}) {
  const width = Math.min(100, (value / limit) * 100)
  return (
    <div className={`meter ${tone}`}>
      <span className="meter-track">
        <span className="meter-fill" style={{ width: `${width}%` }} />
      </span>
      <span className="meter-text">
        {label} {value}/{limit}
      </span>
    </div>
  )
}
