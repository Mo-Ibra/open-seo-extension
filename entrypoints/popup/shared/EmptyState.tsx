import type { ReactNode } from 'react'

import { Icon, type IconName } from './Icon'

/** Friendly placeholder for empty lists and idle screens. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: IconName
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-5 text-center">
      <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name={icon} size={20} />
      </span>
      <p className="font-semibold">{title}</p>
      {hint && <p className="max-w-[32ch] text-xs text-muted">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
