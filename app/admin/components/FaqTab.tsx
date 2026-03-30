'use client'
// app/admin/components/FaqTab.tsx

import { useState, useEffect, useMemo } from 'react'
import { toast } from '@/components/ui/Toast'

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Fallback хардкодирани категории (ако таблицата още не съществува) ─────────
const FALLBACK_CATEGORIES: FaqCategory[] = [
  { id: 'atlas',     slug: 'atlas',     label: 'Atlas Terra',        icon: '🌱', sort_order: 1 },
  { id: 'affiliate', slug: 'affiliate', label: 'Афилиейт & Ginegar', icon: '🏕️', sort_order: 2 },
  { id: 'delivery',  slug: 'delivery',  label: 'Доставка & Мен',     icon: '🚚', sort_order: 3 },
]

// ── Shared styles ─────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
  transition: 'border-color 0.15s',
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({ onClose, title, children }: {
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 1001,
        transform: 'translate(-50%,-50%)',
        width: '90%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
        background: '#fff', borderRadius: 16, padding: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{
            background: '#f5f5f5', border: 'none', borderRadius: 8,
            padding: '5px 10px', cursor: 'pointer', fontSize: 18,
            color: '#6b7280', lineHeight: 1,
          }}>✕</button>
        </div>
        {children}
      </div>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function FaqTab() {
  const [items,      setItems]      = useState<FaqItem[]>([])
  const [categories, setCategories] = useState<FaqCategory[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [hasCatApi,  setHasCatApi]  = useState(false)

  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null)
  const [editingCat, setEditingCat] = useState<FaqCategory | null>(null)
  const [showCatMgr, setShowCatMgr] = useState(false)

  const [catFilter, setCatFilter] = useState('all')
  const [search,    setSearch]    = useState('')

  // ── Load — двата заявки са независими ────────────────────────────────────
  const loadAll = async () => {
    setLoading(true)

    // Зареди FAQ въпросите
    try {
      const res     = await fetch('/api/faq?all=true')
      if (res.ok) {
        const { faq } = await res.json()
        setItems(faq || [])
      }
    } catch {
      toast.error('Грешка при зареждане на въпросите')
    }

    // Зареди категориите — API-ят винаги връща 200 сега
    try {
      const res            = await fetch('/api/faq-categories')
      if (res.ok) {
        const { categories: cats } = await res.json()
        if (Array.isArray(cats) && cats.length > 0) {
          setCategories(cats)
          setHasCatApi(true)
        } else {
          // Таблицата съществува но е празна — покажи fallback само визуално
          setCategories(FALLBACK_CATEGORIES)
          setHasCatApi(false)
        }
      } else {
        setCategories(FALLBACK_CATEGORIES)
        setHasCatApi(false)
      }
    } catch {
      setCategories(FALLBACK_CATEGORIES)
      setHasCatApi(false)
    }

    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items
      .filter(f => catFilter === 'all' || f.category === catFilter)
      .filter(f => !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [items, catFilter, search])

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    items.forEach(f => { m[f.category] = (m[f.category] || 0) + 1 })
    return m
  }, [items])

  // ── FAQ CRUD ──────────────────────────────────────────────────────────────
  const saveFaq = async () => {
    if (!editingFaq) return
    if (!editingFaq.question.trim() || !editingFaq.answer.trim()) {
      toast.error('Въпросът и отговорът са задължителни')
      return
    }
    setSaving(true)
    try {
      const isNew  = !editingFaq.id
      const url    = isNew ? '/api/faq' : `/api/faq/${editingFaq.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
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
      if (editingFaq?.id === id) setEditingFaq(null)
    } catch { toast.error('Грешка при изтриване') }
  }

  const toggleActive = async (item: FaqItem) => {
    try {
      await fetch(`/api/faq/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !item.active }),
      })
      setItems(prev => prev.map(f => f.id === item.id ? { ...f, active: !f.active } : f))
    } catch { toast.error('Грешка') }
  }

  const updateOrder = async (item: FaqItem, delta: number) => {
    const newOrder = item.sort_order + delta
    try {
      await fetch(`/api/faq/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: newOrder }),
      })
      setItems(prev => prev.map(f => f.id === item.id ? { ...f, sort_order: newOrder } : f))
    } catch { toast.error('Грешка') }
  }

  // ── Category CRUD ─────────────────────────────────────────────────────────
  const saveCat = async () => {
    if (!editingCat) return
    if (!editingCat.label.trim()) { toast.error('Името е задължително'); return }
    if (!editingCat.icon.trim())  { toast.error('Иконата е задължителна'); return }
    setSaving(true)
    try {
      const isNew  = !editingCat.id
      const url    = isNew ? '/api/faq-categories' : `/api/faq-categories/${editingCat.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
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
    if (!confirm('Изтрий тази категория?')) return
    try {
      const res  = await fetch(`/api/faq-categories/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Категорията е изтрита')
      loadAll()
    } catch (e: any) { toast.error(e.message) }
  }

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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: '-.02em' }}>❓ FAQ</h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
            {items.length} въпроса • {categories.length} категории
            {!hasCatApi && (
              <span style={{ marginLeft: 8, color: '#f59e0b', fontSize: 11, fontWeight: 600 }}>
                ⚠️ пусни SQL миграцията за динамични категории
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setShowCatMgr(true); setEditingCat(null) }}
            style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
            ⚙️ Категории
          </button>
          <button
            onClick={() => setEditingFaq({ ...EMPTY_FAQ })}
            style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
            + Нов въпрос
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {[{ slug: 'all', label: 'Всички', icon: '📋' }, ...categories].map(c => (
          <button key={c.slug} onClick={() => setCatFilter(c.slug)}
            style={{
              padding: '6px 14px', borderRadius: 99, border: '1.5px solid',
              borderColor: catFilter === c.slug ? '#2d6a4f' : '#e5e7eb',
              background:  catFilter === c.slug ? '#f0fdf4' : '#fff',
              color:       catFilter === c.slug ? '#2d6a4f' : '#6b7280',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
            {c.icon} {c.label}
            {c.slug !== 'all' && catCounts[c.slug] ? ` (${catCounts[c.slug]})` : ''}
          </button>
        ))}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Търси въпрос..."
          style={{ ...inp, width: 200, marginLeft: 'auto' }}
        />
      </div>

      {/* FAQ list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Зарежда...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗂️</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Няма въпроси</div>
          <div style={{ fontSize: 13 }}>
            {search ? 'Опитай с друго търсене' : 'Добави първия въпрос с бутона горе вдясно'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => {
            const cat = categories.find(c => c.slug === item.category)
            return (
              <div key={item.id} style={{
                background: '#fff',
                border: `1.5px solid ${editingFaq?.id === item.id ? '#2d6a4f' : '#e5e7eb'}`,
                borderRadius: 12, padding: '14px 16px',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                transition: 'border-color 0.15s',
              }}>
                {/* Sort */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                  <button onClick={() => updateOrder(item, -1)}
                    style={{ background: '#f3f4f6', border: 'none', borderRadius: 5, width: 24, height: 22, cursor: 'pointer', fontSize: 11 }}>▲</button>
                  <span style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', fontWeight: 700 }}>{item.sort_order}</span>
                  <button onClick={() => updateOrder(item, 1)}
                    style={{ background: '#f3f4f6', border: 'none', borderRadius: 5, width: 24, height: 22, cursor: 'pointer', fontSize: 11 }}>▼</button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', background: '#f0fdf4', color: '#15803d', borderRadius: 99, fontWeight: 700 }}>
                      {cat?.icon} {cat?.label ?? item.category}
                    </span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px',
                      background: item.active ? '#dcfce7' : '#fee2e2',
                      color: item.active ? '#065f46' : '#991b1b',
                      borderRadius: 99, fontWeight: 700,
                    }}>
                      {item.active ? '✓ Активен' : '✗ Скрит'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#111', marginBottom: 4 }}>{item.question}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.answer}</div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => toggleActive(item)} title={item.active ? 'Скрий' : 'Покажи'}
                    style={{ background: item.active ? '#fee2e2' : '#dcfce7', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 12 }}>
                    {item.active ? '🙈' : '👁️'}
                  </button>
                  <button onClick={() => setEditingFaq({ ...item })} title="Редактирай"
                    style={{ background: '#f3f4f6', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
                    ✏️
                  </button>
                  <button onClick={() => delFaq(item.id)} title="Изтрий"
                    style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 12 }}>
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal: Edit / Add FAQ ───────────────────────────────────────────── */}
      {editingFaq && (
        <Modal onClose={() => setEditingFaq(null)} title={editingFaq.id ? '✏️ Редактирай въпрос' : '+ Нов въпрос'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Категория</label>
              <select value={editingFaq.category} onChange={e => setFaqField('category', e.target.value)} style={inp}>
                {categories.map(c => (
                  <option key={c.id} value={c.slug}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Въпрос *</label>
              <textarea rows={3} value={editingFaq.question} onChange={e => setFaqField('question', e.target.value)}
                placeholder="Какво е Atlas Terra?"
                style={{ ...inp, resize: 'vertical' }}
                onFocus={e => (e.target.style.borderColor = '#2d6a4f')}
                onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Отговор *</label>
              <textarea rows={5} value={editingFaq.answer} onChange={e => setFaqField('answer', e.target.value)}
                placeholder="Atlas Terra е..."
                style={{ ...inp, resize: 'vertical' }}
                onFocus={e => (e.target.style.borderColor = '#2d6a4f')}
                onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Ред (sort_order)</label>
              <input type="number" value={editingFaq.sort_order} min="0"
                onChange={e => setFaqField('sort_order', Number(e.target.value))}
                style={inp}
                onFocus={e => (e.target.style.borderColor = '#2d6a4f')}
                onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
              <input type="checkbox" checked={editingFaq.active} onChange={e => setFaqField('active', e.target.checked)}
                style={{ width: 17, height: 17, accentColor: '#2d6a4f' }} />
              Активен (видим на сайта)
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button onClick={() => setEditingFaq(null)}
              style={{ flex: 1, padding: '11px 0', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
              Отказ
            </button>
            <button onClick={saveFaq} disabled={saving}
              style={{ flex: 2, padding: '11px 0', background: saving ? '#9ca3af' : '#1b4332', color: '#fff', border: 'none', borderRadius: 10, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
              {saving ? '⏳ Запазва...' : '✓ Запази'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Modal: Manage Categories ────────────────────────────────────────── */}
      {showCatMgr && (
        <Modal onClose={() => { setShowCatMgr(false); setEditingCat(null) }} title="⚙️ Управление на категории">

          {!hasCatApi && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
              ⚠️ За да управляваш категории динамично, пусни <strong>migration_faq_categories.sql</strong> в Supabase SQL Editor.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {categories.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f9fafb', borderRadius: 10, padding: '10px 14px' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{c.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    slug: <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 4 }}>{c.slug}</code>
                    {' '}• {catCounts[c.slug] || 0} въпроса
                  </div>
                </div>
                {hasCatApi && (
                  <>
                    <button onClick={() => setEditingCat({ ...c })}
                      style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 13 }}>✏️</button>
                    <button onClick={() => delCat(c.id)}
                      style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 13 }}>✕</button>
                  </>
                )}
              </div>
            ))}
          </div>

          {hasCatApi && (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
              {editingCat ? (
                <>
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#374151' }}>
                    {editingCat.id ? '✏️ Редактирай категория' : '+ Нова категория'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: '0 0 72px' }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Икона</label>
                        <input value={editingCat.icon} onChange={e => setCatField('icon', e.target.value)}
                          style={{ ...inp, textAlign: 'center', fontSize: 22, padding: '5px' }} maxLength={4} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Име *</label>
                        <input value={editingCat.label} onChange={e => setCatField('label', e.target.value)}
                          placeholder="Напр. Торене" style={inp}
                          onFocus={e => (e.target.style.borderColor = '#2d6a4f')}
                          onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
                      </div>
                    </div>
                    {!editingCat.id && (
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
                          Slug <span style={{ color: '#9ca3af', fontWeight: 400 }}>(незадължително — генерира се автоматично)</span>
                        </label>
                        <input value={editingCat.slug} onChange={e => setCatField('slug', e.target.value)}
                          placeholder="napr_torene" style={inp}
                          onFocus={e => (e.target.style.borderColor = '#2d6a4f')}
                          onBlur={e  => (e.target.style.borderColor = '#e5e7eb')} />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditingCat(null)}
                        style={{ flex: 1, padding: '9px 0', border: '1px solid #e5e7eb', borderRadius: 9, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                        Отказ
                      </button>
                      <button onClick={saveCat} disabled={saving}
                        style={{ flex: 2, padding: '9px 0', background: saving ? '#9ca3af' : '#1b4332', color: '#fff', border: 'none', borderRadius: 9, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
                        {saving ? '⏳...' : '✓ Запази'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <button onClick={() => setEditingCat({ ...EMPTY_CAT })}
                  style={{ width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 600, background: '#f0fdf4', color: '#15803d', cursor: 'pointer', border: '1.5px dashed #86efac', borderRadius: 10, fontFamily: 'inherit' }}>
                  + Добави нова категория
                </button>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
