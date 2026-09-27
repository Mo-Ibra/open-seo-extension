import vm from 'node:vm'

import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'

import { extractFromDocument } from '../../lib/extract'
import type { PageData } from '../../lib/types'

/**
 * `extractFromDocument` is serialized by `browser.scripting.executeScript` and
 * runs inside the inspected page, so it must not reference anything from module
 * scope. If a helper is ever moved to module level this test fails, instead of
 * the Audit tab breaking with a `ReferenceError` in production.
 *
 * The function is recompiled in a `node:vm` context that contains *only* the
 * globals a real page provides.
 */
function runIsolated(document: Document, args: [Document?, string?]): PageData {
  const sandbox = {
    document,
    location: { href: 'https://example.com/from-globals' },
    URL,
    Array,
    Boolean,
    Error,
    JSON,
    Map,
    Math,
    Number,
    Object,
    RegExp,
    Set,
    String,
    isNaN,
    parseFloat,
    parseInt,
  }

  const context = vm.createContext(sandbox)
  const fn = vm.runInContext(`(${extractFromDocument.toString()})`, context) as (
    doc?: Document,
    baseUrl?: string
  ) => PageData

  return fn(...args)
}

function load(html: string): Document {
  const complete = /<html[\s>]/i.test(html)
    ? html
    : `<!doctype html><html><head></head><body>${html}</body></html>`
  return parseHTML(complete).document as unknown as Document
}

describe('extractFromDocument self-containment', () => {
  it('runs in a context that only has page globals', () => {
    const document = load(
      '<!doctype html><html><head><title>Standalone</title></head><body><h1>Hi there</h1><a href="/x">x</a></body></html>'
    )

    const page = runIsolated(document, [document, 'https://example.com/a/b'])

    expect(page.title).toBe('Standalone')
    expect(page.headings).toEqual([{ level: 1, text: 'Hi there' }])
    expect(page.links[0].href).toBe('https://example.com/x')
    expect(page.wordCount).toBe(3)
  })

  it('falls back to the page globals when called with no arguments', () => {
    const document = load('<!doctype html><html><body><p>two words</p></body></html>')
    const page = runIsolated(document, [])

    expect(page.url).toBe('https://example.com/from-globals')
    expect(page.wordCount).toBe(2)
  })
})
