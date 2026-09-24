import type { Check, Finding, PageData } from './types'
import { titleCheck } from './checks/title'
import { descriptionCheck } from './checks/description'
import { canonicalCheck } from './checks/canonical'

/**
 * Every check that runs against a page. Adding a new check is a one-line change
 * here plus the check file in `lib/checks/`.
 */
export const checks: Check[] = [titleCheck, descriptionCheck, canonicalCheck]

/** Runs all checks and flattens their findings. */
export function runAudit(page: PageData): Finding[] {
  return checks.flatMap((check) => check(page))
}
