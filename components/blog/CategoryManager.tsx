'use client'
// components/blog/CategoryManager.tsx — v1
// ✅ Ново: категориите вече не са hardcoded в lib/blog.ts, а в blog_categories
//    таблицата — този компонент е UI-то, през което Denny ги добавя/
//    редактира/трие, без нито един следващ redeploy.

import { useState } from 'react'
import { toast } from '@/components/ui/Toast'
import type { BlogCategory } from '@/lib/blog'

const inp: React.CSSProperties = {
  padding: '6px 9px', border: '1.5px solid #e5e7eb', borderRadius: 7,
  fontFamily: 'inherit', fontSize: 13, outline: 'none', background: '#fff',
}

interface Props {
  categories: BlogCategory[]
  onChange: () => void  // повикай load-а в BlogTab след успешна промяна
  /** slug → брой постове в тази категория — за badge до всяко име. */
  postCounts?: Record<string, number>
}

export function CategoryManager({ categories, onChange, postCounts }: Props) {
  const [newLabel, setNewLabel] = useState('')
  const [newEmoji, setNewEmoji] = useState('📗')
  const [editSlug, setEditSlug] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [busy, setBusy] = useState(false)

  const addCategory = async () => {
    if (!newLabel.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/blog-categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim(), emoji: newEmoji.trim() || '📗' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast.success('Категорията е добавена')
      setNewLabel(''); setNewEmoji('📗')
      onChange()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (c: BlogCategory) => {
    setEditSlug(c.slug); setEditLabel(c.label); setEditEmoji(c.emoji)
  }

  const saveEdit = async () => {
    if (!editSlug) return
    setBusy(true)
    try {
      const res = await fetch(`/api/blog-categories/${editSlug}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editLabel.trim(), emoji: editEmoji.trim() || '📗' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast.success('Запазено')
      setEditSlug(null)
      onChange()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const removeCategory = async (slug: string) => {
    if (!confirm('Да изтрия ли тази категория?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/blog-categories/${slug}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      toast.success('Изтрито')
      onChange()
    } catch (e: any) {
      // ✅ API-то отказва изтриване, ако категорията се ползва от постове —
      //    съобщението вече казва точно колко и предлага архивиране.
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const archiveCategory = async (slug: string, active: boolean) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/blog-categories/${slug}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onChange()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        Категории
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {categories.map(c => (
          <div key={c.slug} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 8px' }}>
            {editSlug === c.slug ? (
              <>
                <input value={editEmoji} onChange={e => setEditEmoji(e.target.value)} style={{ ...inp, width: 44, flexShrink: 0, textAlign: 'center' }} />
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)} style={{ ...inp, flex: 1, minWidth: 0 }} />
                <button disabled={busy} onClick={saveEdit} style={{ background: '#dcfce7', border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 12, color: '#166534', fontWeight: 700 }}>✓</button>
                <button disabled={busy} onClick={() => setEditSlug(null)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>✕</button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{c.emoji}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: c.active === false ? '#9ca3af' : '#1f2937', textDecoration: c.active === false ? 'line-through' : 'none' }}>
                  {c.label}
                </span>
                {postCounts && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 8px', flexShrink: 0,
                    background: (postCounts[c.slug] || 0) === 0 ? '#fffbeb' : '#f3f4f6',
                    color:      (postCounts[c.slug] || 0) === 0 ? '#92400e' : '#6b7280',
                  }}>
                    {postCounts[c.slug] || 0} {(postCounts[c.slug] || 0) === 1 ? 'пост' : 'поста'}
                  </span>
                )}
                <button disabled={busy} onClick={() => startEdit(c)} title="Редактирай"
                  style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                <button disabled={busy} onClick={() => archiveCategory(c.slug, c.active === false)} title={c.active === false ? 'Активирай' : 'Архивирай'}
                  style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 12 }}>
                  {c.active === false ? '👁️' : '🗄️'}
                </button>
                <button disabled={busy} onClick={() => removeCategory(c.slug)} title="Изтрий"
                  style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 12, color: '#991b1b' }}>✕</button>
              </>
            )}
          </div>
        ))}
        {categories.length === 0 && (
          <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 8 }}>Няма категории още</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
        <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)} placeholder="🌿" style={{ ...inp, width: 44, flexShrink: 0, textAlign: 'center' }} />
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Нова категория..." style={{ ...inp, flex: 1, minWidth: 0 }}
          onKeyDown={e => e.key === 'Enter' && addCategory()} />
        <button disabled={busy || !newLabel.trim()} onClick={addCategory}
          style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', opacity: busy || !newLabel.trim() ? 0.6 : 1, flexShrink: 0 }}>
          + Добави
        </button>
      </div>
    </div>
  )
}
