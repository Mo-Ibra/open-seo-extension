/** Locale formatting shared by every counter in the popup. */

/**
 * Thousands-separated number, e.g. `12000` becomes `12,000`.
 *
 * The locale is pinned to `en-US` so the extension renders the same digits and
 * separators regardless of the browser's language — a mixed audience reads both
 * English UI strings and European number formats, and the popup should not
 * depend on the host machine's settings.
 */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}
