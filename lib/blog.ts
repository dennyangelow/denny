// lib/blog.ts — v2
// ✅ ПРОМЯНА спрямо v1:
//   - Нов експортиран тип BlogListPost — леката форма на BlogPost, без
//     'content', използвана от /blog списъка (виж app/blog/page.tsx v4).
//     Всеки пълен BlogPost продължава да е валиден навсякъде другаде,
//     където се използва (structural typing) — нищо друго не се чупи.
//   - deriveExcerpt() вече приема content? като ОПЦИОНАЛНО поле — преди
//     очакваше content винаги да съществува (post.content.find(...)),
//     което щеше да гръмне за постове, теглени без content колоната.
//     Ако content липсва, fallback логиката (търсене на първия параграф)
//     просто се пропуска — post.excerpt остава единственият източник.
//     Затова е важно "Без резюме" предупреждението в BlogHealthPanel да
//     се взима на сериозно за всеки публикуван пост.
// Следва същия модел като lib/affiliate.ts (getRating/parseHowToUse/getAllImages) —
// server и client компонентите импортират оттук, без дублиране на логика.

export type BlogBlockType =
  | 'paragraph'
  | 'heading'
  | 'image'
  | 'quote'
  | 'list'
  | 'product_embed'
  | 'faq'

export interface BlogParagraphBlock { type: 'paragraph'; text: string }
export interface BlogHeadingBlock   { type: 'heading'; level: 2 | 3; text: string }
export interface BlogImageBlock     { type: 'image'; url: string; alt: string; caption?: string }
export interface BlogQuoteBlock     { type: 'quote'; text: string; author?: string }
export interface BlogListBlock      { type: 'list'; ordered: boolean; items: string[] }
export interface BlogProductEmbedBlock {
  type: 'product_embed'
  product_type: 'affiliate' | 'own'
  slug: string
  note?: string   // кратък badge таг над картата, напр. "Основа за здрава почвена структура"
  // Убедителен/образователен текст, специфичен за тази статия — за разлика
  // от note (кратък 2-4 думен таг) или продуктовото description (генерично,
  // идва от products таблицата и е еднакво навсякъде), pitch е авторско
  // изречение/абзац, което свързва конкретния аргумент от статията с избора
  // на точно този продукт. По избор — рендира се само ако е зададено.
  // Поддържа [текст](линк) синтаксис през renderRichText(), както
  // paragraph/list/quote/faq.
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

// ✅ НОВО: лека форма на BlogPost за списъчни изгледи (/blog) — точно
//    колоните, реално нужни за карта в грида. НЕ включва 'content' (пълното
//    тяло на статията) — то се тегли само в app/blog/[slug]/page.tsx.
export type BlogListPost = Pick<
  BlogPost,
  | 'id' | 'slug' | 'title' | 'excerpt'
  | 'cover_image_url' | 'cover_image_alt'
  | 'category' | 'published_at' | 'updated_at' | 'reading_time_minutes'
>

// ── Категории — вече в blog_categories таблицата, управлявани от admin
//    панела (Блог → ⚙️ Управлявай категории), не hardcoded тук.
//    Този тип + DEFAULT списък служат само като fallback (напр. ако
//    /api/blog-categories не отговори по някаква причина) — реалният,
//    редактируем източник е таблицата.
export interface BlogCategory {
  slug:       string
  label:      string
  emoji:      string
  sort_order?: number
  active?:    boolean
}

export const DEFAULT_BLOG_CATEGORIES: BlogCategory[] = [
  { slug: 'domati',     label: 'Домати',              emoji: '🍅', sort_order: 1 },
  { slug: 'krastavici', label: 'Краставици',          emoji: '🥒', sort_order: 2 },
  { slug: 'torene',     label: 'Торене',              emoji: '🌱', sort_order: 3 },
  { slug: 'oranzherii', label: 'Оранжерии',           emoji: '🏡', sort_order: 4 },
  { slug: 'bolesti',    label: 'Болести и вредители', emoji: '🐛', sort_order: 5 },
  { slug: 'novini',     label: 'Новини',              emoji: '📰', sort_order: 6 },
]

// ✅ Вторият аргумент е незадължителен нарочно — стари извиквания
//    (categoryLabel(post.category)) продължават да работят с fallback-а;
//    новите страници подават реалния списък от blog_categories.
export function categoryLabel(category?: string, categories: BlogCategory[] = DEFAULT_BLOG_CATEGORIES): string {
  if (!category) return ''
  return categories.find(c => c.slug === category)?.label || category
}

export function categoryEmoji(category?: string, categories: BlogCategory[] = DEFAULT_BLOG_CATEGORIES): string {
  if (!category) return '📗'
  return categories.find(c => c.slug === category)?.emoji || '📗'
}

// ── Четивно време — ~200 думи/минута, изчислено от текстовите блокове ──────────
export function estimateReadingTime(content: BlogBlock[]): number {
  const words = content.reduce((acc, block) => {
    if (block.type === 'paragraph' || block.type === 'heading') return acc + block.text.split(/\s+/).filter(Boolean).length
    if (block.type === 'quote') return acc + block.text.split(/\s+/).filter(Boolean).length
    if (block.type === 'list') return acc + block.items.join(' ').split(/\s+/).filter(Boolean).length
    if (block.type === 'faq') return acc + block.items.map(i => i.q + ' ' + i.a).join(' ').split(/\s+/).filter(Boolean).length
    return acc
  }, 0)
  return Math.max(1, Math.round(words / 200))
}

// ✅ ПРОМЯНА: content вече е ОПЦИОНАЛНО поле в аргумента. Постове, теглени
//    без content колоната (списъчния изглед на /blog), просто пропускат
//    fallback логиката и разчитат само на post.excerpt. Пълните повиквания
//    (post страница, генерирана метадата) продължават да работят непроменени.
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

// ── Всички снимки на поста (cover + галерия) — за OG/Product image sitemap ────
export function getAllPostImages(post: BlogPost): { url: string; alt: string }[] {
  const images: { url: string; alt: string }[] = []
  if (post.cover_image_url) images.push({ url: post.cover_image_url, alt: post.cover_image_alt || post.title })
  const gallery = Array.isArray(post.gallery_urls) ? post.gallery_urls : []
  gallery.forEach((g, i) => {
    if (g?.url) images.push({ url: g.url, alt: g.alt || `${post.title} — снимка ${i + 2}` })
  })
  return images
}
