// app/blog/[slug]/BlogPostBody.tsx — v5
// ✅ ПРОМЯНА спрямо v4:
//   1) FIX бутони: ctaLabel за "own" продукти преди беше твърдо закачен
//      за низа "Atlas Terra" независимо кой продукт реално е embed-нат —
//      при два product_embed блока в статия (напр. базова формула + AMINO)
//      двата CTA бутона показваха идентичен текст. Сега вземаме кратко
//      име от resolved.name (частта преди " — ", ако има такова тире),
//      затова "Atlas Terra" и "Atlas Terra AMINO" вече се различават.
//   2) FIX layout: съседни product_embed блокове в content масива преди
//      се рендираха един под друг (всеки взимаше пълна ширина + собствен
//      margin). Добавена groupContentBlocks() — открива поредици от 2+
//      съседни product_embed блока и ги обединява в общ .bp-product-row
//      grid контейнер (2 колони desktop, 1 колона mobile под 640px).
//      Единичен product_embed (без съсед) продължава да ползва старото
//      хоризонтално .bp-product-embed оформление — непроменено, нисък риск.
//   3) НОВ "card" вариант на ProductEmbed — вертикална карта с badge
//      ribbon (от block.note), квадратна снимка, hover elevation — по-
//      маркетингов вид за showcase реда. Активира се само за групите.

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

type ProductEmbedBlock = Extract<BlogBlock, { type: 'product_embed' }>

function slugifyHeading(text: string): string {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').slice(0, 60)
}

// ✅ Групира content масива в сегменти: обикновени единични блокове +
//    "редове" от 2+ съседни product_embed блокове. Само local reshuffle
//    за рендиране — не пипа post.content в базата.
type ContentSegment =
  | { kind: 'block'; block: BlogBlock; key: string }
  | { kind: 'product-row'; blocks: ProductEmbedBlock[]; key: string }

function groupContentBlocks(blocks: BlogBlock[]): ContentSegment[] {
  const segments: ContentSegment[] = []
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i]
    if (block.type === 'product_embed') {
      const group: ProductEmbedBlock[] = []
      let j = i
      while (j < blocks.length && blocks[j].type === 'product_embed') {
        group.push(blocks[j] as ProductEmbedBlock)
        j++
      }
      if (group.length > 1) {
        segments.push({ kind: 'product-row', blocks: group, key: `row-${i}` })
      } else {
        segments.push({ kind: 'block', block: group[0], key: `b-${i}` })
      }
      i = j
    } else {
      segments.push({ kind: 'block', block, key: `b-${i}` })
      i++
    }
  }
  return segments
}

function ProductEmbed({
  block,
  resolved,
  variant = 'inline',
}: {
  block: ProductEmbedBlock
  resolved?: ResolvedEmbedProduct
  variant?: 'inline' | 'card'
}) {
  if (!resolved) return null

  // ✅ Кратко име за CTA — "Atlas Terra AMINO — Аминокиселини..." → "Atlas Terra AMINO"
  const shortName  = resolved.name.split(' — ')[0].trim()
  const priceLabel = resolved.price ? ` — ${resolved.price.toFixed(2)} ${resolved.price_currency || 'EUR'}` : ''
  const ctaLabel = resolved.affiliate
    ? `🔗 Виж продукта${priceLabel}`
    : `🌿 Разгледай ${shortName}${priceLabel}`

  if (variant === 'card') {
    return (
      <div className="bp-product-card">
        <div className="bp-product-card-head">
          {resolved.image_url && (
            <div className="bp-product-card-img-wrap">
              <SafeImg
                src={resolved.image_url}
                alt={resolved.name}
                width={112}
                height={112}
                sizes="56px"
                quality={70}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          )}
          <div className="bp-product-card-headtext">
            {block.note && <span className="bp-product-card-badge">{block.note}</span>}
            <p className="bp-product-card-title">{resolved.name}</p>
          </div>
        </div>
        {resolved.description && <p className="bp-product-card-desc">{resolved.description}</p>}
        <AffiliateTrackedLink
          href={resolved.url}
          slug={resolved.key.split(':')[1]}
          sponsored={resolved.affiliate}
          className="bp-product-card-btn"
        >
          {ctaLabel}
        </AffiliateTrackedLink>
      </div>
    )
  }

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

  const segments = groupContentBlocks(post.content)

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
        {segments.map(seg =>
          seg.kind === 'product-row' ? (
            <div className="bp-product-row" key={seg.key}>
              {seg.blocks.map((block, idx) => (
                <ProductEmbed
                  key={idx}
                  block={block}
                  resolved={resolvedProducts[`${block.product_type}:${block.slug}`]}
                  variant="card"
                />
              ))}
            </div>
          ) : (
            <Block key={seg.key} block={seg.block} resolvedProducts={resolvedProducts} />
          )
        )}
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
