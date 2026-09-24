import type { Finding } from '../../lib/types'

export function FindingCard({ finding }: { finding: Finding }) {
  return (
    <details className={`card ${finding.status}`}>
      <summary className="card-head">
        <span className="dot" aria-hidden="true" />
        <strong>{finding.label}</strong>
        {typeof finding.length === 'number' && (
          <span className="length">{finding.length} chars</span>
        )}
        <span className="chevron" aria-hidden="true" />
      </summary>
      <div className="card-body">
        <div className="card-value">{finding.value ?? <em>Not set</em>}</div>
        <div className="card-message">{finding.message}</div>
        {finding.fix && <div className="card-fix">Fix: {finding.fix}</div>}
      </div>
    </details>
  )
}
