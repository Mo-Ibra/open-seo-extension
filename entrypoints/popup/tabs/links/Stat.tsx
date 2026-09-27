import { cn } from '../../shared/cn'
import { formatCount } from '../../utils/format'

/**
 * A single number in the links tab's summary grid (Total / Unique / Internal /
 * External).
 *
 * `accent` marks the one figure worth noticing — the internal count, because
 * an unexpectedly small number usually means the page is thin on links.
 */
export function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-md border bg-surface px-1 py-2 text-center shadow-soft',
        accent ? 'border-accent bg-accent-soft' : 'border-line'
      )}
    >
      <div className="text-[17px] leading-tight font-bold">{formatCount(value)}</div>
      <div className="text-[10.5px] tracking-[0.05em] text-muted uppercase">{label}</div>
    </div>
  )
}
