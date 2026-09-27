import { describe, expect, it } from 'vitest'

import { isSameOrigin, isScannableUrl, normalizeUrl, originOf } from '../../lib/crawl/normalize'

const base = 'https://example.com/blog/post.html'

describe('normalizeUrl', () => {
  it('resolves relative links against the base', () => {
    expect(normalizeUrl('../other', base)).toBe('https://example.com/other')
    expect(normalizeUrl('/root', base)).toBe('https://example.com/root')
    expect(normalizeUrl('//cdn.example.net/x', base)).toBe('https://cdn.example.net/x')
  })

  it('drops the fragment', () => {
    expect(normalizeUrl('/page#section', base)).toBe('https://example.com/page')
  })

  it('drops tracking parameters and sorts the rest', () => {
    expect(normalizeUrl('/p?utm_source=x&b=2&a=1&fbclid=z', base)).toBe('https://example.com/p?a=1&b=2')
  })

  it('keeps meaningful parameters', () => {
    expect(normalizeUrl('/s?page=2&q=seo', base)).toBe('https://example.com/s?page=2&q=seo')
  })

  it('rejects non-http schemes', () => {
    for (const value of ['mailto:a@b.com', 'tel:+123', 'javascript:void(0)', '', '   ']) {
      expect(normalizeUrl(value, base), value).toBeNull()
    }
  })

  it('treats a bare word as a relative path, as browsers do', () => {
    expect(normalizeUrl('not a url', base)).toBe('https://example.com/blog/not%20a%20url')
  })
})

describe('isScannableUrl', () => {
  it('accepts html pages', () => {
    expect(isScannableUrl('https://example.com/')).toBe(true)
    expect(isScannableUrl('https://example.com/blog/post')).toBe(true)
    expect(isScannableUrl('https://example.com/a.html')).toBe(true)
  })

  it('rejects assets', () => {
    for (const path of ['/a.pdf', '/a.JPG', '/style.css', '/app.js', '/logo.svg', '/feed.xml', '/a.zip']) {
      expect(isScannableUrl(`https://example.com${path}`), path).toBe(false)
    }
  })

  it('rejects private and transactional areas', () => {
    for (const path of ['/wp-admin/x', '/admin', '/login', '/cart', '/checkout/']) {
      expect(isScannableUrl(`https://example.com${path}`), path).toBe(false)
    }
  })

  it('rejects unparseable urls', () => {
    expect(isScannableUrl('nonsense')).toBe(false)
  })
})

describe('isSameOrigin / originOf', () => {
  it('compares scheme, host and port', () => {
    expect(isSameOrigin('https://a.com/x', 'https://a.com/y')).toBe(true)
    expect(isSameOrigin('https://a.com/x', 'http://a.com/y')).toBe(false)
    expect(isSameOrigin('https://a.com/x', 'https://b.com/y')).toBe(false)
  })

  it('treats an unparseable url as external, so garbage never enters the crawl', () => {
    expect(isSameOrigin('nonsense', 'https://a.com')).toBe(false)
  })

  it('extracts the origin', () => {
    expect(originOf('https://a.com/x?y=1')).toBe('https://a.com')
    expect(originOf('nonsense')).toBeNull()
  })
})
