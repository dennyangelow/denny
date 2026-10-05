// app/blog/[slug]/BlogPostBody.tsx — v7
// ✅ ПРОМЯНА спрямо v6:
//   1) НОВ case 'handbook_embed' — рендва <BlogHandbookEmbed> за ръчно
//      вградени наръчник CTA-та в текста на статията.
//   2) НОВА fallback карта в края на статията (след .bp-share, преди
//      related) — само ако постът НЯМА нито един ръчен handbook_embed,
//      но page.tsx е намерил наръчник за категорията му (fallbackHandbook).
//   3) НОВ Table of Contents — collapsible <details>, показва се само при
//      3+ heading блока (за по-кратки статии е излишен шум). id-тата
//      идват от СПОДЕЛЕНАТА slugifyHeading (вече в lib/blog.ts, не
//      дублирана локално тук — виж v6 бележката).
//   4) НОВО "Обновено на" в .bp-meta — показва се само когато updated_at
//      реално се различава от published_at (>1 ден разлика), за да не
//      показва фиктивна "обновена" дата при обикновен re-save без реална
//      промяна на съдържанието.

import { SafeImg } from '@/components/client/SafeImg'
import { FaqAccordion } from '@/components/blog/FaqAccordion'
import { AffiliateTrackedLink } from '@/components/blog/AffiliateTrackedLink'
import { BlogHandbookEmbed } from '@/components/blog/BlogHandbookEmbed'
import type { ResolvedHandbook } from '@/components/blog/BlogHandbookEmbed'
import { ShareBar } from '@/components/blog/ShareBar'
import { renderRichText } from '@/lib/blogRichText'
import type { BlogPost, BlogBlock, BlogCategory } from '@/lib/blog'
import { categoryLabel, categoryEmoji, slugifyHeading, extractToc } from '@/lib/blog'
import type { ResolvedEmbedProduct } from './page'

interface Props {
  post:              BlogPost
  related:           BlogPost[]
  resolvedProducts:  Record<string, ResolvedEmbedProduct>
  resolvedHandbooks: Record<string, ResolvedHandbook>
  fallbackHandbook:  ResolvedHandbook | null
  canonicalUrl:      string
  categories:        BlogCategory[]
}

type ProductEmbedBlock  = Extract<BlogBlock, { type: 'product_embed' }>
type HandbookEmbedBlock = Extract<BlogBlock, { type: 'handbook_embed' }>

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
        {block.pitch && <p className="bp-product-card-pitch">{renderRichText(block.pitch)}</p>}
        <AffiliateTrackedLink
          href={resolved.url}
          slug={resolved.key.split(':')[1]}
          partner={resolved.partner}
          source="blog"
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
        {block.pitch && <p className="bp-product-embed-pitch">{renderRichText(block.pitch)}</p>}
        <AffiliateTrackedLink
          href={resolved.url}
          slug={resolved.key.split(':')[1]}
          partner={resolved.partner}
          source="blog"
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
  resolvedHandbooks,
}: {
  block: BlogBlock
  resolvedProducts: Record<string, ResolvedEmbedProduct>
  resolvedHandbooks: Record<string, ResolvedHandbook>
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
    case 'handbook_embed': {
      const b = block as HandbookEmbedBlock
      const resolved = resolvedHandbooks[b.slug]
      if (!resolved) return null
      return <BlogHandbookEmbed handbook={resolved} note={b.note} variant="context" />
    }
    case 'faq':
      return <FaqAccordion items={block.items} />
    case 'table':
      return (
        <div className="bp-table-wrap">
          <table className="bp-table">
            <thead>
              <tr>
                {block.headers.map((h, i) => <th key={i}>{renderRichText(h)}</th>)}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => <td key={ci}>{renderRichText(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {block.caption && <p className="bp-table-caption">{block.caption}</p>}
        </div>
      )
    default:
      return null
  }
}

// ✅ НОВО — само collapsible <details>, без JS state (по-евтино, работи
//    и без hydration). Отворено по подразбиране на desktop чувства ли се
//    прекалено натрапчиво? Не — статиите тук са дълги, TOC-ът реално
//    помага за ориентация, а <details open> е познат UI patern.
function TableOfContents({ content }: { content: BlogBlock[] }) {
  const toc = extractToc(content)
  if (toc.length < 3) return null

  return (
    <details className="bp-toc" open>
      <summary>Съдържание</summary>
      <ul className="bp-toc-list">
        {toc.map(entry => (
          <li key={entry.id} className={entry.level === 3 ? 'bp-toc-h3' : undefined}>
            <a href={`#${entry.id}`}>{entry.text}</a>
          </li>
        ))}
      </ul>
    </details>
  )
}

const DAY_MS = 24 * 60 * 60 * 1000

export default function BlogPostBody({
  post, related, resolvedProducts, resolvedHandbooks, fallbackHandbook, canonicalUrl, categories,
}: Props) {
  const publishedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // ✅ НОВО — само ако реално има значима разлика (>1 ден), за да не
  //    показва "Обновено на [същия ден]" при незначителен re-save.
  const showUpdated = !!(post.updated_at && post.published_at &&
    new Date(post.updated_at).getTime() - new Date(post.published_at).getTime() > DAY_MS)
  const updatedDate = showUpdated
    ? new Date(post.updated_at!).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const segments = groupContentBlocks(post.content)
  const hasManualHandbookEmbed = post.content.some(b => b.type === 'handbook_embed')

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
        {updatedDate && <span className="bp-meta-item">🔄 Обновено на {updatedDate}</span>}
        {post.reading_time_minutes && <span className="bp-meta-item">⏱️ {post.reading_time_minutes} мин четене</span>}
        {post.category && <span className="bp-meta-item">{categoryEmoji(post.category, categories)} {categoryLabel(post.category, categories)}</span>}
      </div>

      {post.has_affiliate_links && (
        <div className="bp-disclosure">
          <span>ℹ️</span>
          <span>Тази статия съдържа партньорски (affiliate) линкове. Ако купиш през тях, може да получим комисионна — без допълнителни разходи за теб.</span>
        </div>
      )}

      <TableOfContents content={post.content} />

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
            <Block key={seg.key} block={seg.block} resolvedProducts={resolvedProducts} resolvedHandbooks={resolvedHandbooks} />
          )
        )}
      </div>

      {/* ✅ НОВО — автоматична fallback карта. Показва се САМО ако статията
          няма нито един ръчно вграден handbook_embed И page.tsx е намерил
          активен наръчник за категорията на поста. */}
      {!hasManualHandbookEmbed && fallbackHandbook && (
        <BlogHandbookEmbed handbook={fallbackHandbook} variant="fallback" />
      )}

      <ShareBar url={canonicalUrl} title={post.title} />

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
