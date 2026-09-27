/**
 * Clipboard with a "copied!" acknowledgement.
 *
 * Extracted from `LinksTab`, where the copy button and its 1.2s reset timer
 * were inline. Reusing the hook means the timer and the "only clear if the same
 * row is still selected" check cannot drift between call sites.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** How long the button stays in its confirmed state. */
const CONFIRM_MS = 1200

/**
 * Returns the value that was most recently copied (or `null`) plus a `copy`
 * function to hand to a button's `onClick`.
 *
 * Clipboard writes can be rejected — the popup may not be focused, or the
 * document may not be focused at all — so failures are swallowed rather than
 * surfaced. The button simply does not flip to its confirmed state.
 */
export function useCopyToClipboard(): {
  copied: string | null
  copy: (value: string) => void
} {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Clearing on unmount stops a pending reset from updating a dead component.
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback((value: string) => {
    void navigator.clipboard.writeText(value).then(
      () => {
        setCopied(value)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(null), CONFIRM_MS)
      },
      // Denied permission, or the popup lost focus mid-click.
      () => undefined
    )
  }, [])

  return { copied, copy }
}
