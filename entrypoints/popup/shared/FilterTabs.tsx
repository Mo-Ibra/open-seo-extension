import { cn } from './cn'

/**
 * One option in a `FilterTabs` row.
 *
 * `label` is a string rather than JSX so the row stays a plain data structure;
 * callers that need a live count build it with a small formatter function (see
 * `LinksTab`).
 */
export interface FilterOption<T extends string> {
  id: T
  label: string
}

/**
 * A horizontal, scrollable row of mutually exclusive filter buttons.
 *
 * Shared by the links tab (All / Internal / External / No text) and the site
 * report (Needs work / Fails / Warnings / Clean / All), which were two copies
 * of the same markup.
 */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: FilterOption<T>[]
  value: T
  onChange: (id: T) => void
  /** Accessible name for the tablist, e.g. "Filter links". */
  label: string
}) {
  return (
    <div className="no-scrollbar flex gap-0.5 overflow-x-auto rounded-md border border-line bg-surface-2 p-0.5" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          role="tab"
          aria-selected={value === option.id}
          className={cn(
            'flex-1 cursor-pointer rounded-sm px-2 py-1.5 text-[11.5px] whitespace-nowrap transition-colors duration-150',
            value === option.id
              ? 'bg-surface font-semibold text-accent shadow-soft'
              : 'text-muted hover:text-ink'
          )}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
