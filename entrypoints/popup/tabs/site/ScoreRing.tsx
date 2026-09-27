import { TONE } from '../../constants/tone'
import { cn } from '../../shared/cn'

/**
 * Circular score gauge used by the site report.
 *
 * Drawn as an SVG circle with a `stroke-dashoffset` "gap" rather than a
 * `<conic-gradient>`: the gradient approach cannot be animated smoothly and
 * needs a second element to mask the centre, whereas `stroke-dasharray` is one
 * element and transitions on a single property. The circle is rotated -90°
 * so the stroke starts at twelve o'clock instead of three.
 *
 * The ring is `aria-hidden` in effect — the text in the middle is the real
 * content — but it keeps a `role="img"` label so a screen reader announces
 * "score: 82 of 100" rather than two unlabelled fragments.
 */
export function ScoreRing({
  score,
  size = 84,
  label = 'score',
}: {
  /** 0–100. Values outside the range are clamped rather than rejected. */
  score: number
  size?: number
  label?: string
}) {
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const offset = circumference * (1 - clamped / 100)

  // Same thresholds as the pass/warn/fail verdict elsewhere in the popup.
  const tone = clamped >= 80 ? 'pass' : clamped >= 50 ? 'warn' : 'fail'

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`${label}: ${clamped} of 100`}
      >
        {/* Full-circle track behind the progress stroke. */}
        <circle
          className="stroke-surface-3"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className={cn('transition-[stroke-dashoffset] duration-700 ease-out', TONE.stroke[tone])}
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
