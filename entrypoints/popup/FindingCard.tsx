import type { Finding } from '../../lib/types'
import { cn } from './cn'
import { Icon } from './Icon'

const STATUS_ICON = { pass: 'check', warn: 'alert', fail: 'close' } as const

const STATUS_CARD = {
  pass: 'border-l-pass',
  warn: 'border-l-warn',
  fail: 'border-l-fail',
} as const

const STATUS_BADGE = {
  pass: 'bg-pass-soft text-pass',
  warn: 'bg-warn-soft text-warn',
  fail: 'bg-fail-soft text-fail',
} as const

export function FindingCard({ finding }: { finding: Finding }) {
  return (
    <details
      className={cn(
        'group rounded-md border border-line border-l-[3px] bg-surface shadow-soft transition-shadow duration-150 hover:shadow-lift',
        STATUS_CARD[finding.status]
      )}
    >
      <summary
        className="hide-marker flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 select-none"
        aria-label={`${finding.label}: ${finding.status}`}
      >
        <span
          className={cn(
            'grid size-[17px] shrink-0 place-items-center rounded-full',
            STATUS_BADGE[finding.status]
          )}
          aria-hidden="true"
        >
          <Icon name={STATUS_ICON[finding.status]} size={12} />
        </span>
        <span className="text-[12.5px] font-semibold">{finding.label}</span>
        {typeof finding.length === 'number' && (
          <span
            className={cn(
              'ml-auto rounded-full px-[7px] py-px text-[10.5px] font-semibold',
              chipTone(finding)
            )}
          >
            {finding.length} chars
          </span>
        )}
        <Icon name="chevron" size={14} className="text-muted transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <div className="border-t border-dashed border-line pt-2 pr-2.5 pb-2.5 pl-[34px]">
        {finding.value !== null && (
          <p className="m-0 rounded-sm bg-surface-2 px-2 py-1.5 text-xs break-words">{finding.value}</p>
        )}
        <p className="mt-1.5 text-xs text-ink-soft">{finding.message}</p>

        {finding.fix && (
          <p className="mt-1.5 flex gap-1.5 rounded-sm bg-accent-soft px-2 py-1.5 text-[11.5px] text-accent">
            <Icon name="sparkle" size={12} className="mt-0.5" />
            <span>{finding.fix}</span>
          </p>
        )}

        {finding.items && finding.items.length > 0 && (
          <ul className="mt-1.5 max-h-[190px] list-disc overflow-auto rounded-sm bg-surface-2 py-1.5 pr-2 pl-5 text-[11.5px] text-muted">
            {finding.items.map((item, index) => (
              <li key={index} className="my-px break-words">
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}

const CHIP_TONE = {
  pass: 'bg-pass-soft text-pass',
  warn: 'bg-warn-soft text-warn',
  fail: 'bg-fail-soft text-fail',
} as const

/** Title/description limits live around 50–60 and 120–160 characters. */
function chipTone(finding: Finding): string {
  if (typeof finding.length !== 'number') return 'bg-surface-3 text-muted'
  if (finding.length > 160) return CHIP_TONE.fail
  if (finding.length > 70) return CHIP_TONE.warn
  if (finding.length < 20) return CHIP_TONE.warn
  return CHIP_TONE.pass
}
