/** Circular score gauge used by the site report. */
export function ScoreRing({
  score,
  size = 84,
  label = 'score',
}: {
  score: number
  size?: number
  label?: string
}) {
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const offset = circumference * (1 - clamped / 100)
  const tone = clamped >= 80 ? 'pass' : clamped >= 50 ? 'warn' : 'fail'

  return (
    <div className={`ring ${tone}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${label}: ${clamped} of 100`}>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <span className="ring-number">{clamped}</span>
        <span className="ring-label">{label}</span>
      </div>
    </div>
  )
}
