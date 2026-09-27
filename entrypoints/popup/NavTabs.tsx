import { cn } from './cn';
import { Icon, type IconName } from './Icon'

export type Tab = 'audit' | 'links' | 'social' | 'site'


export const TABS: { id: Tab; label: string; icon: IconName }[] = [
    { id: 'audit', label: 'Audit', icon: 'gauge' },
    { id: 'links', label: 'Links', icon: 'link' },
    { id: 'social', label: 'Social', icon: 'share' },
    { id: 'site', label: 'Site', icon: 'globe' },
]

export default function NavTabs({ tab, setTab }: { tab: Tab, setTab: any }) {

    return (
        <nav className="mx-3 mt-2.5 flex gap-0.5 rounded-md border border-line bg-surface-2 p-0.5" role="tablist">
            {TABS.map(({ id, label, icon }) => (
                <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    className={cn(
                        'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-sm px-1 py-1.5 text-xs transition-colors duration-150',
                        tab === id
                            ? 'bg-surface font-semibold text-accent shadow-soft'
                            : 'text-muted hover:text-ink'
                    )}
                    onClick={() => setTab(id)}
                >
                    <Icon name={icon} size={14} />
                    <span>{label}</span>
                </button>
            ))}
        </nav>
    )
}