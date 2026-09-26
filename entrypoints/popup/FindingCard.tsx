import type { Finding } from '../../lib/types'
import { Icon } from './Icon'

const STATUS_ICON = { pass: 'check', warn: 'alert', fail: 'close' } as const

export function FindingCard({ finding }: { finding: Finding }) {
  return (
    <details className={`card ${finding.status}`}>
      <summary className="card-head">
        <span className="card-status" aria-hidden="true">
          <Icon name={STATUS_ICON[finding.status]} size={12} />
        </span>
        <span className="card-title">{finding.label}</span>
        {typeof finding.length === 'number' && (
          <span className={`chip ${chipTone(finding)}`}>{finding.length} chars</span>
        )}
        <Icon name="chevron" size={14} className="chevron" />
      </summary>

      <div className="card-body">
        {finding.value !== null && <p className="card-value">{finding.value}</p>}
        <p className="card-message">{finding.message}</p>

        {finding.fix && (
          <p className="card-fix">
            <Icon name="sparkle" size={12} />
            <span>{finding.fix}</span>
          </p>
        )}

        {finding.items && finding.items.length > 0 && (
          <ul className="card-list">
            {finding.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}

/** Title/description limits live around 50–60 and 120–160 characters. */
function chipTone(finding: Finding): string {
  if (typeof finding.length !== 'number') return 'neutral'
  if (finding.length > 160) return 'fail'
  if (finding.length > 70) return 'warn'
  if (finding.length < 20) return 'warn'
  return 'pass'
}
