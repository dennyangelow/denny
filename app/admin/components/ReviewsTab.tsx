'use client'
// app/admin/components/ReviewsTab.tsx — v1
// Обединен admin таб за reviews таблицата — заменя TestimonialsTab.tsx
// (началната страница) и добавя редакция на реални отзиви за собствени
// продукти, афилиейт продукти и наръчници — нещо, което досега можеше
// да се прави само директно през SQL.
//
// Моделиран визуално по TestimonialsTab.tsx (същите цветове/Modal/Stars
// патърни), за да не изглежда като чужд компонент в админ панела.

import { useState, useEffect, useMemo } from 'react'
import { toast } from '@/components/ui/Toast'
import { ImageUpload } from '@/components/ui/ImageUpload'

type EntityType = 'own_product' | 'affiliate_product' | 'handbook'
type ReviewSource = 'site_form' | 'social_screenshot' | 'chat_screenshot' | 'imported'
type ReviewStatus = 'pending' | 'approved' | 'rejected'

interface Review {
  id:              string
  entity_type:     EntityType
  entity_id:       string
  author_name:     string
  author_location?: string
  rating:          number
  text:            string
  source:          ReviewSource
  screenshot_url?: string
  verified:        boolean
  featured_home:   boolean
  home_sort_order?: number
  status:          ReviewStatus
  created_at:      string
}

interface EntityOption { id: string; label: string }

const EMPTY: Review = {
  id: '', entity_type: 'own_product', entity_id: '',
  author_name: '', author_location: '', rating: 5, text: '',
  source: 'site_form', screenshot_url: '', verified: false,
  featured_home: false, home_sort_order: 0, status: 'pending',
  created_at: '',
}

const ENTITY_LABELS: Record<EntityType, string> = {
  own_product:       '🌱 Собствен продукт',
  affiliate_product: '🧪 Афилиейт продукт',
  handbook:          '📘 Наръчник',
}
const SOURCE_LABELS: Record<ReviewSource, string> = {
  site_form:         '📝 От форма на сайта',
  social_screenshot: '📱 Скрийншот — соц. мрежа',
  chat_screenshot:   '💬 Скрийншот — чат',
  imported:          '📦 Мигриран (стара система)',
}
const STATUS_LABELS: Record<ReviewStatus, { label: string; bg: string; fg: string }> = {
  pending:  { label: '⏳ Чака одобрение', bg: '#fef3c7', fg: '#92400e' },
  approved: { label: '✓ Одобрен',         bg: '#dcfce7', fg: '#065f46' },
  rejected: { label: '✗ Отхвърлен',       bg: '#fee2e2', fg: '#991b1b' },
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 16, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
}
const focusGreen = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => (e.target.style.borderColor = '#2d6a4f')
const blurGray   = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => (e.target.style.borderColor = '#e5e7eb')

function Stars({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n}
          onClick={() => onChange?.(n)}
          style={{ fontSize: 20, cursor: onChange ? 'pointer' : 'default', color: n <= rating ? '#f59e0b' : '#d1d5db' }}>
          ★
        </span>
      ))}
    </div>
  )
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 1001,
        transform: 'translate(-50%,-50%)', width: 'min(560px, 92vw)',
        maxHeight: '90vh', overflowY: 'auto', background: '#fff',
        borderRadius: 16, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 18, color: '#6b7280', lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </>
  )
}

export function ReviewsTab() {
  const [items,   setItems]   = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [editing, setEditing] = useState<Review | null>(null)

  // Ентитети за избор в dropdown-а (зареждат се веднъж)
  const [ownProducts, setOwnProducts]     = useState<EntityOption[]>([])
  const [affProducts, setAffProducts]     = useState<EntityOption[]>([])
  const [handbooks,   setHandbooks]       = useState<EntityOption[]>([])

  // Филтри
  const [filterType,   setFilterType]   = useState<EntityType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | 'all'>('all')

  const load = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/reviews')
      const data = await res.json()
      setItems(data.reviews || [])
    } catch { toast.error('Грешка при зареждане') }
    finally { setLoading(false) }
  }

  const loadEntities = async () => {
    try {
      const [ownRes, affRes, narRes] = await Promise.all([
        fetch('/api/own-products').then(r => r.json()).catch(() => ({ products: [] })),
        fetch('/api/affiliate-products').then(r => r.json()).catch(() => ({ products: [] })),
        fetch('/api/naruchnici').then(r => r.json()).catch(() => ({ naruchnici: [] })),
      ])
      setOwnProducts((ownRes.products || []).map((p: any) => ({ id: p.id, label: p.name })))
      setAffProducts((affRes.products || []).map((p: any) => ({ id: p.id, label: p.name })))
      setHandbooks((narRes.naruchnici || []).map((n: any) => ({ id: n.id, label: n.title })))
    } catch { /* тихо — dropdown-ите просто ще са празни, полето entity_id остава свободен избор */ }
  }

  useEffect(() => { load(); loadEntities() }, [])

  const entityOptionsFor = (type: EntityType): EntityOption[] =>
    type === 'own_product' ? ownProducts : type === 'affiliate_product' ? affProducts : handbooks

  // Резолвва id → четимо име, за показване в списъка
  const entityLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    ownProducts.forEach(o => map.set(o.id, o.label))
    affProducts.forEach(o => map.set(o.id, o.label))
    handbooks.forEach(o => map.set(o.id, o.label))
    return map
  }, [ownProducts, affProducts, handbooks])

  const save = async () => {
    if (!editing) return
    if (!editing.author_name.trim() || !editing.text.trim() || !editing.entity_id) {
      toast.error('Име, текст и избран продукт/наръчник са задължителни')
      return
    }
    setSaving(true)
    try {
      const isNew  = !editing.id
      const url    = isNew ? '/api/reviews' : `/api/reviews/${editing.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const { id, created_at, ...body } = editing

      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(isNew ? '✓ Добавен отзив' : '✓ Запазено')
      setEditing(null)
      load()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Изтрий този отзив?')) return
    try {
      await fetch(`/api/reviews/${id}`, { method: 'DELETE' })
      toast.success('Изтрито')
      setItems(prev => prev.filter(r => r.id !== id))
      if (editing?.id === id) setEditing(null)
    } catch { toast.error('Грешка') }
  }

  const quickStatus = async (item: Review, status: ReviewStatus) => {
    try {
      await fetch(`/api/reviews/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setItems(prev => prev.map(r => r.id === item.id ? { ...r, status } : r))
    } catch { toast.error('Грешка') }
  }

  const toggleFeatured = async (item: Review) => {
    try {
      await fetch(`/api/reviews/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured_home: !item.featured_home }),
      })
      setItems(prev => prev.map(r => r.id === item.id ? { ...r, featured_home: !r.featured_home } : r))
    } catch { toast.error('Грешка') }
  }

  const set = (k: keyof Review, v: any) =>
    setEditing(prev => prev ? { ...prev, [k]: v } : prev)

  const filtered = items.filter(r =>
    (filterType === 'all' || r.entity_type === filterType) &&
    (filterStatus === 'all' || r.status === filterStatus)
  )

  const pendingCount = items.filter(r => r.status === 'pending').length

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: '-.02em' }}>⭐ Отзиви</h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
            {items.length} общо
            {pendingCount > 0 && <> · <span style={{ color: '#92400e', fontWeight: 700 }}>{pendingCount} чакат одобрение</span></>}
            {' · '}{items.filter(r => r.featured_home).length} на началната страница
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
          + Нов отзив
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)} style={{ ...inp, width: 'auto' }}>
          <option value="all">Всички типове</option>
          <option value="own_product">🌱 Собствени продукти</option>
          <option value="affiliate_product">🧪 Афилиейт продукти</option>
          <option value="handbook">📘 Наръчници</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={{ ...inp, width: 'auto' }}>
          <option value="all">Всички статуси</option>
          <option value="pending">⏳ Чакат одобрение</option>
          <option value="approved">✓ Одобрени</option>
          <option value="rejected">✗ Отхвърлени</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Зарежда...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Няма отзиви за този филтър</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => {
            const st = STATUS_LABELS[item.status]
            return (
              <div key={item.id}
                style={{
                  background: '#fff',
                  border: `1.5px solid ${editing?.id === item.id ? '#2d6a4f' : '#e5e7eb'}`,
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>

                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#15803d', flexShrink: 0 }}>
                  {(item.author_name[0] || '?').toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{item.author_name}</span>
                    {item.author_location && <span style={{ fontSize: 11, color: '#9ca3af' }}>📍 {item.author_location}</span>}
                    <Stars rating={item.rating} />
                    <span style={{ fontSize: 11, padding: '2px 8px', background: st.bg, color: st.fg, borderRadius: 99, fontWeight: 700 }}>{st.label}</span>
                    {item.featured_home && <span style={{ fontSize: 11, padding: '2px 8px', background: '#ede9fe', color: '#5b21b6', borderRadius: 99, fontWeight: 700 }}>🏠 На началната</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 700 }}>
                      {ENTITY_LABELS[item.entity_type]}: {entityLabelMap.get(item.entity_id) || '(непознат — провери entity_id)'}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{SOURCE_LABELS[item.source]}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{item.text}"</div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 160 }}>
                  {item.status === 'pending' && (
                    <>
                      <button onClick={() => quickStatus(item, 'approved')} title="Одобри"
                        style={{ background: '#dcfce7', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 12 }}>✓</button>
                      <button onClick={() => quickStatus(item, 'rejected')} title="Отхвърли"
                        style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </>
                  )}
                  <button onClick={() => toggleFeatured(item)} title="Начална страница"
                    style={{ background: item.featured_home ? '#ede9fe' : '#f3f4f6', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 12 }}>🏠</button>
                  <button onClick={() => setEditing({ ...item })} title="Редактирай"
                    style={{ background: '#f3f4f6', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                  <button onClick={() => del(item.id)} title="Изтрий"
                    style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal: Edit / Add ─────────────────────────────────────────────── */}
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? '✏️ Редактирай отзив' : '+ Нов отзив'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Тип *</label>
              <select
                value={editing.entity_type}
                onChange={e => { set('entity_type', e.target.value); set('entity_id', '') }}
                style={inp} onFocus={focusGreen} onBlur={blurGray}>
                {(['own_product', 'affiliate_product', 'handbook'] as EntityType[]).map(t => (
                  <option key={t} value={t}>{ENTITY_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Продукт / наръчник *</label>
              <select value={editing.entity_id} onChange={e => set('entity_id', e.target.value)} style={inp} onFocus={focusGreen} onBlur={blurGray}>
                <option value="">— избери —</option>
                {entityOptionsFor(editing.entity_type).map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Име на автора *</label>
              <input value={editing.author_name} onChange={e => set('author_name', e.target.value)}
                placeholder="Иван Петров" style={inp} onFocus={focusGreen} onBlur={blurGray} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Местоположение</label>
              <input value={editing.author_location || ''} onChange={e => set('author_location', e.target.value)}
                placeholder="София" style={inp} onFocus={focusGreen} onBlur={blurGray} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Текст на отзива *</label>
              <textarea rows={4} value={editing.text} onChange={e => set('text', e.target.value)}
                placeholder="Отличен продукт! Резултатите са невероятни..."
                style={{ ...inp, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                Ако е от скрийншот — препиши тук какво пише, дори накратко. Без текст отзивът не участва в Google rich results.
              </span>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Оценка</label>
              <Stars rating={editing.rating || 5} onChange={r => set('rating', r)} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Източник</label>
              <select value={editing.source} onChange={e => set('source', e.target.value)} style={inp} onFocus={focusGreen} onBlur={blurGray}>
                {(['site_form', 'social_screenshot', 'chat_screenshot', 'imported'] as ReviewSource[]).map(s => (
                  <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {(editing.source === 'social_screenshot' || editing.source === 'chat_screenshot') && (
              <ImageUpload
                value={editing.screenshot_url || ''}
                onChange={url => set('screenshot_url', url)}
                folder="reviews"
                label="Скрийншот (доказателство)"
                height={160}
              />
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
              <input type="checkbox" checked={editing.verified} onChange={e => set('verified', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#2d6a4f' }} />
              Верифициран (реално потвърдена покупка/контакт)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
              <input type="checkbox" checked={editing.featured_home} onChange={e => set('featured_home', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#2d6a4f' }} />
              Покажи на началната страница
            </label>

            {editing.featured_home && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Ред на началната (по-малко число = по-напред)</label>
                <input type="number" value={editing.home_sort_order ?? 0} onChange={e => set('home_sort_order', Number(e.target.value))}
                  style={inp} onFocus={focusGreen} onBlur={blurGray} />
              </div>
            )}

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Статус</label>
              <select value={editing.status} onChange={e => set('status', e.target.value)} style={inp} onFocus={focusGreen} onBlur={blurGray}>
                {(['pending', 'approved', 'rejected'] as ReviewStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s].label}</option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Само "Одобрен" се показва публично и участва в рейтинга/schema.</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => setEditing(null)}
              style={{ flex: 1, padding: '11px 0', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
              Отказ
            </button>
            <button onClick={save} disabled={saving}
              style={{ flex: 2, padding: '11px 0', background: saving ? '#9ca3af' : '#1b4332', color: '#fff', border: 'none', borderRadius: 10, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
              {saving ? '⏳ Запазва...' : '✓ Запази'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
