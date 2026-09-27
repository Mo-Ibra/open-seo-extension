/**
 * Every pass/warn/fail colour pair in the popup, defined exactly once.
 *
 * Tailwind only emits the utilities it can see as literal strings in the
 * source, so these maps must stay as static string literals — never build a
 * class name by interpolation (e.g. `bg-${status}`), which silently produces
 * unstyled output. `tests/checks/tailwind-classes.test.ts` guards this.
 *
 * These maps used to be scattered across `FindingCard`, `ReportPanel`,
 * `AuditTab`, `SerpPreview` and `constants.ts`, with four of them being
 * byte-identical duplicates. Pick the entry that matches the role you are
 * painting, not the one that happens to be closest:
 *
 *   fill   — a solid bar, meter, dot or track
 *   text   — coloured text with no background (legends, inline counts)
 *   chip   — tinted background + matching text (pills, badges, counters)
 *   stripe — the 3px left border on a result card
 *   icon   — circle background behind a status glyph
 *   stroke — SVG `stroke-*`, used by the score ring
 */

import type { Status } from '../../../lib/types'

/** The three possible check outcomes. */
export type Tone = Status

/**
 * A map from status to one Tailwind class. Every entry below satisfies this
 * shape, which is what keeps the three keys in sync.
 */
type ToneMap = Record<Tone, string>

export const TONE = {
  /** Solid background: meters, progress bars, status dots, graph tracks. */
  fill: {
    pass: 'bg-pass',
    warn: 'bg-warn',
    fail: 'bg-fail',
  } as ToneMap,

  /** Coloured text on the normal surface, no background. */
  text: {
    pass: 'text-pass',
    warn: 'text-warn',
    fail: 'text-fail',
  } as ToneMap,

  /** Tinted pill: soft background plus matching text. */
  chip: {
    pass: 'bg-pass-soft text-pass',
    warn: 'bg-warn-soft text-warn',
    fail: 'bg-fail-soft text-fail',
  } as ToneMap,

  /** 3px left edge that tints a whole result card. */
  stripe: {
    pass: 'border-l-pass',
    warn: 'border-l-warn',
    fail: 'border-l-fail',
  } as ToneMap,

  /** Round badge behind a status icon. Same as `chip`, named for its use. */
  icon: {
    pass: 'bg-pass-soft text-pass',
    warn: 'bg-warn-soft text-warn',
    fail: 'bg-fail-soft text-fail',
  } as ToneMap,

  /** SVG stroke on the score ring, in the popup's dark-mode aware palette. */
  stroke: {
    pass: 'stroke-pass',
    warn: 'stroke-warn',
    fail: 'stroke-fail',
  } as ToneMap,
} as const

/**
 * The neutral variant of `TONE.chip`, for counters and placeholders that need
 * a surface to sit on but carry no verdict (e.g. "N issues", "no anchor text").
 */
export const NEUTRAL_CHIP = 'bg-surface-3 text-muted'

/** Icon name shown for a status. `close` for a hard failure, `alert` for a warning. */
export const TONE_ICON = {
  pass: 'check',
  warn: 'alert',
  fail: 'close',
} as const satisfies Record<Tone, 'check' | 'alert' | 'close'>
