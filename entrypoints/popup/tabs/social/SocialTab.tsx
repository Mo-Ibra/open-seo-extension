import { useState } from 'react'

import type { PageData } from '../../../../lib/types'
import { TONE } from '../../constants/tone'
import { cn } from '../../shared/cn'
import { Icon } from '../../shared/Icon'
import { SectionTitle } from '../../shared/SectionTitle'
import { absoluteUrl, hostname } from '../../utils/url'

/**
 * Every Open Graph / Twitter Card tag on the page, plus the two previews they
 * produce.
 *
 * The previews are the point: a tag can be present and still look wrong, so the
 * tags table below them is the reference and the cards are the consequence.
 */
export function SocialTab({ page }: { page: PageData }) {
  const og = page.social.openGraph
  const twitter = page.social.twitter

  // Facebook and X each fall back differently: Facebook has no Twitter tags to
  // borrow, so it falls all the way back to the page's own title. X does read
  // og:*, so it stops at twitter:* first.
  const title = og['title'] || twitter['title'] || page.title
  const description = og['description'] || twitter['description'] || page.description || ''
  const image = absoluteUrl(og['image'] || twitter['image'], page.url)
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
        <SectionTitle>Facebook / LinkedIn</SectionTitle>
        <PreviewCard
          variant="large"
          image={image}
          siteName={siteName}
          title={title}
          description={description}
        />
      </section>

      <section className="flex flex-col gap-1.5">
        <SectionTitle trailing={<span className="rounded-full bg-surface-3 px-1.5 py-px text-[10.5px] font-semibold text-muted">{cardType}</span>}>
          X (Twitter)
        </SectionTitle>
        <PreviewCard
          // A `summary` card is a 1:1 thumbnail beside the text; anything else
          // renders as the large image card used above.
          variant={cardType === 'summary' ? 'compact' : 'large'}
          image={image}
          siteName={siteName}
          title={title}
          description={description}
        />
      </section>

      {image && <p className="flex items-center gap-1.5 text-xs text-muted">Image: {imageSize}</p>}

      <section className="flex flex-col gap-1.5">
        <SectionTitle
          trailing={
            <span
              className={cn(
                'rounded-full px-1.5 py-px text-[10.5px] font-semibold',
                missing > 0 ? TONE.chip.warn : TONE.chip.pass
              )}
            >
              {missing} missing
            </span>
          }
        >
          Tags
        </SectionTitle>
        <ul className="list-none overflow-hidden rounded-md border border-line bg-surface">
          {fields.map(([name, value]) => (
            <li className="flex gap-2 border-b border-line px-2 py-1.5 text-xs last:border-b-0" key={name}>
              <span className="w-32 shrink-0 font-mono text-[11px] text-muted">{name}</span>
              <span
                className={cn('min-w-0 flex-1 truncate', value ? undefined : 'text-fail italic')}
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

/**
 * A card in the shape a social platform would render.
 *
 * `compact` is X's 1:1 thumbnail layout, `large` is Facebook's full-width
 * image above the text. The image falls back to a labelled placeholder after an
 * `onError` — a broken `og:image` is one of the most common problems this tab
 * exists to surface, so it must not leave an empty box.
 */
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
  const showImage = image !== null && !imageFailed

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
