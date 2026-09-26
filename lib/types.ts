// The data every check receives. Populated by `lib/extract.ts`, which runs in
// the inspected page. Keep this serializable — it crosses the page/extension
// boundary.

export interface Heading {
  /** 1–6, corresponding to H1–H6. */
  level: number
  text: string
}

export interface LinkInfo {
  /** Absolute URL. */
  href: string
  /** The `rel` attribute value, if any. */
  rel: string
  /** The `target` attribute value, if any. */
  target: string
  /** Accessible link text (falls back to aria-label/title/image alt). */
  text: string
}

export interface PageData {
  url: string
  title: string
  description: string | null
  canonical: string | null
  /** Contents of `<meta name="robots">` / `googlebot` tags. */
  robotsMeta: string[]
  /** Open Graph / Twitter Card metadata. */
  social: SocialMeta
  headings: Heading[]
  links: LinkInfo[]
  /** Total words in the page's visible text (scripts/styles excluded). */
  wordCount: number
}

/** Open Graph and Twitter Card tags, keyed without their prefix. */
export interface SocialMeta {
  /** e.g. `title`, `image`, `image:width` (from `og:*`). */
  openGraph: Record<string, string>
  /** e.g. `card`, `title`, `image` (from `twitter:*`). */
  twitter: Record<string, string>
}

/** Data fetched over the network (same-origin) after the DOM is read. */
export interface SiteContext {
  robotsTxt: string | null
  robotsTxtChecked: boolean
  xRobotsTag: string | null
  xRobotsTagChecked: boolean
}

export type Status = 'pass' | 'warn' | 'fail'

export interface Finding {
  /** Stable identifier, e.g. `title-too-long`. */
  id: string
  /** Human-readable label, e.g. `Title`. */
  label: string
  /** The value that was audited. */
  value: string | null
  /** Length of `value` in characters, when meaningful (e.g. titles). */
  length?: number
  status: Status
  /** What the check found. */
  message: string
  /** How to fix it, if applicable. */
  fix?: string
  /** Optional list of related details (e.g. a heading outline). */
  items?: string[]
}

export type Check = (page: PageData, context: SiteContext) => Finding[]
