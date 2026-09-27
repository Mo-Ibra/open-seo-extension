import type { Check } from '../types'

const LABEL = 'Social tags'

export const socialCheck: Check = (page) => {
  const { openGraph, twitter } = page.social
  const hasAnyTag = Object.keys(openGraph).length > 0 || Object.keys(twitter).length > 0

  if (!hasAnyTag) {
    return [
      {
        id: 'social-none',
        label: LABEL,
        value: null,
        status: 'warn',
        message: 'No Open Graph or Twitter Card tags found.',
        fix: 'Add og:title, og:description and og:image (plus twitter:card) so shared links render nicely.',
      },
    ]
  }

  const missing: string[] = []
  if (!openGraph['title']) missing.push('og:title')
  if (!openGraph['description']) missing.push('og:description')
  if (!openGraph['image']) missing.push('og:image')
  if (!twitter['card']) missing.push('twitter:card')

  if (missing.length > 0) {
    return [
      {
        id: 'social-missing',
        label: LABEL,
        value: `Missing ${missing.length}`,
        status: 'warn',
        message: `Missing: ${missing.join(', ')}.`,
        fix: 'Add the missing tags for richer link previews.',
      },
    ]
  }

  return [
    {
      id: 'social-ok',
      label: LABEL,
      value: 'Complete',
      status: 'pass',
      message: 'Open Graph and Twitter Card tags look complete.',
    },
  ]
}
