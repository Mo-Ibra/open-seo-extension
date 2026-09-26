import { useState } from 'react'

import type { PageData } from '../../lib/types'
import { cn } from './cn'
import { Icon } from './Icon'

function absolute(value: string | undefined, base: string): string | null {
  if (!value) return null
  try {
    return new URL(value, base).href
  } catch {
    return value
  }
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function SocialPanel({ page }: { page: PageData }) {
  const og = page.social.openGraph
  const twitter = page.social.twitter

  const title = og['title'] || twitter['title'] || page.title
  const description = og['description'] || twitter['description'] || page.description || ''
  const image = absolute(og['image'] || twitter['image'], page.url)
  const siteName = og['site_name'] || hostname(page.url)
  const cardType = twitter['card'] || (image ? 'summary_large_image' : 'summary')

  const fields: Array<[string, string | undefined]> = [
    ['og:title', og['title']],
    ['og:description', og['description']],
    ['og:image', og['image']],
    ['og:url', og['url']],
    ['og:type', og['type']],
    ['og:site_name', og['site_name']],
    ['twitter:card', twitter['card']],
    ['twitter:title', twitter['title']],
    ['twitter:description', twitter['description']],
    ['twitter:image', twitter['image']],
    ['twitter:site', twitter['site']],
  ]

  const imageSize =
    og['image:width'] && og['image:height']
      ? `${og['image:width']}\u00d7${og['image:height']}`
      : 'dimensions unknown'
  const missing = fields.filter(([, value]) => !value).length

  return (
    <div className="flex flex-col gap-2.5">
      <section className="flex flex-col gap-1.5">
        <h3 className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">Facebook / LinkedIn</h3>
        <PreviewCard
          variant="large"
          image={image}
          siteName={siteName}
          title={title}
          description={description}
        />
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
          X (Twitter)
          <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10.5px] font-semibold text-muted">
            {cardType}
          </span>
        </h3>
        <PreviewCard
          variant={cardType === 'summary' ? 'compact' : 'large'}
          image={image}
          siteName={siteName}
          title={title}
          description={description}
        />
      </section>

      {image && <p className="flex items-center gap-1.5 text-xs text-muted">Image: {imageSize}</p>}

      <section className="flex flex-col gap-1.5">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
          Tags
          <span
            className={cn(
              'rounded-full px-1.5 py-px text-[10.5px] font-semibold',
              missing > 0 ? 'bg-warn-soft text-warn' : 'bg-pass-soft text-pass'
            )}
          >
            {missing} missing
          </span>
        </h3>
        <ul className="list-none overflow-hidden rounded-md border border-line bg-surface">
          {fields.map(([name, value]) => (
            <li className="flex gap-2 border-b border-line px-2 py-1.5 text-xs last:border-b-0" key={name}>
              <span className="w-32 shrink-0 font-mono text-[11px] text-muted">{name}</span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate',
                  value ? undefined : 'text-fail italic'
                )}
                title={value}
              >
                {value || 'missing'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function PreviewCard({
  variant,
  image,
  siteName,
  title,
  description,
}: {
  variant: 'large' | 'compact'
  image: string | null
  siteName: string
  title: string
  description: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = image && !imageFailed

  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-surface shadow-soft', variant === 'compact' && 'flex')}>
      <div className={cn('bg-surface-3', variant === 'compact' && 'w-[108px] shrink-0')}>
        {showImage ? (
          <img
            className={cn('block w-full object-cover', variant === 'compact' ? 'h-full' : 'max-h-[190px]')}
            src={image}
            alt=""
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-1.25 text-[11.5px] text-muted',
              variant === 'compact' ? 'h-full min-h-[92px]' : 'h-[92px]'
            )}
          >
            <Icon name="sparkle" size={16} />
            <span>No og:image</span>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div className="truncate text-[10.5px] tracking-[0.05em] text-muted uppercase">{siteName}</div>
        <div className="my-0.75 line-clamp-2 text-sm leading-snug font-semibold">{title || 'Untitled'}</div>
        <div className="line-clamp-2 text-xs text-muted">{description}</div>
      </div>
    </div>
  )
}
