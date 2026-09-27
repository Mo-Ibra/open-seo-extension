export function host(origin: string): string {
  return origin.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '-') || 'site'
}

export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
