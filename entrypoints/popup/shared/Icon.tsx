/**
 * Inline icon set (stroke-based, 24px grid, `currentColor`). Inline SVG keeps
 * the extension fully offline — no icon font, no network request.
 */

import { cn } from './cn'

export type IconName =
  | 'gauge'
  | 'link'
  | 'share'
  | 'globe'
  | 'refresh'
  | 'search'
  | 'check'
  | 'alert'
  | 'close'
  | 'download'
  | 'play'
  | 'stop'
  | 'copy'
  | 'chevron'
  | 'sparkle'
  | 'info'

const PATHS: Record<IconName, string> = {
  gauge: 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M13.4 10.6 18 6 M20.5 16a9 9 0 1 0-17 0',
  link: 'M9.5 14.5 14.5 9.5 M7 12 5 14a3 3 0 0 0 4 4l2-2 M12 12l2-2a3 3 0 0 1 4 4l-2 2',
  share: 'M18 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M18 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M8.2 10.8l7.6-4.6 M8.2 13.2l7.6 4.6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3 12h18 M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z',
  refresh: 'M20 11a8 8 0 1 0-1.6 5.6 M20 5v6h-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20 20l-4-4',
  check: 'M5 12.5 9.5 17 19 7',
  alert: 'M12 8v5 M12 16.5v.5 M10.3 3.9 2.6 17.2A1.9 1.9 0 0 0 4.3 20h15.4a1.9 1.9 0 0 0 1.7-2.8L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z',
  close: 'M6 6l12 12 M18 6 6 18',
  download: 'M12 3v12 M7.5 10.5 12 15l4.5-4.5 M4 20h16',
  play: 'M8 5.5v13l11-6.5Z',
  stop: 'M6.5 7.5h9v9h-9Z',
  copy: 'M9 9h9v11H9Z M6 15H4V4h11v2',
  chevron: 'M6 9.5 12 15.5 18 9.5',
  sparkle: 'M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8Z M18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5 M12 8v.5',
}

const FILLED: IconName[] = ['play', 'stop', 'sparkle', 'share', 'gauge']

export function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName
  size?: number
  className?: string
}) {
  const filled = FILLED.includes(name)
  return (
    <svg
      className={cn('block shrink-0', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
