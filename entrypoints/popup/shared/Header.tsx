import logo from '../images/logo.svg'

import { Icon } from './Icon'

/**
 * The popup's title bar.
 *
 * The rescan button only appears on the page tabs: the site tab has its own
 * "Find pages" / "Rescan" controls, and a header-level rescan there would do
 * nothing meaningful.
 */
export function Header({
  isPageTab,
  scan,
  busy,
}: {
  isPageTab: boolean
  /** Re-runs the page audit. */
  scan: () => Promise<void>
  /** Disables the button and spins the icon while an audit is in flight. */
  busy: boolean
}) {
  return (
    <header className="sticky top-0 z-2 flex items-center justify-between gap-2 border-b border-line bg-linear-to-b from-surface to-canvas px-3 pt-2.5 pb-2">
      {/* The wordmark is the logo mark alone at 20px: legible in a 28px-tall bar,
          and it carries the brand without crowding the tab strip below. The
          rounded corners are baked into the SVG, so no extra radius here. */}
      <img
        src={logo}
        alt="Open SEO"
        width={20}
        height={20}
        className="size-5 shrink-0"
      />
      {isPageTab && (
        <button
          className="btn border-line-strong bg-surface px-2 py-1.5 text-ink-soft hover:bg-surface-3"
          onClick={() => void scan()}
          disabled={busy}
          title="Re-run the audit on this page"
          aria-label="Re-run the audit"
        >
          <Icon name="refresh" size={14} className={busy ? 'spin-slow' : undefined} />
          {!busy && <span>Rescan</span>}
        </button>
      )}
    </header>
  )
}
