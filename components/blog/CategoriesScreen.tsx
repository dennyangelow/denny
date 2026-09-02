'use client'
// components/blog/CategoriesScreen.tsx — v1
// Пълноекранен изглед за "Категории" под-таба — не toggle вътре в пост.
// Стат карти отгоре дават бърз поглед: колко категории, колко постове общо,
// колко категории стоят без нито един пост (сигнал да ги слееш/архивираш
// или следващото ти да пишеш точно в тях).

import type { BlogPost, BlogCategory } from '@/lib/blog'
import { CategoryManager } from '@/components/blog/CategoryManager'

interface Props {
  categories: BlogCategory[]
  posts: Partial<BlogPost>[]
  onChange: () => void
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: 'warn' }) {
  return (
    <div style={{
      flex: '1 1 130px', background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', minWidth: 0,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone === 'warn' && Number(value) > 0 ? '#b45309' : 'var(--text)' }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{label}</div>
    </div>
  )
}

export function CategoriesScreen({ categories, posts, onChange }: Props) {
  const postCounts: Record<string, number> = {}
  posts.forEach(p => {
    if (p.category) postCounts[p.category] = (postCounts[p.category] || 0) + 1
  })

  const emptyCategories = categories.filter(c => (postCounts[c.slug] || 0) === 0).length

  return (
    <div>
      {/* ✅ flexWrap добавен — на много тесен екран трите карти вече
          пренасят на 2+1 ред вместо да се смачкват до нечетливи 60-70px */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <StatCard label="Категории общо" value={categories.length} />
        <StatCard label="Постове общо" value={posts.length} />
        <StatCard label="Категории без постове" value={emptyCategories} tone="warn" />
      </div>

      <div style={{ maxWidth: 480 }}>
        <CategoryManager categories={categories} onChange={onChange} postCounts={postCounts} />
      </div>
    </div>
  )
}
