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
  return (
    <section className="serp" aria-label="Search result preview">
      <div className="serp-url">{hostname(page.url)}</div>
      <div className="serp-title">
        {page.title ? truncate(page.title, TITLE_LIMIT) : 'No title'}
      </div>
      <div className="serp-description">
        {page.description
          ? truncate(page.description, DESCRIPTION_LIMIT)
          : 'No meta description'}
      </div>
    </section>
  )
}
