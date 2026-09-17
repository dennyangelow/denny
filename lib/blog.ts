// lib/blog.ts — v4
// ✅ ПРОМЯНА спрямо v3: добавено intro_text? поле към BlogCategory — уводен
//    текст, показван на новата pillar страница /blog/[category-slug] (виж
//    app/blog/[slug]/page.tsx и новия BlogCategoryHub.tsx). Реалният
//    източник е intro_text колоната в blog_categories (виж
//    add_category_intro.sql) — DEFAULT_BLOG_CATEGORIES по-долу е само
//    fallback, същият модел като label/emoji досега.
//
// (останалата част от файла непроменена спрямо v3)

export type BlogBlockType =
  | 'paragraph'
  | 'heading'
  | 'image'
  | 'quote'
  | 'list'
  | 'table'
  | 'product_embed'
  | 'faq'

export interface BlogParagraphBlock { type: 'paragraph'; text: string }
export interface BlogHeadingBlock   { type: 'heading'; level: 2 | 3; text: string }
export interface BlogImageBlock     { type: 'image'; url: string; alt: string; caption?: string }
export interface BlogQuoteBlock     { type: 'quote'; text: string; author?: string }
export interface BlogListBlock      { type: 'list'; ordered: boolean; items: string[] }
export interface BlogTableBlock {
  type: 'table'
  headers: string[]
  rows: string[][]
  caption?: string
}
export interface BlogProductEmbedBlock {
  type: 'product_embed'
  product_type: 'affiliate' | 'own'
  slug: string
  note?: string
  pitch?: string
}
export interface BlogFaqBlock {
  type: 'faq'
  items: { q: string; a: string }[]
}

export type BlogBlock =
  | BlogParagraphBlock
  | BlogHeadingBlock
  | BlogImageBlock
  | BlogQuoteBlock
  | BlogListBlock
  | BlogTableBlock
  | BlogProductEmbedBlock
  | BlogFaqBlock

export interface BlogPost {
  id:                       string
  slug:                     string
  title:                    string
  excerpt?:                 string
  content:                  BlogBlock[]
  cover_image_url?:         string
  cover_image_alt?:         string
  gallery_urls?:            { url: string; alt?: string }[]
  category?:                string
  tags?:                    string[]
  seo_title?:               string
  seo_description?:         string
  canonical_url?:           string
  related_affiliate_slugs?: string[]
  related_product_slugs?:   string[]
  has_affiliate_links?:     boolean
  status:                   'draft' | 'published' | 'archived'
  author_name?:             string
  published_at?:            string
  updated_at?:              string
  created_at?:              string
  reading_time_minutes?:    number
  sort_order?:              number
  active?:                  boolean
}

export type BlogListPost = Pick<
  BlogPost,
  | 'id' | 'slug' | 'title' | 'excerpt'
  | 'cover_image_url' | 'cover_image_alt'
  | 'category' | 'published_at' | 'updated_at' | 'reading_time_minutes'
>

// ── Категории — вече в blog_categories таблицата, управлявани от admin
//    панела (Блог → ⚙️ Управлявай категории), не hardcoded тук.
//    Този тип + DEFAULT списък служат само като fallback — реалният,
//    редактируем източник е таблицата.
export interface BlogCategory {
  slug:        string
  label:       string
  emoji:       string
  sort_order?: number
  active?:     boolean
  // ✅ НОВО — уводен текст за pillar страницата /blog/[category-slug].
  //    Незадължително нарочно — стари редове без попълнена колона просто
  //    не показват уводен параграф, вместо да гръмне рендирането.
  intro_text?: string
}

export const DEFAULT_BLOG_CATEGORIES: BlogCategory[] = [
  { slug: 'domati',     label: 'Домати',              emoji: '🍅', sort_order: 1,
    intro_text: 'Всичко за отглеждането на домати — от схема на торене по фази, през разпознаване на болести, до разстояние на засаждане и разликите между оранжерийно и полско производство.' },
  { slug: 'krastavici', label: 'Краставици',          emoji: '🥒', sort_order: 2,
    intro_text: 'Практически ръководства за отглеждане на краставици — торене, поливане, болести и вредители, специфични за културата.' },
  { slug: 'torene',     label: 'Торене',              emoji: '🌱', sort_order: 3,
    intro_text: 'Универсални принципи на торене, независещи от конкретна култура.' },
  { slug: 'oranzherii', label: 'Оранжерии',           emoji: '🏡', sort_order: 4,
    intro_text: 'Инфраструктура и климат контрол за оранжерийно производство.' },
  { slug: 'bolesti',    label: 'Болести и вредители', emoji: '🐛', sort_order: 5,
    intro_text: 'Обща теория за болести и вредители, независеща от конкретна култура.' },
  { slug: 'novini',     label: 'Новини',              emoji: '📰', sort_order: 6,
    intro_text: 'Новини и съобщения от Denny Angelow.' },
]

export function categoryLabel(category?: string, categories: BlogCategory[] = DEFAULT_BLOG_CATEGORIES): string {
  if (!category) return ''
  return categories.find(c => c.slug === category)?.label || category
}

export function categoryEmoji(category?: string, categories: BlogCategory[] = DEFAULT_BLOG_CATEGORIES): string {
  if (!category) return '📗'
  return categories.find(c => c.slug === category)?.emoji || '📗'
}

export function estimateReadingTime(content: BlogBlock[]): number {
  const words = content.reduce((acc, block) => {
    if (block.type === 'paragraph' || block.type === 'heading') return acc + block.text.split(/\s+/).filter(Boolean).length
    if (block.type === 'quote') return acc + block.text.split(/\s+/).filter(Boolean).length
    if (block.type === 'list') return acc + block.items.join(' ').split(/\s+/).filter(Boolean).length
    if (block.type === 'table') return acc + [...block.headers, ...block.rows.flat()].join(' ').split(/\s+/).filter(Boolean).length
    if (block.type === 'faq') return acc + block.items.map(i => i.q + ' ' + i.a).join(' ').split(/\s+/).filter(Boolean).length
    return acc
  }, 0)
  return Math.max(1, Math.round(words / 200))
}

export function deriveExcerpt(
  post: Pick<BlogPost, 'excerpt'> & { content?: BlogBlock[] },
  maxLen = 160
): string {
  if (post.excerpt && post.excerpt.trim()) return post.excerpt.trim()
  const firstParagraph = (post.content || []).find(b => b.type === 'paragraph') as BlogParagraphBlock | undefined
  if (!firstParagraph) return ''
  const text = firstParagraph.text.trim()
  return text.length > maxLen ? text.slice(0, maxLen - 1).trimEnd() + '…' : text
}

export function getAllPostImages(post: BlogPost): { url: string; alt: string }[] {
  const images: { url: string; alt: string }[] = []
  if (post.cover_image_url) images.push({ url: post.cover_image_url, alt: post.cover_image_alt || post.title })
  const gallery = Array.isArray(post.gallery_urls) ? post.gallery_urls : []
  gallery.forEach((g, i) => {
    if (g?.url) images.push({ url: g.url, alt: g.alt || `${post.title} — снимка ${i + 2}` })
  })
  return images
}
