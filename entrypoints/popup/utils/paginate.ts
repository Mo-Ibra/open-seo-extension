/**
 * Slicing a list into pages.
 *
 * Kept out of the component so it can be unit tested: the project's test setup
 * runs in Node with no DOM, so anything inside a `.tsx` file is untestable by
 * construction. This is the only part of the page picker with real logic, so it
 * is the only part that needed extracting.
 *
 * The important property is that `page` is an *input to correct*, not a fact to
 * trust. Callers hold a page number in state that can go stale — the user
 * searches, the list shrinks, the page is now out of range. Rather than making
 * every caller reset its state in an effect, `paginate` clamps the request and
 * returns a valid page. An out-of-range request is therefore never able to
 * render an empty list with a non-empty dataset.
 */

/** One page of a longer list, plus the numbers needed to render the control. */
export interface Page<T> {
  /** The items on this page. */
  items: T[]
  /** Zero-based index of the first item, for a "showing 101–200" label. */
  first: number
  /** Zero-based index just past the last item. Equals `first` when empty. */
  last: number
  /** The page actually returned, after clamping. Always a valid index. */
  pageIndex: number
  /** Total pages, never less than 1 so the control has something to show. */
  pageCount: number
}

/**
 * Returns the requested page of `items`, clamped to a page that exists.
 *
 * @param page   Zero-based page request. Out-of-range values are clamped rather
 *               than rejected, so a stale request degrades to the nearest valid
 *               page instead of rendering nothing.
 * @param pageSize Items per page. Guarded against zero, which would otherwise
 *               produce `Infinity` pages and `NaN` offsets.
 */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const size = Math.max(1, Math.trunc(pageSize))
  const pageCount = Math.max(1, Math.ceil(items.length / size))
  // `|| 0` catches NaN; the Math.min/Math.max pair clamps into range.
  const pageIndex = Math.min(Math.max(page || 0, 0), pageCount - 1)
  const first = pageIndex * size
  const pageItems = items.slice(first, first + size)

  return {
    items: pageItems,
    first,
    last: first + pageItems.length,
    pageIndex,
    pageCount,
  }
}
