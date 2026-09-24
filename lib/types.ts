// The data every check receives. Populated by `lib/extract.ts`, which runs in
// the inspected page. Keep this serializable — it crosses the page/extension
// boundary.

export interface PageData {
  url: string
  title: string
  description: string | null
  canonical: string | null
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
}

export type Check = (page: PageData) => Finding[]
