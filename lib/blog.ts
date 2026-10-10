// lib/blog.ts — v6
// ✅ ПРОМЯНА спрямо v4:
//   1) НОВ 'handbook_embed' block type — контекстуално вграждане на
//      безплатен наръчник по средата на статия (огледало на
//      product_embed). Виж resolveHandbookEmbeds() в app/blog/[slug]/
//      page.tsx и case 'handbook_embed' в BlogPostBody.tsx.
//   2) ФИКС: DEFAULT_BLOG_CATEGORIES липсваше категорията 'osnovi'
//      (Основи на почвата) — реалната blog_categories таблица вече я
//      съдържа (sort_order 0), и вече има публикуван пост в нея
//      ("Хуминови и фулвови киселини..."). Fallback списъкът трябваше да
//      е 1:1 огледало на таблицата — ако Supabase заявката някога fail-не
//      (мрежа/timeout), кодът пада на този fallback и категорията щеше
//      тихо да "изчезне" от филтрите и от hub страницата, а постът в нея
//      да стане "orphan category" (виж BlogHealthPanel.tsx). Добавена е
//      сега, копирана 1:1 (slug/label/emoji/sort_order/intro_text) от
//      blog_categories_rows export-а.
//
// ✅ v6 (спрямо v5) — САМО ДОБАВКИ, нито един съществуващ export не е
//    променен по име/сигнатура (файлът се ползва от много места):
//    • slugifyBg()/isValidSlug()/SLUG_RE — транслитерация БГ→латиница и
//      валидация на slug (използва се от /api/blog-categories и BlogTab).
//    • hasAffiliateEmbeds()/hasOwnProductEmbeds() — определят дали статията
//      съдържа affiliate/собствени продукти (авто-флаг has_affiliate_links).
//    • uniqueHeadingIds()/headingIdMap() — уникални id-та за заглавията.
//      extractToc() вече ги ползва: за уникални заглавия id-тата са
//      ИДЕНТИЧНИ с преди (няма счупени #котви), а при дублирани заглавия
//      второто получава суфикс -2, -3...
//
// (останалата част от файла непроменена спрямо v4)

export type BlogBlockType =
  | 'paragraph'
  | 'heading'
  | 'image'
  | 'quote'
  | 'list'
  | 'table'
  | 'product_embed'
  | 'handbook_embed'
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
// ✅ НОВО — вграден CTA за конкретен безплатен наръчник, по slug от
//    naruchnici таблицата. За разлика от product_embed, тук няма
//    product_type (наръчниците не се делят на affiliate/own) и няма pitch
//    (текстът "защо точно този наръчник" рядко е нужен — самото заглавие
//    на наръчника обикновено казва достатъчно). note е по избор, за
//    кратък badge над картата (напр. "Свързан безплатен наръчник").
export interface BlogHandbookEmbedBlock {
  type: 'handbook_embed'
  slug: string
  note?: string
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
  | BlogHandbookEmbedBlock
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
  // ✅ уводен текст за pillar страницата /blog/[category-slug].
  //    Незадължително нарочно — стари редове без попълнена колона просто
  //    не показват уводен параграф, вместо да гръмне рендирането.
  intro_text?: string
}

// ⚠️ Дръж този списък 1:1 синхронизиран с реалните редове в
//    blog_categories (slug/label/emoji/sort_order/intro_text) — той е
//    fallback за реален production сценарий (DB заявка fail-va), не
//    декоративен списък. При добавяне/премахване на категория през
//    админ панела, огледай промяната и тук.
export const DEFAULT_BLOG_CATEGORIES: BlogCategory[] = [
  { slug: 'osnovi',     label: 'Основи на почвата',   emoji: '🟫🌱', sort_order: 0,
    intro_text: 'Основите на всяко успешно отглеждане не са в тора, който купуваш, а в почвата, върху която разчиташ. Тук разглеждаме структура, pH, хумус, микробиом и всичко останало, което определя дали хранителните елементи изобщо стигат до корена.' },
  { slug: 'domati',     label: 'Домати',              emoji: '🍅', sort_order: 1,
    intro_text: 'Всичко за отглеждането на домати — от схема на торене по фази, през разпознаване на болести, до разстояние на засаждане и разликите между оранжерийно и полско производство.' },
  { slug: 'krastavici', label: 'Краставици',          emoji: '🥒', sort_order: 2,
    intro_text: 'Практически ръководства за отглеждане на краставици — торене, поливане, болести и вредители, специфични за културата.' },
  { slug: 'torene',     label: 'Торене',              emoji: '🌱', sort_order: 3,
    intro_text: 'Универсални принципи на торене, независещи от конкретна култура — какво е NPK, как се чете етикет на тор, кога течен и кога гранулиран тор е правилният избор.' },
  { slug: 'oranzherii', label: 'Оранжерии',           emoji: '🏡', sort_order: 4,
    intro_text: 'Инфраструктура и климат контрол за оранжерийно производство — вентилация, покритие, температурен режим и всичко, което е еднакво независимо от културата вътре.' },
  { slug: 'bolesti',    label: 'Болести и вредители', emoji: '🐛', sort_order: 5,
    intro_text: 'Обща теория за болести и вредители — как действат фунгицидите като клас, защо е важна ротацията на препарати, как да разпознаеш проблем навреме.' },
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

// ✅ НОВО — извлича {id, text, level} за всеки heading блок в статия, в
//    реда, в който се срещат. Използва се от Table of Contents-а
//    (BlogPostBody.tsx) — id-то трябва да е ИДЕНТИЧНО с това, което
//    slugifyHeading() генерира при самото рендиране на h2/h3, иначе TOC
//    линковете сочат към нищо. Държим slugify логиката тук, СПОДЕЛЕНА,
//    вместо дублирана на две места, за да не се разминат някой ден.
export function slugifyHeading(text: string): string {
  return text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').slice(0, 60)
}

export interface TocEntry { id: string; text: string; level: 2 | 3 }

// ✅ v6 — гарантира уникални id-та. Първото срещане на даден текст пази
//    точно slugifyHeading(text) (както и преди); следващите с същия текст
//    получават -2, -3... Празен резултат (заглавие само от символи) → 'razdel'.
export function uniqueHeadingIds(texts: string[]): string[] {
  const used = new Set<string>()
  return texts.map(text => {
    const base = slugifyHeading(text) || 'razdel'
    let id = base
    let n = 2
    while (used.has(id)) id = `${base}-${n++}`
    used.add(id)
    return id
  })
}

export function extractToc(content: BlogBlock[]): TocEntry[] {
  const headings = (content || []).filter((b): b is BlogHeadingBlock => b.type === 'heading')
  const ids = uniqueHeadingIds(headings.map(h => h.text))
  return headings.map((b, i) => ({ id: ids[i], text: b.text, level: b.level }))
}

// ✅ v6 — блок → id, за рендера на h2/h3 в BlogPostBody (същия ред и същите
//    id-та като в extractToc, така че TOC линковете винаги сочат към нещо).
export function headingIdMap(content: BlogBlock[]): Map<BlogBlock, string> {
  const headings = (content || []).filter((b): b is BlogHeadingBlock => b.type === 'heading')
  const ids = uniqueHeadingIds(headings.map(h => h.text))
  const map = new Map<BlogBlock, string>()
  headings.forEach((h, i) => map.set(h, ids[i]))
  return map
}

// ── ✅ v6: slug помощници ────────────────────────────────────────────────────
// Опростената транслитерация БГ → латиница, с ц → c (както в вече
// съществуващите slug-ове на сайта): Оранжерии → oranzherii,
// Краставици → krastavici, Торене → torene.
const BG_TO_LATIN: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ж': 'zh', 'з': 'z',
  'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p',
  'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch',
  'ш': 'sh', 'щ': 'sht', 'ъ': 'a', 'ь': 'y', 'ю': 'yu', 'я': 'ya',
}

export function slugifyBg(text: string, maxLen = 60): string {
  let out = ''
  for (const ch of (text || '').toLowerCase().trim()) out += BG_TO_LATIN[ch] ?? ch
  return out
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/, '')
}

// малки латински букви, цифри и единични тирета — без кирилица/интервали
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export function isValidSlug(slug: string): boolean {
  return typeof slug === 'string' && slug.length >= 2 && slug.length <= 80 && SLUG_RE.test(slug)
}

// ── ✅ v6: продуктови embed-и в съдържанието ─────────────────────────────────
export function hasAffiliateEmbeds(content: BlogBlock[] | null | undefined): boolean {
  return Array.isArray(content) &&
    content.some(b => b?.type === 'product_embed' && (b as BlogProductEmbedBlock).product_type === 'affiliate')
}

export function hasOwnProductEmbeds(content: BlogBlock[] | null | undefined): boolean {
  return Array.isArray(content) &&
    content.some(b => b?.type === 'product_embed' && (b as BlogProductEmbedBlock).product_type === 'own')
}
