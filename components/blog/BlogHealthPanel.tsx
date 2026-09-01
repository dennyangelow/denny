'use client'
// components/blog/BlogHealthPanel.tsx — v1
// Автоматични SEO/здраве проверки върху вече заредените постове и
// категории (същите данни, които BlogTab вече тегли за списъка) — без
// нито една допълнителна заявка. Всеки проблемен ред е кликаем и отваря
// директно поста в редактора (виж onOpenPost в BlogTab.tsx).

import { useState } from 'react'
import type { BlogPost, BlogCategory } from '@/lib/blog'

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

export function BlogHealthPanel({ posts, categories, onOpenPost }: Props) {
  const published = posts.filter(p => p.status === 'published')

  const missingSeo = published.filter(p => !p.seo_title?.trim() || !p.seo_description?.trim())
  const missingCover = published.filter(p => !p.cover_image_url || !p.cover_image_alt?.trim())
  const orphanCategory = posts.filter(p => p.category && !categories.some(c => c.slug === p.category))

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

  const emptyCategoryLabels = categories
    .filter(c => !posts.some(p => p.category === c.slug))
    .map(c => `${c.emoji} ${c.label}`)
  const staleUpdated = published.filter(p => (daysSince(p.updated_at) ?? 0) > 180)

  const criticalIssues: Issue[] = [
    { key: 'seo', severity: 'critical', title: 'Липсващ SEO title/description',
      explanation: 'Публикуван пост без тях пада на генерик fallback — по-слаб CTR в Google', posts: missingSeo },
    { key: 'cover', severity: 'critical', title: 'Липсваща cover снимка или alt текст',
      explanation: 'Влияе директно на OG превюто и на image search видимостта', posts: missingCover },
    { key: 'orphan', severity: 'critical', title: 'Пост с изтрита/несъществуваща категория',
      explanation: 'Категорията вече не е в списъка — постът "изчезва" от филтрите на /blog', posts: orphanCategory },
    { key: 'dup', severity: 'critical', title: 'Дублиран slug',
      explanation: 'Два поста със същия адрес — единият ще е недостъпен', posts: duplicateSlugs },
  ]

  const warningIssues: Issue[] = [
    { key: 'short', severity: 'warning', title: 'Много кратко съдържание (<3 мин четене)',
      explanation: 'Риск от "thin content" в очите на Google', posts: shortPosts },
    { key: 'excerpt', severity: 'warning', title: 'Без резюме (excerpt)',
      explanation: 'Картата в списъка пада на авто-извадка от първия параграф', posts: noExcerpt },
    { key: 'stale-draft', severity: 'warning', title: 'Чернова, стояща над 14 дни',
      explanation: 'Застояла редакторска опашка', posts: staleDrafts },
    { key: 'thin-monetization', severity: 'warning', title: 'Без product embed и без FAQ',
      explanation: 'Пропусната възможност за приходи и за FAQ rich snippet', posts: thinMonetization },
  ]

  const infoIssues: Issue[] = [
    { key: 'empty-cat', severity: 'info', title: 'Категории без нито един пост',
      explanation: 'Кандидати за архивиране или за следващото ти писане', posts: [], extraLabels: emptyCategoryLabels },
    { key: 'stale-updated', severity: 'info', title: 'Публикувано преди >180 дни, без обновяване',
      explanation: 'Сигнал към Google, че съдържанието остарява', posts: staleUpdated },
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
