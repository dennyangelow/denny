'use client'
// app/admin/components/OwnProductsTab.tsx
// v2 — добавена SEO секция: seo_title, seo_description, seo_keywords, image_alt
// Всички промени са маркирани с // [SEO]

import { useState, useEffect, useCallback } from 'react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { toast } from '@/components/ui/Toast'
import { useCurrency } from './CurrencyContext'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Product {
  id: string
  name: string
  slug: string
  subtitle: string
  description: string
  badge: string
  emoji: string
  image_url: string
  // [SEO] ново
  image_alt: string
  seo_title: string
  seo_description: string
  seo_keywords: string
  price: number | null
  compare_price: number | null
  unit: string
  stock: number
  sort_order: number
  active: boolean
  features: string[]
  category: string
}

interface Variant {
  id: string
  product_id: string
  label: string
  size_liters: number | null
  price: number | null
  compare_price: number | null
  price_per_liter: number | null
  stock: number
  sort_order: number
  active: boolean
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
  transition: 'border-color 0.15s',
}
const fg = (e: React.FocusEvent<HTMLElement>) => ((e.target as HTMLElement).style.borderColor = '#2d6a4f')
const bg = (e: React.FocusEvent<HTMLElement>) => ((e.target as HTMLElement).style.borderColor = '#e5e7eb')

const Label = ({ children }: { children: React.ReactNode }) => (
  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
    {children}
  </label>
)

const Hint = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{children}</div>
)

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', letterSpacing: '.05em', textTransform: 'uppercase', padding: '14px 0 8px', borderBottom: '1.5px solid #f3f4f6', marginBottom: 12 }}>
    {children}
  </div>
)

// [SEO] CharCount компонент — показва дали дължината е в идеалния диапазон
function CharCount({ value, min, max }: { value: string; min: number; max: number }) {
  const len = value.length
  const color = len === 0 ? '#9ca3af' : len < min ? '#f59e0b' : len > max ? '#ef4444' : '#16a34a'
  const label = len === 0 ? '' : len < min ? ` (мин. ${min})` : len > max ? ` (макс. ${max})` : ' ✓'
  return (
    <span style={{ fontSize: 11, color, marginLeft: 4 }}>
      {len}{label}
    </span>
  )
}

// ── Empty defaults ─────────────────────────────────────────────────────────────
const EMPTY_PRODUCT: Product = {
  id: '', name: '', slug: '', subtitle: '', description: '',
  badge: 'Хит', emoji: '🌿', image_url: '',
  // [SEO]
  image_alt: '', seo_title: '', seo_description: '', seo_keywords: '',
  price: null, compare_price: null, unit: 'л.',
  stock: 100, sort_order: 1, active: true,
  features: [], category: '',
}

const EMPTY_VARIANT = (productId: string, order: number): Variant => ({
  id: '', product_id: productId, label: '5 литра',
  size_liters: 5, price: null, compare_price: null,
  price_per_liter: null, stock: 100, sort_order: order, active: true,
})

// ── Helpers ────────────────────────────────────────────────────────────────────
const numVal = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : String(v)

const parseNum = (s: string): number | null =>
  s.trim() === '' ? null : isNaN(Number(s)) ? null : Number(s)

const calcPPL = (price: number | null, liters: number | null): number | null => {
  if (!price || !liters || liters === 0) return null
  return Math.round((price / liters) * 10000) / 10000
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function OwnProductsTab() {
  const { symbol: currencySymbol } = useCurrency()
  const [products,  setProducts]  = useState<Product[]>([])
  const [variants,  setVariants]  = useState<Variant[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [editing,   setEditing]   = useState<Product | null>(null)
  const [editVars,  setEditVars]  = useState<Variant[]>([])
  const [deletingVar, setDeletingVar] = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, vRes] = await Promise.all([
        fetch('/api/own-products'),
        fetch('/api/own-products/variants?admin=1'),
      ])

      if (!pRes.ok) throw new Error(`Грешка при зареждане на продукти: ${pRes.status}`)
      if (!vRes.ok) throw new Error(`Грешка при зареждане на разфасовки: ${vRes.status}`)

      const pData = await pRes.json()
      const vData = await vRes.json()
      setProducts(pData.products || [])
      setVariants(vData.variants || [])
    } catch (e: any) {
      toast.error('Грешка при зареждане: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Open editor ───────────────────────────────────────────────────────────────
  const openEdit = (product: Product) => {
    setEditing({
      ...product,
      // [SEO] гарантираме стрингове, не null/undefined
      image_alt:       product.image_alt       || '',
      seo_title:       product.seo_title       || '',
      seo_description: product.seo_description || '',
      seo_keywords:    product.seo_keywords    || '',
    })
    setEditVars(
      variants
        .filter(v => v.product_id === product.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(v => ({ ...v }))
    )
  }

  const startNew = () => {
    setEditing({ ...EMPTY_PRODUCT })
    setEditVars([])
  }

  // ── Product field update ──────────────────────────────────────────────────────
  const setProd = (k: keyof Product, v: any) =>
    setEditing(prev => prev ? { ...prev, [k]: v } : prev)

  // ── Variant helpers ───────────────────────────────────────────────────────────
  const addVariant = () => {
    setEditVars(prev => [
      ...prev,
      EMPTY_VARIANT(editing?.id || '', prev.length + 1),
    ])
  }

  const setVar = (idx: number, k: keyof Variant, v: any) => {
    setEditVars(prev => prev.map((vr, i) => {
      if (i !== idx) return vr
      const updated = { ...vr, [k]: v }
      if (k === 'price' || k === 'size_liters') {
        updated.price_per_liter = calcPPL(
          k === 'price' ? parseNum(String(v)) : updated.price,
          k === 'size_liters' ? parseNum(String(v)) : updated.size_liters,
        )
      }
      return updated
    }))
  }

  const removeVariantLocal = (idx: number) => {
    setEditVars(prev => prev.filter((_, i) => i !== idx))
  }

  const deleteVariant = async (varId: string, idx: number) => {
    if (!confirm('Изтрий тази разфасовка?')) return
    if (!varId) { removeVariantLocal(idx); return }
    setDeletingVar(varId)
    try {
      const res = await fetch(`/api/own-products/variants/${varId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      removeVariantLocal(idx)
      toast.success('Разфасовката е изтрита')
    } catch { toast.error('Грешка при изтриване') }
    finally { setDeletingVar(null) }
  }

  // ── Save product + variants ───────────────────────────────────────────────────
  const save = async () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Наименованието е задължително'); return }
    setSaving(true)
    try {
      const isNew = !editing.id
      const pUrl  = isNew ? '/api/own-products' : `/api/own-products/${editing.id}`
      const pRes  = await fetch(pUrl, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (!pRes.ok) throw new Error((await pRes.json()).error || 'Грешка при запазване')
      const pData = await pRes.json()
      const savedProduct: Product = pData.product

      await Promise.all(editVars.map(async (v, i) => {
        const vPayload = {
          ...v,
          product_id: savedProduct.id,
          sort_order: i + 1,
          price_per_liter: calcPPL(v.price, v.size_liters),
        }
        if (!v.id) {
          await fetch('/api/own-products/variants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vPayload),
          })
        } else {
          await fetch(`/api/own-products/variants/${v.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vPayload),
          })
        }
      }))

      toast.success(isNew ? '✓ Продуктът е създаден!' : '✓ Запазено успешно!')
      setEditing(null)
      setEditVars([])
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete product ────────────────────────────────────────────────────────────
  const del = async (id: string) => {
    if (!confirm('Изтрий продукта и всички негови разфасовки?')) return
    try {
      const res = await fetch(`/api/own-products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Продуктът е изтрит')
      if (editing?.id === id) { setEditing(null); setEditVars([]) }
      load()
    } catch { toast.error('Грешка при изтриване') }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr 480px' : '1fr', gap: 20 }}>

      {/* ════ LIST ════ */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            {loading ? 'Зарежда...' : `${products.length} продукта`}
          </span>
          <button onClick={startNew}
            style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
            + Добави нов
          </button>
        </div>

        <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              Зарежда продуктите...
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
              Няма продукти. Натисни «+ Добави нов».
            </div>
          ) : products.map((p, i) => {
            const pvs = variants.filter(v => v.product_id === p.id)
            const isEditing = editing?.id === p.id
            // [SEO] показваме индикатор дали SEO е попълнено
            const hasSeo = !!(p.seo_title || p.seo_description)
            return (
              <div key={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < products.length - 1 ? '1px solid #f5f5f5' : 'none', background: isEditing ? '#f0fdf4' : '' }}
                onMouseEnter={e => { if (!isEditing) e.currentTarget.style.background = '#f9fafb' }}
                onMouseLeave={e => { if (!isEditing) e.currentTarget.style.background = '' }}>

                {p.image_url ? (
                  <img src={p.image_url} alt={p.image_alt || p.name}
                    style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid #e5e7eb' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <div style={{ width: 50, height: 50, background: '#f3f4f6', borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    {p.emoji || '📦'}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {p.name}
                    {!p.active && <span style={{ fontSize: 11, background: '#fee2e2', color: '#991b1b', borderRadius: 99, padding: '1px 8px' }}>Неактивен</span>}
                    {p.badge && <span style={{ fontSize: 10, background: '#f0fdf4', color: '#15803d', borderRadius: 99, padding: '1px 8px', border: '1px solid #d1fae5', fontWeight: 800 }}>{p.badge}</span>}
                    {/* [SEO] индикатор */}
                    {hasSeo
                      ? <span style={{ fontSize: 10, background: '#f0fdf4', color: '#15803d', borderRadius: 99, padding: '1px 8px', border: '1px solid #d1fae5' }}>SEO ✓</span>
                      : <span style={{ fontSize: 10, background: '#fff7ed', color: '#c2410c', borderRadius: 99, padding: '1px 8px', border: '1px solid #fed7aa' }}>SEO липсва</span>
                    }
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{p.slug}</code>
                    {pvs.length > 0 ? (
                      <span style={{ color: '#374151' }}>
                        {pvs.map(v => `${v.label}: ${v.price ? v.price + ' ' + currencySymbol : '—'}`).join(' · ')}
                      </span>
                    ) : p.price !== null ? (
                      <span style={{ color: '#374151', fontWeight: 600 }}>{p.price} €</span>
                    ) : null}
                    {pvs.length > 0 && (
                      <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', borderRadius: 99, padding: '1px 7px', border: '1px solid #bfdbfe' }}>
                        {pvs.length} разфасовки
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openEdit(p)}
                    style={{ background: isEditing ? '#dcfce7' : '#f3f4f6', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151', fontWeight: 600 }}>
                    ✏️ Редактирай
                  </button>
                  <button onClick={() => del(p.id)}
                    style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#991b1b' }}>
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ════ EDIT PANEL ════ */}
      {editing && (
        <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 16, padding: 22, maxHeight: '90vh', overflowY: 'auto', position: 'sticky', top: 20 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
              {editing.id ? `✏️ ${editing.name || 'Редактирай'}` : '+ Нов продукт'}
            </h3>
            <button onClick={() => { setEditing(null); setEditVars([]) }}
              style={{ background: '#f5f5f5', border: 'none', borderRadius: 7, width: 32, height: 32, cursor: 'pointer', color: '#6b7280', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── СНИМКА ── */}
            <ImageUpload
              value={editing.image_url || ''}
              onChange={url => setProd('image_url', url)}
              folder="products"
              label="Снимка на продукта"
              height={160}
            />

            {/* [SEO] Alt текст за снимката — веднага след снимката */}
            <div>
              <Label>
                Alt текст на снимката
                <CharCount value={editing.image_alt} min={20} max={125} />
              </Label>
              <input
                value={editing.image_alt}
                onChange={e => setProd('image_alt', e.target.value)}
                placeholder={`Atlas Terra органичен биостимулатор — течна формула за домати`}
                style={inp}
                onFocus={fg}
                onBlur={bg}
              />
              <Hint>Описва снимката за Google Images и достъпност. Използвай ключови думи естествено.</Hint>
            </div>

            {/* ── ОСНОВНА ИНФОРМАЦИЯ ── */}
            <SectionTitle>📦 Основна информация</SectionTitle>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
              <div>
                <Label>Наименование *</Label>
                <input value={editing.name} onChange={e => setProd('name', e.target.value)}
                  placeholder="Atlas Terra — Органичен подобрител"
                  style={inp} onFocus={fg} onBlur={bg} />
              </div>
              <div>
                <Label>Emoji</Label>
                <input value={editing.emoji} onChange={e => setProd('emoji', e.target.value)}
                  placeholder="🌿" style={{ ...inp, textAlign: 'center', fontSize: 20 }} maxLength={4} onFocus={fg} onBlur={bg} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <Label>Slug (URL)</Label>
                <input value={editing.slug} onChange={e => setProd('slug', e.target.value)}
                  placeholder="atlas-terra" style={{ ...inp, fontFamily: 'monospace', fontSize: 12 }} onFocus={fg} onBlur={bg} />
              </div>
              <div>
                <Label>Badge</Label>
                <input value={editing.badge} onChange={e => setProd('badge', e.target.value)}
                  placeholder="Хит" style={inp} onFocus={fg} onBlur={bg} />
              </div>
            </div>

            <div>
              <Label>Подзаглавие</Label>
              <input value={editing.subtitle} onChange={e => setProd('subtitle', e.target.value)}
                placeholder="Биостимулант с хумусни и фулво-киселини" style={inp} onFocus={fg} onBlur={bg} />
            </div>

            <div>
              <Label>Описание</Label>
              <textarea rows={4} value={editing.description} onChange={e => setProd('description', e.target.value)}
                placeholder="Подробно описание на продукта..."
                style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} onFocus={fg} onBlur={bg} />
            </div>

            <div>
              <Label>Предимства (по едно на ред)</Label>
              <textarea rows={4}
                value={Array.isArray(editing.features) ? editing.features.join('\n') : ''}
                onChange={e => setProd('features', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                placeholder={'Повишава добива с до 30%\nПодобрява структурата на почвата\nОрганичен — без химия'}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} onFocus={fg} onBlur={bg} />
              <Hint>
                {Array.isArray(editing.features) && editing.features.length > 0
                  ? `✓ ${editing.features.length} предимства`
                  : 'По едно предимство на всеки ред'}
              </Hint>
            </div>

            <div>
              <Label>Категория</Label>
              <input value={editing.category} onChange={e => setProd('category', e.target.value)}
                placeholder="atlas" style={inp} onFocus={fg} onBlur={bg} />
            </div>

            {/* ── ЦЕНА (базова) ── */}
            <SectionTitle>💶 Цена (базова)</SectionTitle>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e' }}>
              💡 Ако продуктът има разфасовки (5л, 20л...), цената се управлява от тях. Тук попълни само ако <strong>няма разфасовки</strong>.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 10 }}>
              <div>
                <Label>Цена (€)</Label>
                <div style={{ position: 'relative' }}>
                  <input type="number" step="0.01" min="0"
                    value={numVal(editing.price)}
                    onChange={e => setProd('price', parseNum(e.target.value))}
                    placeholder="14.90" style={{ ...inp, paddingRight: 28 }} onFocus={fg} onBlur={bg} />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9ca3af', pointerEvents: 'none' }}>€</span>
                </div>
              </div>
              <div>
                <Label>Стара цена (€)</Label>
                <div style={{ position: 'relative' }}>
                  <input type="number" step="0.01" min="0"
                    value={numVal(editing.compare_price)}
                    onChange={e => setProd('compare_price', parseNum(e.target.value))}
                    placeholder="18.00" style={{ ...inp, paddingRight: 28 }} onFocus={fg} onBlur={bg} />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9ca3af', pointerEvents: 'none' }}>€</span>
                </div>
              </div>
              <div>
                <Label>Мерна единица</Label>
                <input value={editing.unit} onChange={e => setProd('unit', e.target.value)}
                  placeholder="л." style={inp} onFocus={fg} onBlur={bg} />
              </div>
            </div>

            {/* ── НАЛИЧНОСТ + РЕД ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <Label>Наличност (бр.)</Label>
                <input type="number" min="0" value={editing.stock}
                  onChange={e => setProd('stock', Number(e.target.value))}
                  placeholder="100" style={inp} onFocus={fg} onBlur={bg} />
              </div>
              <div>
                <Label>Ред (sort_order)</Label>
                <input type="number" min="0" value={editing.sort_order}
                  onChange={e => setProd('sort_order', Number(e.target.value))}
                  placeholder="1" style={inp} onFocus={fg} onBlur={bg} />
              </div>
            </div>

            {/* Active toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '11px 13px', background: '#f9fafb', borderRadius: 10, border: '1.5px solid #e5e7eb' }}>
              <input type="checkbox" checked={editing.active}
                onChange={e => setProd('active', e.target.checked)}
                style={{ width: 17, height: 17, accentColor: '#2d6a4f', cursor: 'pointer' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Активен продукт</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Показва се на началната страница</div>
              </div>
            </label>

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* [SEO] SEO СЕКЦИЯ — нова ─────────────────────────────────────── */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            <SectionTitle>🔍 SEO — Google оптимизация</SectionTitle>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#065f46', lineHeight: 1.6 }}>
              <strong>Защо е важно:</strong> Тези полета се използват в Product Schema (JSON-LD) — Google показва продукта в rich results с цена, рейтинг и наличност. Попълни ги за всеки продукт.
            </div>

            <div>
              <Label>
                SEO заглавие
                <CharCount value={editing.seo_title} min={40} max={60} />
              </Label>
              <input
                value={editing.seo_title}
                onChange={e => setProd('seo_title', e.target.value)}
                placeholder={`${editing.name || 'Atlas Terra'} — Биостимулатор за Домати | Denny Angelow`}
                style={inp}
                onFocus={fg}
                onBlur={bg}
              />
              <Hint>Идеално: 50–60 знака. Включи името на продукта + главна ключова дума.</Hint>
            </div>

            <div>
              <Label>
                SEO описание
                <CharCount value={editing.seo_description} min={120} max={160} />
              </Label>
              <textarea
                rows={3}
                value={editing.seo_description}
                onChange={e => setProd('seo_description', e.target.value)}
                placeholder={`${editing.name || 'Atlas Terra'} — органичен биостимулатор с хуминови киселини за домати и краставици. Сертифициран за екологично земеделие. Поръчай с доставка до вратата.`}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
                onFocus={fg}
                onBlur={bg}
              />
              <Hint>Идеално: 120–160 знака. Описва продукта + призив за действие.</Hint>
            </div>

            <div>
              <Label>SEO ключови думи</Label>
              <input
                value={editing.seo_keywords}
                onChange={e => setProd('seo_keywords', e.target.value)}
                placeholder="Atlas Terra, биостимулатор за домати, хуминови киселини, органичен тор"
                style={inp}
                onFocus={fg}
                onBlur={bg}
              />
              <Hint>Разделени със запетая. 5–10 думи, свързани директно с продукта.</Hint>
            </div>

            {/* [SEO] Preview box */}
            {(editing.seo_title || editing.seo_description) && (
              <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Google Preview
                </div>
                <div style={{ fontSize: 13, color: '#1a0dab', fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {editing.seo_title || editing.name || 'Заглавие на продукта'}
                </div>
                <div style={{ fontSize: 11, color: '#006621', marginBottom: 4 }}>
                  dennyangelow.com
                </div>
                <div style={{ fontSize: 12, color: '#545454', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {editing.seo_description || editing.description || 'Описание на продукта...'}
                </div>
              </div>
            )}

            {/* ── РАЗФАСОВКИ ── */}
            {editing.id && (
              <>
                <SectionTitle>📐 Разфасовки и цени</SectionTitle>

                {editVars.length === 0 ? (
                  <div style={{ background: '#f9fafb', border: '1.5px dashed #e5e7eb', borderRadius: 10, padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                    Няма разфасовки. Добави ако продуктът се продава в различни обеми (5л, 20л...).
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {editVars.map((v, idx) => (
                      <div key={v.id || `new-${idx}`}
                        style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '14px 14px 10px' }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#374151' }}>
                            {v.id ? `Разфасовка #${idx + 1}` : `✨ Нова разфасовка #${idx + 1}`}
                          </span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11, color: '#374151' }}>
                              <input type="checkbox" checked={v.active}
                                onChange={e => setVar(idx, 'active', e.target.checked)}
                                style={{ accentColor: '#2d6a4f', width: 13, height: 13 }} />
                              Активна
                            </label>
                            <button onClick={() => deleteVariant(v.id, idx)}
                              disabled={deletingVar === v.id}
                              style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                              {deletingVar === v.id ? '⏳' : '🗑️'}
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 8 }}>
                          <div>
                            <Label>Наименование на разфасовката</Label>
                            <input value={v.label} onChange={e => setVar(idx, 'label', e.target.value)}
                              placeholder="5 литра" style={inp} onFocus={fg} onBlur={bg} />
                          </div>
                          <div>
                            <Label>Обем (л.)</Label>
                            <input type="number" step="0.1" min="0"
                              value={numVal(v.size_liters)}
                              onChange={e => setVar(idx, 'size_liters', parseNum(e.target.value))}
                              placeholder="5" style={inp} onFocus={fg} onBlur={bg} />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                          <div>
                            <Label>Цена (€)</Label>
                            <div style={{ position: 'relative' }}>
                              <input type="number" step="0.01" min="0"
                                value={numVal(v.price)}
                                onChange={e => setVar(idx, 'price', parseNum(e.target.value))}
                                placeholder="72.90" style={{ ...inp, paddingRight: 24 }} onFocus={fg} onBlur={bg} />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af', pointerEvents: 'none' }}>€</span>
                            </div>
                          </div>
                          <div>
                            <Label>Стара цена (€)</Label>
                            <div style={{ position: 'relative' }}>
                              <input type="number" step="0.01" min="0"
                                value={numVal(v.compare_price)}
                                onChange={e => setVar(idx, 'compare_price', parseNum(e.target.value))}
                                placeholder="87.48" style={{ ...inp, paddingRight: 24 }} onFocus={fg} onBlur={bg} />
                              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#9ca3af', pointerEvents: 'none' }}>€</span>
                            </div>
                          </div>
                          <div>
                            <Label>€/литър</Label>
                            <input readOnly
                              value={v.price_per_liter !== null ? v.price_per_liter.toFixed(4) : '—'}
                              style={{ ...inp, background: '#f9fafb', color: '#9ca3af', cursor: 'default' }} />
                            <Hint>Изчислява се автоматично</Hint>
                          </div>
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <Label>Наличност (бр.)</Label>
                          <input type="number" min="0" value={v.stock}
                            onChange={e => setVar(idx, 'stock', Number(e.target.value))}
                            placeholder="100" style={{ ...inp, maxWidth: 120 }} onFocus={fg} onBlur={bg} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={addVariant}
                  style={{ width: '100%', padding: '10px', fontSize: 13, fontWeight: 700, background: '#f0fdf4', color: '#15803d', cursor: 'pointer', border: '2px dashed #86efac', borderRadius: 10, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#dcfce7')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f0fdf4')}>
                  + Добави разфасовка
                </button>
              </>
            )}

            {!editing.id && (
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#0369a1' }}>
                💡 Запази продукта първо, след което ще можеш да добавяш разфасовки (5л, 20л...).
              </div>
            )}

          </div>

          {/* ── Save / Cancel ── */}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, position: 'sticky', bottom: 0, background: '#fff', paddingTop: 14, borderTop: '1px solid #e5e7eb' }}>
            <button onClick={() => { setEditing(null); setEditVars([]) }}
              style={{ flex: 1, padding: '11px', border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#374151' }}>
              Отказ
            </button>
            <button onClick={save} disabled={saving}
              style={{ flex: 2, padding: '11px', background: saving ? '#9ca3af' : '#1b4332', color: '#fff', border: 'none', borderRadius: 10, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, transition: 'background .2s' }}>
              {saving ? '⏳ Запазва...' : '✓ Запази всичко'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
