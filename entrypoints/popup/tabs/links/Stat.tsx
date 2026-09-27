import { cn } from "../../shared/cn";

export default function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-md border bg-surface px-1 py-2 text-center shadow-soft',
        accent ? 'border-accent bg-accent-soft' : 'border-line'
      )}
    >
      <div className="text-[17px] leading-tight font-bold">{value.toLocaleString('en-US')}</div>
      <div className="text-[10.5px] tracking-[0.05em] text-muted uppercase">{label}</div>
    </div>
  )
}