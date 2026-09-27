import fs from 'node:fs'
import path from 'node:path'

/** The popup source tree. */
export const POPUP_DIR = path.resolve(__dirname, '../../entrypoints/popup')

/**
 * Every `.ts`/`.tsx` file under the popup, recursively.
 *
 * Shared by the source-scanning tests. The walk has to be recursive: the popup
 * puts almost everything in `tabs/`, `shared/`, `constants/`, `utils/` and
 * `hooks/`, so a top-level `readdirSync` sees only `App.tsx` and `main.tsx`.
 */
export function popupSources(dir: string = POPUP_DIR): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return popupSources(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

/** Reads a file relative to the repo root, for readable assertion messages. */
export function readRepoFile(relative: string): string {
  return fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf8')
}
