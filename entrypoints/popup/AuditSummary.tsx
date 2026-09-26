import { useMemo } from 'react'

import type { Finding } from '../../lib/types'
import { Icon } from './Icon'

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
    <section className="summary" aria-label="Audit summary">
      <div className="summary-top">
        <strong className="summary-verdict">{verdict}</strong>
        <span className="summary-total">{findings.length} checks</span>
      </div>

      <div className="summary-bar" role="img" aria-label={`${counts.pass} pass, ${counts.warn} warn, ${counts.fail} fail`}>
        <span className="seg pass" style={{ flexGrow: counts.pass || 0.0001 }} />
        <span className="seg warn" style={{ flexGrow: counts.warn || 0.0001 }} />
        <span className="seg fail" style={{ flexGrow: counts.fail || 0.0001 }} />
        <span className="seg rest" style={{ flexGrow: Math.max(0, total - counts.pass - counts.warn - counts.fail) }} />
      </div>

      <ul className="summary-legend">
        <Legend tone="pass" value={counts.pass} label="pass" />
        <Legend tone="warn" value={counts.warn} label="warn" />
        <Legend tone="fail" value={counts.fail} label="fail" />
      </ul>
    </section>
  )
}

function Legend({ tone, value, label }: { tone: string; value: number; label: string }) {
  return (
    <li className={`legend ${tone}`}>
      <Icon name={value > 0 && tone === 'fail' ? 'alert' : 'check'} size={13} />
      <b>{value}</b> {label}
    </li>
  )
}
