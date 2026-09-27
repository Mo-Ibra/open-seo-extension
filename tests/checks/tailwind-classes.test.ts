import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Tailwind only generates the utilities it finds in the source, so a typo in a
 * class name silently renders unstyled. This compares the classes used in the
 * popup components with the ones actually present in the built stylesheet.
 *
 * Skipped when the extension has not been built yet.
 */

const root = path.resolve(__dirname, '../..')
const popupDir = path.join(root, 'entrypoints/popup')
const assetsDir = path.join(root, '.output/chrome-mv3/assets')

const builtCss = fs.existsSync(assetsDir)
  ? fs.readdirSync(assetsDir).find((file) => file.endsWith('.css'))
  : undefined

const describeIfBuilt = builtCss ? describe : describe.skip

/** Words that appear inside className strings but are not classes. */
const NOT_CLASSES = new Set(['check', 'pass', 'warn', 'fail', 'line', 'mt-0.5', 'en-US'])

function collectClasses(): string[] {
  const found = new Set<string>()

  for (const file of fs.readdirSync(popupDir)) {
    if (!file.endsWith('.tsx')) continue
    const source = fs.readFileSync(path.join(popupDir, file), 'utf8')

    for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      for (const token of (match[1] || match[2] || '').split(/\s+/)) if (token) found.add(token)
    }
    // className={cn('a', cond && 'b')} and ternaries with literal branches.
    for (const match of source.matchAll(/'([a-z0-9][^\n']*)'/g)) {
      const value = match[1]
      if (/^[\w:/[\].%#(),-]+$/.test(value) && value.includes('-') && value.length < 60) {
        found.add(value)
      }
    }
  }

  return [...found].filter((token) => !NOT_CLASSES.has(token) && !token.includes('/'))
}

/** Tailwind escapes these in selectors, e.g. `.hover\:bg-red-500`. */
const escapeForSelector = (token: string): string =>
  token.replace(/([.:/[\]()%,#!$*+?~^&{}|="'<>&])/g, '\\$1')

describeIfBuilt('tailwind class coverage', () => {
  it('generates every class used by the popup components', () => {
    const css = fs.readFileSync(path.join(assetsDir, builtCss!), 'utf8')
    const classes = collectClasses()
    const missing = classes.filter((token) => !css.includes('.' + escapeForSelector(token)))

    expect(
      missing,
      `These classes are used in the components but not in ${builtCss} — check for typos: ${missing.join(', ')}`
    ).toEqual([])
  })

  it('keeps the custom utilities in the stylesheet', () => {
    const css = fs.readFileSync(path.join(assetsDir, builtCss!), 'utf8')
    for (const utility of ['btn', 'hide-marker', 'no-scrollbar', 'spin-slow', 'skeleton']) {
      expect(css, `custom utility .${utility} is missing`).toContain('.' + utility)
    }
  })
})
