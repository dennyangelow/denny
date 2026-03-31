'use client'
// app/admin/components/FaqTab.tsx — v2
// Пълно пренаписване: drag-and-drop за категории + въпроси,
// inline редактиране, bulk actions, подобрен UI

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { toast } from '@/components/ui/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────
interface FaqCategory {
  id: string
  slug: string
  label: string
  icon: string
  sort_order: number
}

interface FaqItem {
  id: string
  question: string
  answer: string
  category: string
  sort_order: number
  active: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────
const FALLBACK_CATEGORIES: FaqCategory[] = [
  { id: 'atlas',     slug: 'atlas',     label: 'Atlas Terra',        icon: '🌱', sort_order: 1 },
  { id: 'affiliate', slug: 'affiliate', label: 'Афилиейт & Ginegar', icon: '🏕️', sort_order: 2 },
  { id: 'delivery',  slug: 'delivery',  label: 'Доставка & Мен',     icon: '🚚', sort_order: 3 },
]

const EMOJI_PRESETS = ['🌱','🚚','❓','💡','🛒','📦','🌿','💊','🔬','🌾','🍅','🥒','💧','☀️','🌡️','📋','⚙️','💰','🤝','📞']

// ── Shared styles ──────────────────────────────────────────────────────────────
const S = {
  inp: {
    width: '100%', padding: '9px 12px',
    border: '1.5px solid #e5e7eb', borderRadius: 8,
    fontFamily: 'inherit', fontSize: 13, outline: 'none',
    boxSizing: 'border-box' as const, background: '#fff',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,
  btn: (color = '#1b4332', text = '#fff'): React.CSSProperties => ({
    background: color, color: text, border: 'none', borderRadius: 10,
    padding: '10px 18px', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 700, transition: 'opacity 0.15s',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  }),
  iconBtn: (bg = '#f3f4f6', color = '#374151'): React.CSSProperties => ({
    background: bg, color, border: 'none', borderRadius: 7,
    padding: '6px 10px', cursor: 'pointer', fontSize: 13,
    display: 'inline-flex', alignItems: 'center', gap: 4,
    transition: 'background 0.15s',
  }),
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function Modal({ onClose, title, width = 520, children }: {
  onClose: () => void; title: string; width?: number; children: React.ReactNode
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 1001,
        transform: 'translate(-50%,-50%)',
        width: '92%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto',
        background: '#fff', borderRadius: 20, padding: 28,
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-.02em' }}>{title}</h3>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 17, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        {children}
      </div>
    </>
  )
}

// ── DragHandle ─────────────────────────────────────────────────────────────────
function DragHandle() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '0 4px', cursor: 'grab', opacity: 0.4, flexShrink: 0 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ display: 'flex', gap: 3 }}>
          <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#374151' }} />
          <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#374151' }} />
        </div>
      ))}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export function FaqTab() {
  const [items,      setItems]      = useState<FaqItem[]>([])
  const [categories, setCategories] = useState<FaqCategory[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [hasCatApi,  setHasCatApi]  = useState(false)

  // Modals
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null)
  const [editingCat, setEditingCat] = useState<FaqCategory | null>(null)
  const [showCatMgr, setShowCatMgr] = useState(false)

  // Filters
  const [catFilter, setCatFilter] = useState('all')
  const [search,    setSearch]    = useState('')
  const [showInactive, setShowInactive] = useState(true)

  // Drag state for FAQ items
  const dragFaqIdx = useRef<number | null>(null)
  const dragOverFaqIdx = useRef<number | null>(null)

  // Drag state for categories
  const dragCatIdx = useRef<number | null>(null)
  const dragOverCatIdx = useRef<number | null>(null)
  const [catDragOver, setCatDragOver] = useState<number | null>(null)
  const [faqDragOver, setFaqDragOver] = useState<number | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([
      fetch('/api/faq?all=true').then(r => r.json()).then(d => setItems(d.faq || [])).catch(() => {}),
      fetch('/api/faq-categories').then(r => r.json()).then(d => {
        if (Array.isArray(d.categories) && d.categories.length > 0) {
          setCategories(d.categories.sort((a: FaqCategory, b: FaqCategory) => a.sort_order - b.sort_order))
          setHasCatApi(true)
        } else {
          setCategories(FALLBACK_CATEGORIES)
          setHasCatApi(false)
        }
      }).catch(() => { setCategories(FALLBACK_CATEGORIES); setHasCatApi(false) }),
    ])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items
      .filter(f => catFilter === 'all' || f.category === catFilter)
      .filter(f => showInactive || f.active)
      .filter(f => !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [items, catFilter, search, showInactive])

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach(f => { m[f.category] = (m[f.category] || 0) + 1 })
    return m
  }, [items])

  const activeCount = useMemo(() => items.filter(f => f.active).length, [items])

  // ── FAQ CRUD ─────────────────────────────────────────────────────────────────
  const saveFaq = async () => {
    if (!editingFaq) return
    if (!editingFaq.question.trim() || !editingFaq.answer.trim()) {
      toast.error('Въпросът и отговорът са задължителни'); return
    }
    setSaving(true)
    try {
      const isNew = !editingFaq.id
      const url   = isNew ? '/api/faq' : `/api/faq/${editingFaq.id}`
      const res   = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingFaq),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(isNew ? '✓ Въпросът е добавен' : '✓ Запазено')
      setEditingFaq(null)
      loadAll()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const delFaq = async (id: string) => {
    if (!confirm('Изтрий този въпрос?')) return
    try {
      const res = await fetch(`/api/faq/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Изтрито')
      setItems(prev => prev.filter(f => f.id !== id))
    } catch { toast.error('Грешка при изтриване') }
  }

  const toggleActive = async (item: FaqItem) => {
    const newVal = !item.active
    setItems(prev => prev.map(f => f.id === item.id ? { ...f, active: newVal } : f))
    try {
      await fetch(`/api/faq/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newVal }),
      })
      toast.success(newVal ? '👁️ Видим' : '🙈 Скрит')
    } catch {
      setItems(prev => prev.map(f => f.id === item.id ? { ...f, active: item.active } : f))
      toast.error('Грешка')
    }
  }

  // ── FAQ Drag & Drop (reorder) ───────────────────────────────────────────────
  const handleFaqDragStart = (idx: number) => { dragFaqIdx.current = idx }
  const handleFaqDragOver  = (e: React.DragEvent, idx: number) => {
    e.preventDefault(); dragOverFaqIdx.current = idx; setFaqDragOver(idx)
  }
  const handleFaqDrop = async () => {
    setFaqDragOver(null)
    const from = dragFaqIdx.current; const to = dragOverFaqIdx.current
    if (from === null || to === null || from === to) return

    const reordered = [...filtered]
    const [moved]   = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)

    // Reassign sort_order
    const updated = reordered.map((item, i) => ({ ...item, sort_order: i + 1 }))

    // Optimistic update
    setItems(prev => {
      const ids = new Set(updated.map(u => u.id))
      const rest = prev.filter(p => !ids.has(p.id))
      return [...rest, ...updated].sort((a, b) => a.sort_order - b.sort_order)
    })

    // Persist all updated sort_orders
    try {
      await Promise.all(updated.map(item =>
        fetch(`/api/faq/${item.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: item.sort_order }),
        })
      ))
      toast.success('✓ Редът е запазен')
    } catch { toast.error('Грешка при запазване на реда'); loadAll() }

    dragFaqIdx.current = null; dragOverFaqIdx.current = null
  }

  // ── Category CRUD ────────────────────────────────────────────────────────────
  const saveCat = async () => {
    if (!editingCat) return
    if (!editingCat.label.trim()) { toast.error('Името е задължително'); return }
    if (!editingCat.icon.trim())  { toast.error('Иконата е задължителна'); return }
    setSaving(true)
    try {
      const isNew = !editingCat.id
      const url   = isNew ? '/api/faq-categories' : `/api/faq-categories/${editingCat.id}`
      const res   = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCat),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(isNew ? '✓ Категория добавена' : '✓ Категория запазена')
      setEditingCat(null)
      loadAll()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const delCat = async (id: string) => {
    if (!confirm('Изтрий тази категория? Въпросите в нея остават.')) return
    try {
      const res = await fetch(`/api/faq-categories/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Категорията е изтрита')
      loadAll()
    } catch (e: any) { toast.error(e.message) }
  }

  // ── Category Drag & Drop ────────────────────────────────────────────────────
  const handleCatDragStart = (idx: number) => { dragCatIdx.current = idx }
  const handleCatDragOver  = (e: React.DragEvent, idx: number) => {
    e.preventDefault(); dragOverCatIdx.current = idx; setCatDragOver(idx)
  }
  const handleCatDrop = async () => {
    setCatDragOver(null)
    const from = dragCatIdx.current; const to = dragOverCatIdx.current
    if (from === null || to === null || from === to) return

    const reordered = [...categories]
    const [moved]   = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    const updated = reordered.map((c, i) => ({ ...c, sort_order: i + 1 }))

    setCategories(updated) // optimistic

    try {
      await Promise.all(updated.map(c =>
        fetch(`/api/faq-categories/${c.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: c.sort_order }),
        })
      ))
      toast.success('✓ Редът на категориите е запазен')
    } catch { toast.error('Грешка при запазване'); loadAll() }

    dragCatIdx.current = null; dragOverCatIdx.current = null
  }

  // ── Field helpers ────────────────────────────────────────────────────────────
  const setFaqField = (k: keyof FaqItem, v: any) =>
    setEditingFaq(prev => prev ? { ...prev, [k]: v } : prev)

  const setCatField = (k: keyof FaqCategory, v: any) =>
    setEditingCat(prev => prev ? { ...prev, [k]: v } : prev)

  const EMPTY_FAQ: FaqItem = {
    id: '', question: '', answer: '',
    category: categories[0]?.slug || '',
    sort_order: items.length + 1, active: true,
  }

  const EMPTY_CAT: FaqCategory = {
    id: '', slug: '', label: '', icon: '📋',
    sort_order: categories.length + 1,
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 16, color: '#9ca3af' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#1b4332', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      Зарежда FAQ...
    </div>
  )

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1000 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: '-.02em' }}>❓ Често задавани въпроси</h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4, margin: '4px 0 0' }}>
            <span style={{ color: '#1b4332', fontWeight: 700 }}>{activeCount}</span> активни
            &nbsp;·&nbsp;
            <span style={{ color: '#9ca3af' }}>{items.length - activeCount} скрити</span>
            &nbsp;·&nbsp;
            <span style={{ color: '#374151' }}>{categories.length} категории</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setShowCatMgr(true); setEditingCat(null) }}
            style={{ ...S.btn('#f3f4f6', '#374151') }}>
            ⚙️ Категории
          </button>
          <button onClick={() => setEditingFaq({ ...EMPTY_FAQ })}
            style={{ ...S.btn('#1b4332') }}>
            + Нов въпрос
          </button>
        </div>
      </div>

      {/* ── Filters bar ── */}
      <div style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Category pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            {[{ slug: 'all', label: 'Всички', icon: '📋' }, ...categories].map(c => {
              const count = c.slug === 'all' ? items.length : catCounts[c.slug] || 0
              const active = catFilter === c.slug
              return (
                <button key={c.slug} onClick={() => setCatFilter(c.slug)}
                  style={{
                    padding: '6px 12px', borderRadius: 99, border: '1.5px solid',
                    borderColor: active ? '#1b4332' : '#e5e7eb',
                    background:  active ? '#1b4332' : '#fff',
                    color:       active ? '#fff'    : '#6b7280',
                    fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                  <span style={{ background: active ? 'rgba(255,255,255,0.2)' : '#f3f4f6', borderRadius: 99, padding: '0 5px', fontSize: 10 }}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Search + toggle */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
                style={{ accentColor: '#1b4332', width: 14, height: 14 }} />
              Покажи скрити
            </label>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Търси..."
              style={{ ...S.inp, width: 180, padding: '8px 12px' }} />
          </div>
        </div>
      </div>

      {/* ── FAQ list ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', background: '#f9fafb', borderRadius: 16 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🗂️</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: '#374151' }}>Няма въпроси</div>
          <div style={{ fontSize: 13 }}>{search ? 'Опитай с друго търсене' : 'Добави първия въпрос с бутона горе'}</div>
          {!search && (
            <button onClick={() => setEditingFaq({ ...EMPTY_FAQ })}
              style={{ ...S.btn('#1b4332'), marginTop: 16 }}>
              + Добави въпрос
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Drag hint */}
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, paddingLeft: 4 }}>
            ⠿ Влачи за да наредиш · {filtered.length} въпроса
          </div>

          {filtered.map((item, idx) => {
            const cat = categories.find(c => c.slug === item.category)
            const isDragTarget = faqDragOver === idx
            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleFaqDragStart(idx)}
                onDragOver={e  => handleFaqDragOver(e, idx)}
                onDrop={handleFaqDrop}
                onDragEnd={()  => setFaqDragOver(null)}
                style={{
                  background: item.active ? '#fff' : '#fafafa',
                  border: `1.5px solid ${isDragTarget ? '#1b4332' : item.active ? '#e5e7eb' : '#f3f4f6'}`,
                  borderRadius: 12, padding: '13px 14px',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  transition: 'border-color 0.15s, transform 0.1s, box-shadow 0.15s',
                  opacity: item.active ? 1 : 0.65,
                  cursor: 'default',
                  transform: isDragTarget ? 'scale(1.005)' : 'scale(1)',
                  boxShadow: isDragTarget ? '0 4px 20px rgba(27,67,50,0.15)' : '0 1px 4px rgba(0,0,0,0.04)',
                }}>

                {/* Drag handle */}
                <div draggable style={{ paddingTop: 2, cursor: 'grab', opacity: 0.35, flexShrink: 0 }}>
                  <DragHandle />
                </div>

                {/* Order badge */}
                <div style={{ flexShrink: 0, width: 26, textAlign: 'center', paddingTop: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#d1d5db' }}>#{item.sort_order}</span>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    {cat && (
                      <span style={{ fontSize: 11, padding: '2px 8px', background: '#f0fdf4', color: '#15803d', borderRadius: 99, fontWeight: 700, border: '1px solid #d1fae5' }}>
                        {cat.icon} {cat.label}
                      </span>
                    )}
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 700, border: '1px solid',
                      background: item.active ? '#dcfce7' : '#f3f4f6',
                      color:      item.active ? '#065f46' : '#9ca3af',
                      borderColor: item.active ? '#a7f3d0' : '#e5e7eb',
                    }}>
                      {item.active ? '✓ Активен' : '○ Скрит'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: '#111', marginBottom: 5, lineHeight: 1.4 }}>
                    {item.question}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                    {item.answer}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'flex-start' }}>
                  <button onClick={() => toggleActive(item)} title={item.active ? 'Скрий' : 'Покажи'}
                    style={{ ...S.iconBtn(item.active ? '#fef2f2' : '#f0fdf4', item.active ? '#991b1b' : '#15803d') }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                    {item.active ? '🙈' : '👁️'}
                  </button>
                  <button onClick={() => setEditingFaq({ ...item })} title="Редактирай"
                    style={{ ...S.iconBtn() }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#e5e7eb')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f3f4f6')}>
                    ✏️
                  </button>
                  <button onClick={() => delFaq(item.id)} title="Изтрий"
                    style={{ ...S.iconBtn('#fef2f2', '#991b1b') }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fef2f2')}>
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          Modal: Edit / Add FAQ
      ══════════════════════════════════════════════════════════════════════ */}
      {editingFaq && (
        <Modal onClose={() => setEditingFaq(null)} title={editingFaq.id ? '✏️ Редактирай въпрос' : '➕ Нов въпрос'} width={560}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Category select */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Категория</label>
              <select value={editingFaq.category}
                onChange={e => setFaqField('category', e.target.value)}
                style={{ ...S.inp, appearance: 'auto' }}
                onFocus={e => (e.target.style.borderColor = '#1b4332')}
                onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}>
                {categories.map(c => (
                  <option key={c.id} value={c.slug}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>

            {/* Question */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                Въпрос <span style={{ color: '#ef4444' }}>*</span>
                <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>{editingFaq.question.length} символа</span>
              </label>
              <textarea rows={3} value={editingFaq.question}
                onChange={e => setFaqField('question', e.target.value)}
                placeholder="Как да използвам Atlas Terra?"
                style={{ ...S.inp, resize: 'vertical', lineHeight: 1.6 }}
                onFocus={e => (e.target.style.borderColor = '#1b4332')}
                onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
            </div>

            {/* Answer */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                Отговор <span style={{ color: '#ef4444' }}>*</span>
                <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>{editingFaq.answer.length} символа</span>
              </label>
              <textarea rows={6} value={editingFaq.answer}
                onChange={e => setFaqField('answer', e.target.value)}
                placeholder="Atlas Terra е..."
                style={{ ...S.inp, resize: 'vertical', lineHeight: 1.7 }}
                onFocus={e => (e.target.style.borderColor = '#1b4332')}
                onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
            </div>

            {/* Active toggle + preview */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '12px 14px', background: '#f9fafb', borderRadius: 10, border: '1.5px solid #e5e7eb' }}>
              <input type="checkbox" checked={editingFaq.active}
                onChange={e => setFaqField('active', e.target.checked)}
                style={{ width: 17, height: 17, accentColor: '#1b4332', cursor: 'pointer' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Активен (видим на сайта)</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>Когато е деактивиран, въпросът не се показва на посетителите</div>
              </div>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button onClick={() => setEditingFaq(null)}
              style={{ ...S.btn('#f3f4f6', '#374151'), flex: 1, justifyContent: 'center' }}>
              Отказ
            </button>
            <button onClick={saveFaq} disabled={saving}
              style={{ ...S.btn(saving ? '#9ca3af' : '#1b4332'), flex: 2, justifyContent: 'center', cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '⏳ Запазва...' : '✓ Запази въпроса'}
            </button>
          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          Modal: Manage Categories
      ══════════════════════════════════════════════════════════════════════ */}
      {showCatMgr && (
        <Modal onClose={() => { setShowCatMgr(false); setEditingCat(null) }} title="⚙️ Управление на категории" width={580}>

          {!hasCatApi && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
              ⚠️ За динамични категории, пусни <strong>migration_faq_categories.sql</strong> в Supabase SQL Editor.
            </div>
          )}

          {/* Info */}
          <div style={{ background: '#f0fdf4', border: '1px solid #d1fae5', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span>Влачи категориите за да промениш реда им на началната страница. Промените се запазват автоматично.</span>
          </div>

          {/* Categories drag list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {categories.map((c, idx) => {
              const isDragTarget = catDragOver === idx
              return (
                <div
                  key={c.id}
                  draggable={hasCatApi}
                  onDragStart={() => handleCatDragStart(idx)}
                  onDragOver={e  => handleCatDragOver(e, idx)}
                  onDrop={handleCatDrop}
                  onDragEnd={()  => setCatDragOver(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: isDragTarget ? '#f0fdf4' : '#f9fafb',
                    border: `1.5px solid ${isDragTarget ? '#1b4332' : '#e5e7eb'}`,
                    borderRadius: 12, padding: '12px 14px',
                    cursor: hasCatApi ? 'grab' : 'default',
                    transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
                    transform: isDragTarget ? 'scale(1.01)' : 'scale(1)',
                    boxShadow: isDragTarget ? '0 4px 16px rgba(27,67,50,0.12)' : 'none',
                  }}>

                  {/* Drag handle */}
                  {hasCatApi && (
                    <div style={{ opacity: 0.35 }}><DragHandle /></div>
                  )}

                  {/* Order indicator */}
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#374151', flexShrink: 0 }}>
                    {c.sort_order}
                  </div>

                  {/* Icon */}
                  <div style={{ fontSize: 26, flexShrink: 0, width: 36, textAlign: 'center', lineHeight: 1 }}>{c.icon}</div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#111', marginBottom: 2 }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <code style={{ background: '#e5e7eb', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>{c.slug}</code>
                      <span style={{ background: '#f0fdf4', color: '#15803d', padding: '1px 7px', borderRadius: 99, fontWeight: 700, border: '1px solid #d1fae5' }}>
                        {catCounts[c.slug] || 0} въпроса
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  {hasCatApi && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => setEditingCat({ ...c })}
                        style={{ ...S.iconBtn() }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#e5e7eb')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#f3f4f6')}>
                        ✏️
                      </button>
                      <button onClick={() => delCat(c.id)}
                        style={{ ...S.iconBtn('#fef2f2', '#991b1b') }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fef2f2')}>
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add / Edit category form */}
          {hasCatApi && (
            <div style={{ borderTop: '1.5px solid #e5e7eb', paddingTop: 20 }}>
              {editingCat ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 14, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {editingCat.id ? '✏️ Редактирай категория' : '➕ Нова категория'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Icon picker */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Икона</label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        {EMOJI_PRESETS.map(em => (
                          <button key={em} onClick={() => setCatField('icon', em)}
                            style={{
                              background: editingCat.icon === em ? '#f0fdf4' : '#f9fafb',
                              border: `2px solid ${editingCat.icon === em ? '#1b4332' : '#e5e7eb'}`,
                              borderRadius: 8, padding: '5px 8px', cursor: 'pointer', fontSize: 18, lineHeight: 1,
                              transition: 'all 0.1s',
                            }}>
                            {em}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input value={editingCat.icon} onChange={e => setCatField('icon', e.target.value)}
                          style={{ ...S.inp, width: 70, textAlign: 'center', fontSize: 22, padding: '6px' }}
                          maxLength={4} placeholder="🌱" />
                        <div style={{ fontSize: 28 }}>{editingCat.icon}</div>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>← Избери или въведи emoji</span>
                      </div>
                    </div>

                    {/* Name */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                        Наименование <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input value={editingCat.label} onChange={e => setCatField('label', e.target.value)}
                        placeholder="Напр. Торене и наторяване"
                        style={S.inp}
                        onFocus={e => (e.target.style.borderColor = '#1b4332')}
                        onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
                    </div>

                    {/* Slug (only on new) */}
                    {!editingCat.id && (
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                          Slug <span style={{ color: '#9ca3af', fontWeight: 400 }}>(незадължително)</span>
                        </label>
                        <input value={editingCat.slug} onChange={e => setCatField('slug', e.target.value)}
                          placeholder="napr_torene (генерира се автоматично)"
                          style={S.inp}
                          onFocus={e => (e.target.style.borderColor = '#1b4332')}
                          onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditingCat(null)}
                        style={{ ...S.btn('#f3f4f6', '#374151'), flex: 1, justifyContent: 'center' }}>
                        Отказ
                      </button>
                      <button onClick={saveCat} disabled={saving}
                        style={{ ...S.btn(saving ? '#9ca3af' : '#1b4332'), flex: 2, justifyContent: 'center', cursor: saving ? 'default' : 'pointer' }}>
                        {saving ? '⏳...' : '✓ Запази категорията'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <button onClick={() => setEditingCat({ ...EMPTY_CAT })}
                  style={{
                    width: '100%', padding: '12px 0', fontSize: 14, fontWeight: 700,
                    background: '#f0fdf4', color: '#15803d', cursor: 'pointer',
                    border: '2px dashed #86efac', borderRadius: 12, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#dcfce7')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f0fdf4')}>
                  ➕ Добави нова категория
                </button>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
