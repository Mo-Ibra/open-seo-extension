// The data every check receives. Populated by `lib/extract.ts`, which runs in
// the inspected page. Keep this serializable — it crosses the page/extension
// boundary.

import type { LengthBudget } from './limits'

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
  /**
   * Indexable words in the page's main content, including text that is hidden
   * right now — behind a closed `<details>`, a `hidden` attribute, or an inline
   * `display:none` panel. Visibility deliberately does not affect this number;
   * see `lib/extract.ts`.
   */
  wordCount: number
  /**
   * How many of `wordCount` a reader cannot see until they interact, i.e. text
   * inside a closed accordion, a hidden panel or a stepper's inactive steps.
   * Always `<= wordCount`. Reported separately so the audit can say "321 of 428
   * words are behind a click" instead of quietly returning a smaller number.
   */
  hiddenWordCount: number
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
  /**
   * The length budget `length` should be measured against, when the check has
   * one. Lets the UI grade the number it shows without re-deriving the limits.
   */
  budget?: LengthBudget
  status: Status
  /** What the check found. */
  message: string
  /** How to fix it, if applicable. */
  fix?: string
  /** Optional list of related details (e.g. a heading outline). */
  items?: string[]
}

export type Check = (page: PageData, context: SiteContext) => Finding[]
