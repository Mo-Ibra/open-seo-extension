/** String helpers for display. */

/**
 * Shortens `value` to `limit` characters, ending with an ellipsis.
 *
 * Used to imitate how a search engine truncates a title or description, so the
 * number of characters kept matches the SERP budget in `lib/limits.ts`. The
 * ellipsis counts towards the limit, which is what Google does.
 */
export function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}\u2026` : value
}
