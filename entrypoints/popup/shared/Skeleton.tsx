/**
 * Placeholder rows shown while the page is being read, so the popup never
 * flashes empty. `aria-hidden` because there is nothing meaningful to announce;
 * the busy state is already carried by the header's disabled Rescan button.
 */
export function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden="true">
      <div className="skeleton h-[84px] rounded-md" />
      <div className="skeleton h-[46px] rounded-md" />
      <div className="skeleton h-[46px] rounded-md" />
      <div className="skeleton h-8 w-[55%] rounded-md" />
    </div>
  )
}
