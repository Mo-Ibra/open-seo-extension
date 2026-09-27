import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { popupSources, readRepoFile } from '../helpers/popup-sources'

/**
 * A JSX text node is not a JavaScript string, so `\uXXXX` in one is not an
 * escape sequence — it is six literal characters. The bug this guards against:
 *
 *   <span>Showing {n}\u2013{m} of {total}</span>
 *
 * rendered as `Showing 1\u2013100 of 769` in the UI, because the compiler had
 * no reason to interpret the backslash. Inside a JS string or template literal
 * the same escape is fine, which is why the confusion survives review: it looks
 * correct in the surrounding code.
 *
 * The built bundle showed it plainly:
 *
 *   children:["Showing ", U+1, "\\u2013", U+2, " of ", U+3]
 *
 * The rule enforced here is deliberately blunt — no `\uXXXX` escapes in `.tsx`
 * files at all, write the real character instead. JSX is text-heavy, so that is
 * the context where the mistake actually happens, and a rule with no exceptions
 * is a rule a test can check exactly. `.ts` files are exempt: `lib/` and
 * `entrypoints/popup/utils/` are plain JavaScript, where the escape is valid and
 * keeping ASCII source there has value.
 */
describe('popup tsx source', () => {
  const files = popupSources().filter((file) => file.endsWith('.tsx'))

  it('finds the tsx files', () => {
    // Guards the guard: if the walk silently returned nothing, every assertion
    // below would pass vacuously.
    expect(files.length).toBeGreaterThan(10)
  })

  it('has no \\uXXXX escapes in JSX files', () => {
    const offenders: string[] = []
    for (const file of files) {
      const source = readRepoFile(path.relative(process.cwd(), file))
      source.split('\n').forEach((line, index) => {
        if (/\\u[0-9a-fA-F]{4}/.test(line)) {
          offenders.push(`${path.basename(file)}:${index + 1}  ${line.trim()}`)
        }
      })
    }
    expect(
      offenders,
      `Use the real character, not a \\uXXXX escape — in JSX text an escape is not interpreted:\n${offenders.join('\n')}`
    ).toEqual([])
  })
})
