import { lengthStatus } from '../../../../lib/limits'
import type { Finding } from '../../../../lib/types'
import { NEUTRAL_CHIP, TONE, TONE_ICON } from '../../constants/tone'
import { cn } from '../../shared/cn'
import { Icon } from '../../shared/Icon'

/**
 * A collapsible row describing one check result.
 *
 * Used both in the single-page audit list and inside each expanded page of the
 * site report, which is why it takes nothing but the finding itself.
 *
 * Built on `<details>`/`<summary>` rather than a stateful button: the open/close
 * behaviour, the keyboard handling and the "expands without JS" property all
 * come from the platform.
 */
export function FindingCard({ finding }: { finding: Finding }) {
  // Only length-bearing findings (title, description) get a character counter.
  const hasLength = typeof finding.length === 'number'

  return (
    <details
      className={cn(
        'group rounded-md border border-line border-l-[3px] bg-surface shadow-soft transition-shadow duration-150 hover:shadow-lift',
        TONE.stripe[finding.status]
      )}
    >
      <summary
        className="hide-marker flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 select-none"
        aria-label={`${finding.label}: ${finding.status}`}
      >
        <span
          className={cn('grid size-[17px] shrink-0 place-items-center rounded-full', TONE.icon[finding.status])}
          aria-hidden="true"
        >
          <Icon name={TONE_ICON[finding.status]} size={12} />
        </span>
        <span className="text-[12.5px] font-semibold">{finding.label}</span>
        {hasLength && (
          <span className={cn('ml-auto rounded-full px-[7px] py-px text-[10.5px] font-semibold', chipTone(finding))}>
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

/**
 * Colours the "N chars" counter.
 *
 * The card's left stripe already states the check's verdict; the chip restates
 * it as a tone so a 62-character title reads amber whether or not the user
 * expands the row. The check attaches the field's own budget, so this never
 * has to guess whether 60 characters is a long title or a short description.
 * Findings without a budget get a neutral pill — there is nothing to grade.
 */
function chipTone(finding: Finding): string {
  if (!finding.budget) return NEUTRAL_CHIP
  return TONE.chip[lengthStatus(finding.value, finding.budget)]
}
