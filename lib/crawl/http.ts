/** A single HTTP fetch, shared by discovery and scanning. */

export interface FetchOptions {
  /** Abort the request after this many milliseconds. */
  timeoutMs: number
  /** Skip the body when only headers are interesting (e.g. robots.txt check). */
  maxBytes?: number
  signal?: AbortSignal
}

export interface FetchSuccess {
  ok: true
  status: number
  finalUrl: string
  contentType: string | null
  xRobotsTag: string | null
  durationMs: number
  body: string
}

export interface FetchFailure {
  ok: false
  status: number | null
  finalUrl: string
  durationMs: number
  /** Short, user-facing reason, e.g. `timeout`, `network`, `too-large`. */
  reason: FetchFailureReason
}

export type FetchFailureReason = 'timeout' | 'network' | 'aborted' | 'too-large'

export type FetchResult = FetchSuccess | FetchFailure

/**
 * Fetches a URL and returns its body plus the few response headers the audit
 * needs. Never throws: failures come back as `ok: false` so the caller can turn
 * them into findings.
 */
export async function fetchUrl(url: string, options: FetchOptions): Promise<FetchResult> {
  const controller = new AbortController()
  const maxBytes = options.maxBytes ?? 3_000_000
  const startedAt = Date.now()

  const abort = (): void => controller.abort()
  options.signal?.addEventListener('abort', abort)
  const timer = setTimeout(abort, options.timeoutMs)

  const fail = (reason: FetchFailureReason, status: number | null = null): FetchFailure => ({
    ok: false,
    status,
    finalUrl: url,
    durationMs: Date.now() - startedAt,
    reason,
  })

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-cache',
    })

    const declaredLength = Number(response.headers.get('content-length') || '0')
    if (declaredLength > maxBytes) {
      try {
        await response.body?.cancel()
      } catch {
        // Ignore: the body may already be gone.
      }
      return fail('too-large', response.status)
    }

    const body = await response.text()
    if (body.length > maxBytes) return fail('too-large', response.status)

    return {
      ok: true,
      status: response.status,
      finalUrl: response.url || url,
      contentType: response.headers.get('content-type'),
      xRobotsTag: response.headers.get('x-robots-tag'),
      durationMs: Date.now() - startedAt,
      body,
    }
  } catch (error) {
    if (options.signal?.aborted) return fail('aborted')
    const name = error instanceof Error ? error.name : ''
    return fail(name === 'AbortError' ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
  }
}

/** True when a `Content-Type` looks like a document we can audit. */
export function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) return true // Unknown servers: assume HTML and let the parser decide.
  const type = contentType.split(';')[0].trim().toLowerCase()
  return type === 'text/html' || type === 'application/xhtml+xml' || type === 'text/plain'
}
