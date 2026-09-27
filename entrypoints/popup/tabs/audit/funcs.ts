export function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}\u2026` : value
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}