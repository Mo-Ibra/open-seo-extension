/** Compact circular progress used while the site scan runs. */
export function ProgressRing({ done, total }: { done: number; total: number }) {
  const size = 64
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const percent = total > 0 ? Math.min(100, (done / total) * 100) : 0

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${Math.round(percent)}% complete`}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="progress-percent">{Math.round(percent)}%</span>
    </div>
  )
}
