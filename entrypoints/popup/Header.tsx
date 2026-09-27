import { Icon } from "./Icon";

export default function Header({ isPageTab, scan, busy }: { isPageTab: boolean, scan: any, busy: boolean }) {
    return (
        <header className="sticky top-0 z-2 flex items-center justify-between gap-2 border-b border-line bg-linear-to-b from-surface to-canvas px-3 pt-2.5 pb-2">
            <span className="text-sm font-medium tracking-tight">
                Open<b className="font-bold text-accent">TEST</b>
            </span>
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