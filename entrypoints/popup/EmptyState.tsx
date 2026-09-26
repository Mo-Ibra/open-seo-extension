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
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={20} />
      </span>
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
      {action}
    </div>
  )
}
