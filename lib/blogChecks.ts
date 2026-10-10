// lib/blogChecks.ts — v1
// ЕДИН източник на истина за качествените проверки на блог пост. Ползва се
// и от BlogTab (предупреждение преди публикуване), и от BlogHealthPanel
// (преглед на всички постове). Чисти функции — без заявки, без React,
// безопасни и за клиент, и за сървър.

import type { BlogPost, BlogBlock } from '@/lib/blog'
import { hasAffiliateEmbeds } from '@/lib/blog'

export type CheckSeverity = 'critical' | 'warning' | 'info'

export interface PostCheck {
  code:     string
  severity: CheckSeverity
  title:    string
  detail?:  string
}

export interface AuditContext {
  /** slug-овете на ПУБЛИКУВАНИТЕ постове (линк към чернова = счупен за посетителя) */
  postSlugs:     Set<string>
  categorySlugs: Set<string>
  /** slug-овете на активните наръчници, ако са известни (иначе не се проверява) */
  handbookSlugs?: Set<string>
}

const MD_LINK = /\[([^\]]+)\]\(([^)]+)\)/g
const BRAND_TAIL = /\s*\|\s*Denny Angelow\s*$/i

// Всички текстови полета, в които renderRichText разпознава [текст](линк)
function blockTexts(b: BlogBlock): string[] {
  switch (b.type) {
    case 'paragraph': return [b.text]
    case 'quote':     return [b.text]
    case 'list':      return b.items
    case 'table':     return [...b.headers, ...b.rows.flat()]
    case 'faq':       return b.items.map(i => i.a)
    case 'product_embed': return b.pitch ? [b.pitch] : []
    default:          return []
  }
}

export function extractLinks(content: BlogBlock[] | null | undefined): string[] {
  const hrefs: string[] = []
  for (const b of content || []) {
    for (const t of blockTexts(b)) {
      for (const m of String(t).matchAll(MD_LINK)) hrefs.push(m[2].trim())
    }
  }
  return hrefs
}

export const isInternalHref = (h: string) => /^\/(?![\/\\])/.test(h)
export const isExternalHref = (h: string) => h.startsWith('https://')

/** Вътрешни линкове към ДРУГИ блог постове (/blog/<slug>) — за "осиротели" постове. */
export function internalBlogTargets(content: BlogBlock[] | null | undefined): string[] {
  const out: string[] = []
  for (const h of extractLinks(content)) {
    if (!isInternalHref(h)) continue
    const m = h.split('#')[0].split('?')[0].match(/^\/blog\/([^/]+)\/?$/)
    if (m) out.push(m[1])
  }
  return out
}

/** Връща описание на проблема или null, ако линкът изглежда наред. */
export function brokenInternalLink(href: string, ctx: AuditContext): string | null {
  if (!isInternalHref(href)) return null
  const path = href.split('#')[0].split('?')[0]
  if (path === '' || path === '/') return null

  if (/^\/naruchnici(\/|$)/.test(path)) {
    return 'Страницата е /naruchnik/… (единствено число) — този адрес връща 404'
  }
  let m = path.match(/^\/blog\/([^/]+)\/?$/)
  if (m) {
    const s = m[1]
    if (s === 'rss.xml' || ctx.postSlugs.has(s) || ctx.categorySlugs.has(s)) return null
    return `Няма публикуван пост или категория „${s}“`
  }
  m = path.match(/^\/naruchnik\/([^/]+)\/?$/)
  if (m && ctx.handbookSlugs && !ctx.handbookSlugs.has(m[1])) {
    return `Няма активен наръчник „${m[1]}“`
  }
  return null
}

export function auditPost(post: Partial<BlogPost>, ctx: AuditContext): PostCheck[] {
  const out: PostCheck[] = []
  const content = post.content || []

  if (!post.title?.trim()) out.push({ code: 'title-missing', severity: 'critical', title: 'Липсва заглавие' })
  if (!post.slug?.trim())  out.push({ code: 'slug-missing',  severity: 'critical', title: 'Липсва slug (URL)' })

  if (!post.cover_image_url) {
    out.push({ code: 'cover-missing', severity: 'critical', title: 'Липсва корична снимка' })
  } else if (!post.cover_image_alt?.trim()) {
    out.push({ code: 'alt-missing', severity: 'critical', title: 'Липсва alt текст на кориците' })
  }

  const st = post.seo_title?.trim() || ''
  const sd = post.seo_description?.trim() || ''
  if (!st || !sd) {
    out.push({ code: 'seo-missing', severity: 'critical', title: 'Липсва SEO title или description' })
  }
  if (st && BRAND_TAIL.test(st)) {
    out.push({
      code: 'seo-title-brand', severity: 'warning',
      title: 'SEO title съдържа „| Denny Angelow“',
      detail: 'Марката се добавя автоматично от сайта — иначе излиза два пъти в Google.',
    })
  }
  if (st && st.replace(BRAND_TAIL, '').length > 60) {
    out.push({
      code: 'seo-title-long', severity: 'warning',
      title: 'Дълъг SEO title',
      detail: `${st.replace(BRAND_TAIL, '').length} символа (+ марката) — Google ще го съкрати. Цел: до ~55.`,
    })
  }
  if (sd && (sd.length < 110 || sd.length > 165)) {
    out.push({
      code: 'seo-desc-length', severity: 'warning',
      title: 'SEO description извън 110–165 символа',
      detail: `${sd.length} символа.`,
    })
  }
  if (!post.excerpt?.trim()) {
    out.push({ code: 'excerpt-missing', severity: 'warning', title: 'Липсва резюме (excerpt)' })
  }

  if (post.category && !ctx.categorySlugs.has(post.category)) {
    out.push({ code: 'category-orphan', severity: 'critical', title: 'Категорията не съществува' })
  }

  // Счупени вътрешни линкове
  const broken: string[] = []
  for (const h of extractLinks(content)) {
    const why = brokenInternalLink(h, ctx)
    if (why) broken.push(`${h} — ${why}`)
  }
  if (broken.length) {
    out.push({
      code: 'broken-link', severity: 'critical',
      title: `Счупен вътрешен линк (${broken.length})`,
      detail: broken.slice(0, 3).join(' · '),
    })
  }

  if (hasAffiliateEmbeds(content) && !post.has_affiliate_links) {
    out.push({
      code: 'affiliate-flag', severity: 'info',
      title: 'Има affiliate продукти, но флагът е изключен',
      detail: 'Сървърът го включва автоматично при запис; банерът се показва и без флага.',
    })
  }

  const internal = internalBlogTargets(content).filter(s => s !== post.slug)
  if (new Set(internal).size < 2) {
    out.push({
      code: 'few-internal-links', severity: 'warning',
      title: 'По-малко от 2 вътрешни линка към други статии',
      detail: 'Вътрешното свързване помага и на Google, и на читателя да остане в сайта.',
    })
  }

  if (!content.some(b => b.type === 'image')) {
    out.push({ code: 'no-images', severity: 'info', title: 'Няма снимки в текста (само корица)' })
  }
  if (!extractLinks(content).some(isExternalHref)) {
    out.push({ code: 'no-sources', severity: 'info', title: 'Няма външни източници / справки' })
  }

  return out
}

/** Кратък текст за confirm() преди публикуване — само critical + warning. */
export function formatPublishWarnings(checks: PostCheck[]): string {
  const rel = checks.filter(c => c.severity !== 'info')
  return rel
    .map(c => `${c.severity === 'critical' ? '🔴' : '🟡'} ${c.title}${c.detail ? ` — ${c.detail}` : ''}`)
    .join('\n')
}
