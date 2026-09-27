/**
 * Barrel for the popup's constants.
 *
 * Tab components should import from `'../constants'` rather than reaching into
 * a specific file, so the layout can change without touching every call site.
 * Non-tab code inside `popup/` (App, shared components) should prefer the more
 * specific `'./constants/tone'` import, since that is the one thing they need.
 */

export { NEUTRAL_CHIP, TONE, TONE_ICON, type Tone } from './tone'
export {
  DISCOVERY_SOURCE,
  ISSUE_URL_PREVIEW_LIMIT,
  SCAN_PRESETS,
  SCAN_STEPS,
  URL_PAGE_SIZE,
  URL_PAGE_SIZES,
} from './site'
