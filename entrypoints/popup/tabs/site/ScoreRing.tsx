import { cn } from '../../shared/cn'

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

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`${label}: ${clamped} of 100`}
      >
        <circle
          className="stroke-surface-3"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className={cn(
            'transition-[stroke-dashoffset] duration-700 ease-out',
            clamped >= 80 ? 'stroke-pass' : clamped >= 50 ? 'stroke-warn' : 'stroke-fail'
          )}
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] leading-none font-bold">{clamped}</span>
        <span className="text-[9.5px] tracking-[0.08em] text-muted uppercase">{label}</span>
      </div>
    </div>
  )
}
