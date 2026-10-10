'use client'
// components/blog/BlogHealthPanel.tsx — v2
// ✅ v2 (спрямо v1) — props са непроменени (posts, categories, onOpenPost):
//   • Нови проверки (от lib/blogChecks.ts — същите като предупреждението
//     преди публикуване): счупени вътрешни линкове, SEO title с марка/твърде
//     дълъг, SEO description извън 110–165, малко вътрешни линкове,
//     "осиротели" постове (никой не сочи към тях), affiliate флаг, няма
//     снимки в текста, няма външни източници.
//   • `categories` вече може да съдържа и АРХИВИРАНИ (active=false):
//     "изтрита категория" се проверява срещу всички, а "празни категории" —
//     само за активните.
//   • Махнато твърдението "FAQ rich snippet" — Google показва FAQ rich
//     резултати само за ограничен кръг сайтове; FAQ секцията остава полезна
//     за читателя, но не обещаваме snippet.
// Автоматични SEO/здраве проверки върху вече заредените постове и
// категории (същите данни, които BlogTab вече тегли за списъка) — без
// нито една допълнителна заявка. Всеки проблемен ред е кликаем и отваря
// директно поста в редактора (виж onOpenPost в BlogTab.tsx).

import { useState } from 'react'
import type { BlogPost, BlogCategory } from '@/lib/blog'
import { auditPost, internalBlogTargets, type AuditContext, type PostCheck } from '@/lib/blogChecks'

interface Props {
  posts:      Partial<BlogPost>[]
  categories: BlogCategory[]
  onOpenPost: (post: Partial<BlogPost>) => void
}

type Severity = 'critical' | 'warning' | 'info'

const SEVERITY_STYLE: Record<Severity, { border: string; bg: string; text: string; icon: string }> = {
  critical: { border: '#dc2626', bg: '#fee2e2', text: '#991b1b', icon: '🔴' },
  warning:  { border: '#d97706', bg: '#fffbeb', text: '#92400e', icon: '🟡' },
  info:     { border: '#6b7280', bg: '#f3f4f6', text: '#374151', icon: '🟢' },
}

const DAY = 24 * 60 * 60 * 1000

function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / DAY)
}

interface Issue {
  key:         string
  severity:    Severity
  title:       string
  explanation: string
  posts:       Partial<BlogPost>[]
  /** За чисто информативни проблеми без конкретни постове (напр. празни категории по име) */
  extraLabels?: string[]
  /** post.id → кратко пояснение, показва се под реда на поста */
  details?:    Record<string, string>
}

function IssueCard({ issue, onOpenPost }: { issue: Issue; onOpenPost: (p: Partial<BlogPost>) => void }) {
  const [open, setOpen] = useState(false)
  const style = SEVERITY_STYLE[issue.severity]
  const count = issue.posts.length + (issue.extraLabels?.length || 0)
  const clean = count === 0

  return (
    <div style={{
      background: '#fff', border: `1px solid ${clean ? 'var(--border)' : style.border}`,
      borderLeft: `4px solid ${clean ? '#86efac' : style.border}`,
      borderRadius: 10, marginBottom: 8, overflow: 'hidden',
    }}>
      <button
        onClick={() => !clean && setOpen(v => !v)}
        disabled={clean}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          background: 'none', border: 'none', textAlign: 'left', cursor: clean ? 'default' : 'pointer', fontFamily: 'inherit',
        }}>
        <span style={{ fontSize: 14 }}>{clean ? '✅' : style.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{issue.title}</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{issue.explanation}</div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 800, borderRadius: 99, padding: '3px 10px', flexShrink: 0,
          background: clean ? '#dcfce7' : style.bg, color: clean ? '#166534' : style.text,
        }}>
          {clean ? 'Няма' : count}
        </span>
        {!clean && <span style={{ fontSize: 11, color: '#9ca3af' }}>{open ? '▲' : '▼'}</span>}
      </button>

      {open && !clean && (
        <div style={{ borderTop: '1px solid #f5f5f5', padding: '6px 14px 10px' }}>
          {issue.posts.map(p => (
            <button key={p.id} onClick={() => onOpenPost(p)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
                padding: '6px 4px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: '#1f2937',
                borderBottom: '1px solid #f9fafb',
              }}>
              ✏️ {p.title || '(без заглавие)'}
              {p.id && issue.details?.[p.id] && (
                <span style={{ display: 'block', fontSize: 11.5, color: '#9ca3af', marginTop: 2, paddingLeft: 22, fontWeight: 400 }}>
                  {issue.details[p.id]}
                </span>
              )}
            </button>
          ))}
          {issue.extraLabels?.map(label => (
            <div key={label} style={{ padding: '6px 4px', fontSize: 12.5, color: '#1f2937' }}>{label}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// Събира резултатите от auditPost по код → { posts, details }
function collect(
  list: Partial<BlogPost>[],
  ctx: AuditContext,
  code: string,
): { posts: Partial<BlogPost>[]; details: Record<string, string> } {
  const out: Partial<BlogPost>[] = []
  const details: Record<string, string> = {}
  for (const p of list) {
    const hit: PostCheck | undefined = auditPost(p, ctx).find(c => c.code === code)
    if (hit) {
      out.push(p)
      if (p.id && hit.detail) details[p.id] = hit.detail
    }
  }
  return { posts: out, details }
}

export function BlogHealthPanel({ posts, categories, onOpenPost }: Props) {
  const published = posts.filter(p => p.status === 'published')
  const activeCategories = categories.filter(c => c.active !== false)

  // ✅ v2: контекст за проверките на линковете
  const ctx: AuditContext = {
    postSlugs:     new Set(published.map(p => p.slug).filter((s): s is string => !!s)),
    categorySlugs: new Set(activeCategories.map(c => c.slug)),
  }

  const missingSeo = published.filter(p => !p.seo_title?.trim() || !p.seo_description?.trim())
  const missingCover = published.filter(p => !p.cover_image_url || !p.cover_image_alt?.trim())
  const orphanCategory = posts.filter(p => p.category && !categories.some(c => c.slug === p.category))
  // ✅ v2: архивирана категория НЕ е "изтрита" — постът просто не е във филтрите на публичния сайт
  const inArchivedCategory = posts.filter(p => p.category && categories.some(c => c.slug === p.category && c.active === false))

  const slugCounts: Record<string, number> = {}
  posts.forEach(p => { if (p.slug) slugCounts[p.slug] = (slugCounts[p.slug] || 0) + 1 })
  const duplicateSlugs = posts.filter(p => p.slug && slugCounts[p.slug] > 1)

  const shortPosts = published.filter(p => typeof p.reading_time_minutes === 'number' && p.reading_time_minutes < 3)
  const noExcerpt = published.filter(p => !p.excerpt?.trim())
  const staleDrafts = posts.filter(p => p.status === 'draft' && (daysSince(p.created_at) ?? 0) > 14)
  const thinMonetization = published.filter(p => {
    const blocks = p.content || []
    return !blocks.some(b => b.type === 'product_embed') && !blocks.some(b => b.type === 'faq')
  })

  const emptyCategoryLabels = activeCategories
    .filter(c => !posts.some(p => p.category === c.slug))
    .map(c => `${c.emoji} ${c.label}`)
  const staleUpdated = published.filter(p => (daysSince(p.updated_at) ?? 0) > 180)

  // ── ✅ v2: нови проверки ──────────────────────────────────────────────────
  const notArchived = posts.filter(p => p.status !== 'archived')
  const brokenLinks   = collect(notArchived, ctx, 'broken-link')
  const titleBrand    = collect(published,   ctx, 'seo-title-brand')
  const titleLong     = collect(published,   ctx, 'seo-title-long')
  const descLength    = collect(published,   ctx, 'seo-desc-length')
  const fewLinks      = collect(published,   ctx, 'few-internal-links')
  const affiliateFlag = collect(published,   ctx, 'affiliate-flag')
  const noImages      = collect(published,   ctx, 'no-images')
  const noSources     = collect(published,   ctx, 'no-sources')

  // Постове, към които никой друг публикуван пост не сочи (вътрешно свързване)
  const inbound: Record<string, number> = {}
  published.forEach(p => internalBlogTargets(p.content).forEach(t => {
    if (t !== p.slug) inbound[t] = (inbound[t] || 0) + 1
  }))
  const orphanPosts = published.filter(p => p.slug && !inbound[p.slug])

  const criticalIssues: Issue[] = [
    { key: 'seo', severity: 'critical', title: 'Липсващ SEO title/description',
      explanation: 'Публикуван пост без тях пада на генерик fallback — по-слаб CTR в Google', posts: missingSeo },
    { key: 'cover', severity: 'critical', title: 'Липсваща cover снимка или alt текст',
      explanation: 'Влияе директно на OG превюто и на image search видимостта', posts: missingCover },
    { key: 'orphan', severity: 'critical', title: 'Пост с изтрита/несъществуваща категория',
      explanation: 'Категорията вече не е в списъка — постът "изчезва" от филтрите на /blog', posts: orphanCategory },
    { key: 'dup', severity: 'critical', title: 'Дублиран slug',
      explanation: 'Два поста със същия адрес — единият ще е недостъпен', posts: duplicateSlugs },
    { key: 'broken-link', severity: 'critical', title: 'Счупен вътрешен линк в текста',
      explanation: 'Линк към несъществуваща страница (404) — лош сигнал за читателя и за Google',
      posts: brokenLinks.posts, details: brokenLinks.details },
  ]

  const warningIssues: Issue[] = [
    { key: 'short', severity: 'warning', title: 'Много кратко съдържание (<3 мин четене)',
      explanation: 'Риск от "thin content" в очите на Google', posts: shortPosts },
    { key: 'excerpt', severity: 'warning', title: 'Без резюме (excerpt)',
      explanation: 'Картата в списъка пада на авто-извадка от първия параграф', posts: noExcerpt },
    { key: 'stale-draft', severity: 'warning', title: 'Чернова, стояща над 14 дни',
      explanation: 'Застояла редакторска опашка', posts: staleDrafts },
    { key: 'thin-monetization', severity: 'warning', title: 'Без product embed и без FAQ',
      explanation: 'Пропусната възможност за приходи и за FAQ секция, която отговаря на въпросите на читателя', posts: thinMonetization },
    { key: 'seo-title-brand', severity: 'warning', title: 'SEO title съдържа „| Denny Angelow“',
      explanation: 'Марката се добавя автоматично — иначе излиза два пъти в заглавието в Google',
      posts: titleBrand.posts, details: titleBrand.details },
    { key: 'seo-title-long', severity: 'warning', title: 'Дълъг SEO title (>60 символа без марката)',
      explanation: 'Google го съкращава — ключовата дума трябва да е в началото',
      posts: titleLong.posts, details: titleLong.details },
    { key: 'seo-desc', severity: 'warning', title: 'SEO description извън 110–165 символа',
      explanation: 'Твърде кратко не използва мястото в резултатите; твърде дълго се реже',
      posts: descLength.posts, details: descLength.details },
    { key: 'few-links', severity: 'warning', title: 'По-малко от 2 вътрешни линка към други статии',
      explanation: 'Вътрешното свързване задържа читателя и показва на Google кои статии са свързани',
      posts: fewLinks.posts, details: fewLinks.details },
    { key: 'orphan-post', severity: 'warning', title: 'Пост, към който не сочи нито една статия',
      explanation: 'Достъпен е само от списъка — добави линк към него от свързана статия', posts: orphanPosts },
    { key: 'affiliate-flag', severity: 'warning', title: 'Има affiliate продукти, но флагът е изключен',
      explanation: 'Банерът се показва автоматично; флагът се оправя при следващо запазване на поста',
      posts: affiliateFlag.posts, details: affiliateFlag.details },
  ]

  const infoIssues: Issue[] = [
    { key: 'empty-cat', severity: 'info', title: 'Категории без нито един пост',
      explanation: 'Кандидати за архивиране или за следващото ти писане', posts: [], extraLabels: emptyCategoryLabels },
    { key: 'stale-updated', severity: 'info', title: 'Публикувано преди >180 дни, без обновяване',
      explanation: 'Сигнал към Google, че съдържанието остарява', posts: staleUpdated },
    { key: 'archived-cat', severity: 'info', title: 'Постове в архивирана категория',
      explanation: 'Не се показват във филтрите и в категорийната страница — върни категорията или смени категорията на поста',
      posts: inArchivedCategory },
    { key: 'no-images', severity: 'info', title: 'Няма снимки в текста (само корица)',
      explanation: 'Реални снимки (симптоми, оранжерия, резултати) повишават доверието и носят трафик от Google Images',
      posts: noImages.posts },
    { key: 'no-sources', severity: 'info', title: 'Няма външни източници / справки',
      explanation: 'Връзки към научни или официални източници подсилват доверието в съдържанието',
      posts: noSources.posts },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
          Критично
        </div>
        {criticalIssues.map(i => <IssueCard key={i.key} issue={i} onOpenPost={onOpenPost} />)}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
          Предупреждение
        </div>
        {warningIssues.map(i => <IssueCard key={i.key} issue={i} onOpenPost={onOpenPost} />)}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
          Информативно
        </div>
        {infoIssues.map(i => <IssueCard key={i.key} issue={i} onOpenPost={onOpenPost} />)}
      </div>

      <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 10, padding: 14, fontSize: 12.5, color: '#6b7280' }}>
        📊 <strong>Трафик и кликове по пост</strong> (топ постове, кликове по product embed) изискват връзка с analytics
        данните — следваща стъпка, когато вече има достатъчно трафик да е показателен.
      </div>
    </div>
  )
}
