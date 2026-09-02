// app/blog/[slug]/BlogPostBody.tsx — v4
// ✅ ПРОМЯНА спрямо v3: related cards снимки 640x400 → 640x360 (16:9) +
//    quality={70} — съвпада с новия aspect-ratio на .blog-card-img-wrap
//    (виж blog.css) и маха излишната компресия, която PageSpeed отчете.
// ✅ ПРОМЯНА спрямо v2: paragraph/list/quote текстовете вече минават през
//    renderRichText() от '@/lib/blogRichText' — поддържа [текст](линк)
//    markdown-style синтаксис за реални кликаеми <a> елементи в content-а,
//    без dangerouslySetInnerHTML (виж коментара в blogRichText.tsx защо).
//    FaqAccordion.tsx е обновен отделно за същата поддръжка в отговорите.

import { SafeImg } from '@/components/client/SafeImg'
import { FaqAccordion } from '@/components/blog/FaqAccordion'
import { AffiliateTrackedLink } from '@/components/blog/AffiliateTrackedLink'
import { renderRichText } from '@/lib/blogRichText'
import type { BlogPost, BlogBlock, BlogCategory } from '@/lib/blog'
import { categoryLabel, categoryEmoji } from '@/lib/blog'
import type { ResolvedEmbedProduct } from './page'

interface Props {
  post:             BlogPost
  related:          BlogPost[]
  resolvedProducts: Record<string, ResolvedEmbedProduct>
  canonicalUrl:     string
  categories:       BlogCategory[]
}

function slugifyHeading(text: string): string {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').slice(0, 60)
}

function ProductEmbed({
  block,
  resolved,
}: {
  block: Extract<BlogBlock, { type: 'product_embed' }>
  resolved?: ResolvedEmbedProduct
}) {
  if (!resolved) return null

  const ctaLabel = resolved.affiliate
    ? `🔗 Виж продукта${resolved.price ? ` — ${resolved.price.toFixed(2)} ${resolved.price_currency || 'EUR'}` : ''}`
    : `🌿 Разгледай Atlas Terra${resolved.price ? ` — ${resolved.price.toFixed(2)} ${resolved.price_currency || 'EUR'}` : ''}`

  return (
    <div className="bp-product-embed">
      {resolved.image_url && (
        <div style={{ width: 76, height: 76, flexShrink: 0 }}>
          <SafeImg
            src={resolved.image_url}
            alt={resolved.name}
            className="bp-product-embed-img"
            width={152}
            height={152}
            sizes="76px"
            quality={70}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {block.note && <div className="bp-product-embed-note">{block.note}</div>}
        <p className="bp-product-embed-title">{resolved.name}</p>
        {resolved.description && <p className="bp-product-embed-desc">{resolved.description}</p>}
        <AffiliateTrackedLink
          href={resolved.url}
          slug={resolved.key.split(':')[1]}
          sponsored={resolved.affiliate}
          className="bp-product-embed-btn"
        >
          {ctaLabel}
        </AffiliateTrackedLink>
      </div>
    </div>
  )
}

function Block({
  block,
  resolvedProducts,
}: {
  block: BlogBlock
  resolvedProducts: Record<string, ResolvedEmbedProduct>
}) {
  switch (block.type) {
    case 'paragraph':
      // ✅ renderRichText поддържа [текст](/blog/друг-пост) синтаксис
      return <p>{renderRichText(block.text)}</p>
    case 'heading': {
      const id = slugifyHeading(block.text)
      return block.level === 2 ? <h2 id={id}>{block.text}</h2> : <h3 id={id}>{block.text}</h3>
    }
    case 'image':
      return (
        <figure>
          <SafeImg
            src={block.url}
            alt={block.alt}
            width={1200}
            height={800}
            sizes="(max-width: 760px) 100vw, 760px"
            style={{ width: '100%', height: 'auto' }}
          />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      )
    case 'quote':
      return (
        <blockquote>
          {renderRichText(block.text)}
          {block.author && <cite>— {block.author}</cite>}
        </blockquote>
      )
    case 'list':
      // ✅ renderRichText приложен и за отделните list items
      return block.ordered
        ? <ol>{block.items.map((it, i) => <li key={i}>{renderRichText(it)}</li>)}</ol>
        : <ul>{block.items.map((it, i) => <li key={i}>{renderRichText(it)}</li>)}</ul>
    case 'product_embed':
      return <ProductEmbed block={block} resolved={resolvedProducts[`${block.product_type}:${block.slug}`]} />
    case 'faq':
      return <FaqAccordion items={block.items} />
    default:
      return null
  }
}

export default function BlogPostBody({ post, related, resolvedProducts, canonicalUrl, categories }: Props) {
  const publishedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const shareText = encodeURIComponent(post.title)
  const shareUrl   = encodeURIComponent(canonicalUrl)

  return (
    <div className="bp-wrap">
      <nav className="blog-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Начало</a><span>/</span><a href="/blog">Блог</a><span>/</span><span>{post.title}</span>
      </nav>

      {post.cover_image_url && (
        <div className="bp-cover">
          <SafeImg
            src={post.cover_image_url}
            alt={post.cover_image_alt || post.title}
            priority
            width={1200}
            height={675}
            sizes="(max-width: 760px) 100vw, 760px"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}

      <h1 className="bp-title">{post.title}</h1>

      <div className="bp-meta">
        <span className="bp-meta-item">✍️ {post.author_name || 'Denny Angelow'}</span>
        {publishedDate && <span className="bp-meta-item">📅 {publishedDate}</span>}
        {post.reading_time_minutes && <span className="bp-meta-item">⏱️ {post.reading_time_minutes} мин четене</span>}
        {post.category && <span className="bp-meta-item">{categoryEmoji(post.category, categories)} {categoryLabel(post.category, categories)}</span>}
      </div>

      {post.has_affiliate_links && (
        <div className="bp-disclosure">
          <span>ℹ️</span>
          <span>Тази статия съдържа партньорски (affiliate) линкове. Ако купиш през тях, може да получим комисионна — без допълнителни разходи за теб.</span>
        </div>
      )}

      <div className="bp-content">
        {post.content.map((block, i) => (
          <Block key={i} block={block} resolvedProducts={resolvedProducts} />
        ))}
      </div>

      <div className="bp-share">
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noopener" aria-label="Сподели във Facebook">FB</a>
        <a href={`https://wa.me/?text=${shareText}%20${shareUrl}`} target="_blank" rel="noopener" aria-label="Сподели във WhatsApp">WA</a>
        <a href={`https://viber.im/forward?text=${shareText}%20${shareUrl}`} target="_blank" rel="noopener" aria-label="Сподели във Viber">VB</a>
      </div>

      {related.length > 0 && (
        <div className="bp-related">
          <div className="bp-related-title">Прочети още</div>
          <div className="blog-grid">
            {related.map(p => (
              <a key={p.id} href={`/blog/${p.slug}`} className="blog-card">
                <div className="blog-card-img-wrap">
                  {p.cover_image_url && (
                    <SafeImg
                      src={p.cover_image_url}
                      alt={p.cover_image_alt || p.title}
                      width={640}
                      height={360}
                      quality={70}
                      sizes="(max-width: 600px) 100vw, 33vw"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </div>
                <div className="blog-card-body">
                  <h3 className="blog-card-title">{p.title}</h3>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
