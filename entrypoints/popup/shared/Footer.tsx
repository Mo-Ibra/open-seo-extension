import { Icon } from "./Icon";

export default function Footer() {
    return (
        <footer className="flex items-center justify-center gap-1.5 border-t border-line bg-surface px-3 pt-2 pb-2.5 text-[11px] text-muted">
            <Icon name="info" size={12} />
            <span>Local-only — nothing leaves your browser</span>
        </footer>
    )
}