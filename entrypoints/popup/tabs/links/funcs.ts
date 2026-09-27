import { LinkInfo } from "@/lib/types"

export function isInternal(href: string, pageUrl: string): boolean {
  try {
    return new URL(href).origin === new URL(pageUrl).origin
  } catch {
    return true
  }
}

/** A compact, readable label for a link: path for internal, host+path for external. */
export function displayHref(href: string, pageUrl: string): string {
  try {
    const url = new URL(href)
    const path = `${url.pathname}${url.search}`
    if (url.origin === new URL(pageUrl).origin) {
      return path || '/'
    }
    return `${url.host}${path}`
  } catch {
    return href
  }
}

export function isRealLink(link: LinkInfo): boolean {
  return Boolean(link.href) && !link.href.startsWith('javascript:')
}