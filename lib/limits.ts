/**
 * The single source of truth for "how long is too long" in this extension.
 *
 * These numbers were previously written down three times: once in
 * `lib/checks/title.ts`, once in `lib/checks/description.ts` and again in the
 * popup as `TITLE_LIMIT` / `DESCRIPTION_LIMIT`. They had already drifted — the
 * popup flagged a 20-character title while the check flagged 30 — so the SERP
 * meter and the finding card could disagree about the same string.
 *
 * Everything that reasons about a length now imports from here:
 *   - the checks, to decide pass/warn/fail and to build the "aim for" hint;
 *   - `SerpPreview`, to size the bars and truncate the preview;
 *   - `FindingCard`, to colour the "N chars" chip.
 *
 * The limits are character counts, not pixel widths. A pixel-width measurement
 * is more accurate and can replace them here later without touching callers.
 */

import type { Status } from './types'

/** A character budget for a single metadata field. */
export interface LengthBudget {
  /** Lower bound. Below this the field is probably under-written. */
  readonly min: number
  /** Upper bound. Above this search results usually truncate it. */
  readonly max: number
  /**
   * The caller's name for the field, used to build the "Aim for 30–60
   * characters" hint. Sentence-cased because it is interpolated mid-sentence.
   */
  readonly label: string
}

/** `<title>` budget. */
export const TITLE_BUDGET: LengthBudget = { min: 30, max: 60, label: 'title' }

/** `<meta name="description">` budget. */
export const DESCRIPTION_BUDGET: LengthBudget = { min: 70, max: 160, label: 'description' }

/** Human-readable range hint, e.g. `Aim for 30–60 characters.` */
export function aimHint(budget: LengthBudget): string {
  return `Aim for ${budget.min}\u2013${budget.max} characters.`
}

/** Below the lower bound: present but thin. */
export function isTooShort(value: string | null, budget: LengthBudget): boolean {
  return value !== null && value.length < budget.min
}

/** Above the upper bound: present but will be cut off in search results. */
export function isTooLong(value: string | null, budget: LengthBudget): boolean {
  return value !== null && value.length > budget.max
}

/**
 * Grades a field length for display only — the checks own the messaging.
 *
 * A missing value fails. Anything present that falls outside the budget only
 * warns: being too long is a "you will lose text in the SERP" problem, not a
 * broken page, and the audit tab already lists it as an issue.
 */
export function lengthStatus(value: string | null, budget: LengthBudget): Status {
  if (value === null) return 'fail'
  if (isTooShort(value, budget) || isTooLong(value, budget)) return 'warn'
  return 'pass'
}
