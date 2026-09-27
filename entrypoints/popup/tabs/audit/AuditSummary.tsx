import { useMemo } from 'react'

import type { Finding } from '../../../../lib/types'
import { cn } from '../../shared/cn'
import { Icon } from '../../shared/Icon'

/** One-line verdict for the current page: counts plus a proportional bar. */
export function AuditSummary({ findings }: { findings: Finding[] }) {
  const counts = useMemo(() => {
    const totals = { pass: 0, warn: 0, fail: 0 }
    for (const finding of findings) totals[finding.status]++
    return totals
  }, [findings])

  const total = Math.max(1, findings.length)
  const verdict =
    counts.fail > 0 ? 'Needs work' : counts.warn > 0 ? 'Almost there' : 'Looking good'

  return (
    <section
      className="rounded-lg border border-line bg-surface px-3 py-2.5 shadow-soft"
      aria-label="Audit summary"
    >
      <div className="mb-1.5 flex items-baseline justify-between">
        <strong className="text-[13px]">{verdict}</strong>
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
        <span
          className="rounded-full bg-surface-3"
          style={{ flexGrow: Math.max(0, total - counts.pass - counts.warn - counts.fail) }}
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

/** Static map: Tailwind only sees class names it can find in the source. */
const TONE_CLASS = { pass: 'text-pass', warn: 'text-warn', fail: 'text-fail' } as const

function Legend({ tone, value, label }: { tone: 'pass' | 'warn' | 'fail'; value: number; label: string }) {
  return (
    <li className={cn('inline-flex items-center gap-0.5', TONE_CLASS[tone])}>
      <Icon name={value > 0 && tone === 'fail' ? 'alert' : 'check'} size={13} />
      <b className="text-ink">{value}</b> {label}
    </li>
  )
}
