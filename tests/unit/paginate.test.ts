import { describe, expect, it } from 'vitest'

import { paginate } from '../../entrypoints/popup/utils/paginate'

/** A list of `n` numbered items. */
const items = (n: number): number[] => Array.from({ length: n }, (_, index) => index + 1)

describe('paginate', () => {
  it('returns the requested page', () => {
    const page = paginate(items(769), 0, 100)
    expect(page.items).toHaveLength(100)
    expect(page.items[0]).toBe(1)
    expect(page.first).toBe(0)
    expect(page.last).toBe(100)
    expect(page.pageCount).toBe(8)
  })

  it('returns a middle page with the right offset', () => {
    const page = paginate(items(769), 2, 100)
    expect(page.items[0]).toBe(201)
    expect(page.first).toBe(200)
    expect(page.last).toBe(300)
    expect(page.pageIndex).toBe(2)
  })

  it('gives the last page a short remainder', () => {
    const page = paginate(items(769), 7, 100)
    expect(page.items).toHaveLength(69)
    expect(page.items[0]).toBe(701)
    expect(page.last).toBe(769)
  })

  it('reports one page when everything fits', () => {
    const page = paginate(items(40), 0, 100)
    expect(page.pageCount).toBe(1)
    expect(page.items).toHaveLength(40)
  })

  /**
   * The property that makes the component safe: a stale page number can never
   * produce an empty render. The user searches, the list shrinks from 769 to 3
   * matches, and `page` is still 7.
   */
  it('clamps a page number past the end instead of rendering nothing', () => {
    const page = paginate(items(3), 7, 100)
    expect(page.pageIndex).toBe(0)
    expect(page.pageCount).toBe(1)
    expect(page.items).toEqual([1, 2, 3])
  })

  it('clamps a negative page number', () => {
    const page = paginate(items(250), -4, 100)
    expect(page.pageIndex).toBe(0)
    expect(page.items[0]).toBe(1)
  })

  it('treats a NaN page number as the first page', () => {
    const page = paginate(items(250), Number.NaN, 100)
    expect(page.pageIndex).toBe(0)
    expect(page.items).toHaveLength(100)
  })

  it('handles an empty list without dividing by zero', () => {
    const page = paginate([], 3, 100)
    expect(page.pageCount).toBe(1)
    expect(page.pageIndex).toBe(0)
    expect(page.items).toEqual([])
    // The label renders "Showing 1–0", so the component checks this first.
    expect(page.last).toBe(0)
  })

  it('survives a zero or negative page size by clamping it to 1', () => {
    // A nonsensical page size cannot produce a divide-by-zero or a negative
    // offset. One item per page is a valid, if useless, page.
    expect(paginate(items(10), 0, 0).items).toHaveLength(1)
    expect(paginate(items(10), 0, -5).items).toHaveLength(1)
    expect(paginate(items(10), 9, -5).items).toEqual([10])
  })

  it('truncates a fractional page size', () => {
    expect(paginate(items(10), 0, 3.7).items).toHaveLength(3)
  })

  it('never returns more items than the list holds', () => {
    for (const size of [1, 7, 50, 100, 200, 5000]) {
      for (const pageIndex of [0, 1, 5, 99]) {
        const page = paginate(items(37), pageIndex, size)
        expect(page.items.length).toBeLessThanOrEqual(Math.min(37, Math.max(1, size)))
        expect(page.last).toBeLessThanOrEqual(37)
      }
    }
  })

  it('covers every item exactly once across the pages', () => {
    const list = items(769)
    const seen: number[] = []
    for (let index = 0; index < 8; index += 1) {
      seen.push(...paginate(list, index, 100).items)
    }
    expect(seen).toEqual(list)
  })
})
