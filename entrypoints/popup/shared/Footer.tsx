import { Icon } from './Icon'

/** Bottom bar. States the privacy promise, which is the extension's main pitch. */
export function Footer() {
  return (
    <footer className="flex items-center justify-center gap-1.5 border-t border-line bg-surface px-3 pt-2 pb-2.5 text-[11px] text-muted">
      <Icon name="info" size={12} />
      <span>Local-only — nothing leaves your browser</span>
    </footer>
  )
}
