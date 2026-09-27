import { cn } from './cn'
import { Icon } from './Icon'

/**
 * A horizontal progress indicator for a multi-stage flow.
 *
 * Steps before `current` render as done (green tick), `current` is highlighted,
 * and the rest are muted. Used by the site tab for Discover → Choose → Scan →
 * Report.
 */
export function Stepper({
  steps,
  current,
  label = 'Progress',
}: {
  /** Stage labels, in order. */
  steps: readonly string[]
  /** Zero-based index of the active stage. */
  current: number
  label?: string
}) {
  return (
    <ol className="flex list-none items-center gap-0.5" aria-label={label}>
      {steps.map((step, index) => (
        <li
          key={step}
          className={cn(
            'flex flex-1 items-center gap-1.25 text-[10.5px] font-semibold tracking-[0.05em] text-muted uppercase',
            index === current && 'text-accent',
            index < current && 'text-pass',
            // The trailing hairline is drawn on every step but the last.
            index < steps.length - 1 &&
              "after:h-px after:flex-1 after:bg-line after:content-[''] after:my-1"
          )}
        >
          <span
            className={cn(
              'grid size-[18px] shrink-0 place-items-center rounded-full border bg-surface text-[10px]',
              index === current && 'border-accent bg-accent-soft text-accent',
              index < current && 'border-pass bg-pass-soft text-pass'
            )}
          >
            {index < current ? <Icon name="check" size={10} /> : index + 1}
          </span>
          <span className="truncate">{step}</span>
        </li>
      ))}
    </ol>
  )
}
