import { Icon } from './Icon'

/**
 * A free-text filter box with a magnifier icon and a live result count.
 *
 * Used in three places that were otherwise identical: picking pages to scan
 * (`SiteTab`), filtering the report's page list (`ReportPanel`) and filtering
 * links (`LinksTab`).
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  count,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Result count shown on the right, or `null` to omit it. */
  count?: number | null
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-sm border border-line bg-surface px-2 text-muted focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
      <Icon name="search" size={13} />
      <input
        className="w-full min-w-0 flex-1 bg-transparent py-1.5 text-xs text-ink outline-none"
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {count !== null && count !== undefined && <span className="text-[11px]">{count}</span>}
    </div>
  )
}
