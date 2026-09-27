import { useMemo } from 'react'

import type { Finding, Status } from '../../../../lib/types'
import { TONE } from '../../constants/tone'
import { cn } from '../../shared/cn'
import { Icon } from '../../shared/Icon'

/**
 * One-line verdict for the current page: counts plus a proportional bar.
 *
 * The bar is a single row of flex-growing spans rather than four divs, so it
 * stays a single line at any width. A count of zero still gets a hair of width
 * (`|| 0.0001`) so a passing check does not make the bar collapse to a gap.
 */
export function AuditTab({ findings }: { findings: Finding[] }) {
  const counts = useMemo(() => tally(findings), [findings])

  const verdict: Record<Status, string> = {
    pass: 'Looking good',
    warn: 'Almost there',
    fail: 'Needs work',
  }
  // The worst outcome wins, so the headline never flatters a broken page.
  const worst: Status = counts.fail > 0 ? 'fail' : counts.warn > 0 ? 'warn' : 'pass'

  return (
    <section
      className="rounded-lg border border-line bg-surface px-3 py-2.5 shadow-soft"
      aria-label="Audit summary"
    >
      <div className="mb-1.5 flex items-baseline justify-between">
        <strong className="text-[13px]">{verdict[worst]}</strong>
        <span className="text-[11px] text-muted">{findings.length} checks</span>
      </div>

      <div
        className="mb-2 flex h-1.5 gap-0.5"
        role="img"
        aria-label={`${counts.pass} pass, ${counts.warn} warn, ${counts.fail} fail`}
      >
        <span className="min-w-0.5 rounded-full bg-pass" style={{ flexGrow: counts.pass || 0.0001 }} />
        <span className="min-w-0.5 rounded-full bg-warn" style={{ flexGrow: counts.warn || 0.0001 }} />
        <span className="min-w-0.5 rounded-full bg-fail" style={{ flexGrow: counts.fail || 0.0001 }} />
        {/* Unaccounted remainder, so the bar width is the number of checks. */}
        <span
          className="rounded-full bg-surface-3"
          style={{ flexGrow: Math.max(0, findings.length - counts.pass - counts.warn - counts.fail) }}
        />
      </div>

      <ul className="flex list-none gap-3 text-[11.5px] text-muted">
        <Legend tone="pass" value={counts.pass} label="pass" />
        <Legend tone="warn" value={counts.warn} label="warn" />
        <Legend tone="fail" value={counts.fail} label="fail" />
      </ul>
    </section>
  )
}

/** Counts findings per status in one pass, instead of three `filter` calls. */
function tally(findings: Finding[]): Record<Status, number> {
  const totals: Record<Status, number> = { pass: 0, warn: 0, fail: 0 }
  for (const finding of findings) totals[finding.status]++
  return totals
}

/** A single `N pass` / `N warn` / `N fail` entry under the bar. */
function Legend({ tone, value, label }: { tone: Status; value: number; label: string }) {
  return (
    <li className={cn('inline-flex items-center gap-0.5', TONE.text[tone])}>
      <Icon name={value > 0 && tone === 'fail' ? 'alert' : 'check'} size={13} />
      <b className="text-ink">{value}</b> {label}
    </li>
  )
}
