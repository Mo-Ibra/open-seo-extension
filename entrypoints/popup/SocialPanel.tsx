import { useState } from 'react'

import type { PageData } from '../../lib/types'
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
    <div className="social-panel">
      <section className="social-section">
        <h3 className="section-title">Facebook / LinkedIn</h3>
        <PreviewCard
          variant="large"
          image={image}
          siteName={siteName}
          title={title}
          description={description}
        />
      </section>

      <section className="social-section">
        <h3 className="section-title">
          X (Twitter) <span className="badge">{cardType}</span>
        </h3>
        <PreviewCard
          variant={cardType === 'summary' ? 'compact' : 'large'}
          image={image}
          siteName={siteName}
          title={title}
          description={description}
        />
      </section>

      {image && <p className="hint">Image: {imageSize}</p>}

      <section className="social-section">
        <h3 className="section-title">
          Tags <span className={missing > 0 ? 'badge warn' : 'badge pass'}>{missing} missing</span>
        </h3>
        <ul className="tag-list">
          {fields.map(([name, value]) => (
            <li className="tag-row" key={name}>
              <span className="tag-name">{name}</span>
              <span className={value ? 'tag-value' : 'tag-value missing'} title={value}>
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
    <div className={variant === 'compact' ? 'social-card compact' : 'social-card'}>
      <div className="social-media">
        {showImage ? (
          <img
            className="social-image"
            src={image}
            alt=""
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="social-image-placeholder">
            <Icon name="sparkle" size={16} />
            <span>No og:image</span>
          </div>
        )}
      </div>
      <div className="social-body">
        <div className="social-domain">{siteName}</div>
        <div className="social-title">{title || 'Untitled'}</div>
        <div className="social-description">{description}</div>
      </div>
    </div>
  )
}
