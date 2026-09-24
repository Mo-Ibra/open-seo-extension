import type { Check, Finding, PageData, SiteContext } from './types'
import { titleCheck } from './checks/title'
import { descriptionCheck } from './checks/description'
import { canonicalCheck } from './checks/canonical'
import { robotsMetaCheck } from './checks/robots-meta'
import { xRobotsTagCheck } from './checks/x-robots-tag'
import { robotsTxtCheck } from './checks/robots-txt'
import { socialCheck } from './checks/social'
import { headingsCheck } from './checks/headings'
import { linksCheck } from './checks/links'

/**
 * Every check that runs against a page. Adding a new check is a one-line change
 * here plus the check file in `lib/checks/`.
 */
export const checks: Check[] = [
  titleCheck,
  descriptionCheck,
  canonicalCheck,
  robotsMetaCheck,
  xRobotsTagCheck,
  robotsTxtCheck,
  socialCheck,
  headingsCheck,
  linksCheck,
]

/** Runs all checks and flattens their findings. */
export function runAudit(page: PageData, context: SiteContext): Finding[] {
  return checks.flatMap((check) => check(page, context))
}
