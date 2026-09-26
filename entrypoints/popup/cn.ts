/** Tiny classname joiner — avoids a `clsx` dependency. */
export type ClassValue = string | false | null | undefined

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}
