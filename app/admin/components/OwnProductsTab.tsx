'use client'
// app/admin/components/OwnProductsTab.tsx — v3
// ✅ ПРОМЕНИ v3:
//   - "Изчерпан" бутон директно в списъка — маркира stock=0 с едно кликване
//   - "В наличност" бутон — бързо активиране (stock=10 по подразбиране)
//   - Визуален badge "Изчерпан" в оранжево/червено в списъка
//   - Варианти: показва stock на всеки вариант + quick toggle
//   - Модалът за редакция запазва всички съществуващи функции

import { useState, useEffect, useCallback } from 'react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { toast } from '@/components/ui/Toast'

interface ProductVariant {
  id: string
  product_id: string
  label: string
  size_liters: number
  price: number
  compare_price: number
  price_per_liter: number
  stock: number
  sort_order: number
  active: boolean
}

interface OwnProduct {
  id: string
  name: string
  slug: string
  subtitle?: string
  description?: string
  badge?: string
  emoji?: string
  image_url?: string
  price?: number
  compare_price?: number
  unit?: string
  stock: number
  sort_order?: number
  active: boolean
  features?: string[]
  category?: string
  product_variants?: ProductVariant[]
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
}
const focusGreen = (e: React.FocusEvent<HTMLElement>) => ((e.target as HTMLElement).style.borderColor = '#2d6a4f')
const blurGray   = (e: React.FocusEvent<HTMLElement>) => ((e.target as HTMLElement).style.borderColor = '#e5e7eb')

// ─── Variant Stock Row ────────────────────────────────────────────────────────
function VariantStockRow({
  variant,
  onStockChange,
}: {
  variant: ProductVariant
  onStockChange: (id: string, stock: number) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [localStock, setLocalStock] = useState(variant.stock)
  const isOut = localStock === 0

  const toggle = async () => {
    setSaving(true)
    const newStock = isOut ? 10 : 0
    try {
      await onStockChange(variant.id, newStock)
      setLocalStock(newStock)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px', borderRadius: 8,
      background: isOut ? '#fff7ed' : '#f0fdf4',
      border: `1px solid ${isOut ? '#fed7aa' : '#bbf7d0'}`,
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', flex: 1 }}>
        {variant.label}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
        background: isOut ? '#fee2e2' : '#dcfce7',
        color: isOut ? '#991b1b' : '#166534',
      }}>
        {isOut ? '⛔ Изчерпан' : `✓ ${localStock} бр.`}
      </span>
      <button
        onClick={toggle}
        disabled={saving}
        style={{
          padding: '4px 10px', border: 'none', borderRadius: 6,
          cursor: saving ? 'default' : 'pointer',
          fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
          background: isOut ? '#16a34a' : '#f97316',
          color: '#fff', opacity: saving ? 0.7 : 1,
          transition: 'all .15s',
        }}
      >
        {saving ? '...' : (isOut ? '+ В наличност' : '⛔ Изчерпан')}
      </button>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function OwnProductsTab() {
  const [products, setProducts] = useState<OwnProduct[]>([])
  const [loading, setLoading]   = useState(false)
  const [editing, setEditing]   = useState<OwnProduct | null>(null)
  const [saving, setSaving]     = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [expandedVariants, setExpandedVariants] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/own-products?include_variants=true')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProducts(data.products || [])
    } catch (e: any) {
      toast.error('Грешка при зареждане: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Quick stock toggle за продукт (без варианти) ──────────────────────────
  const quickToggleStock = async (product: OwnProduct) => {
    setTogglingId(product.id)
    const isOut   = product.stock === 0
    const newStock = isOut ? 10 : 0
    try {
      const res = await fetch(`/api/own-products/${product.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stock: newStock }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setProducts(prev => prev.map(p =>
        p.id === product.id ? { ...p, stock: newStock } : p
      ))
      toast.success(isOut ? `✓ ${product.name} — върнат в наличност` : `⛔ ${product.name} — маркиран като изчерпан`)
    } catch (e: any) {
      toast.error('Грешка: ' + e.message)
    } finally {
      setTogglingId(null)
    }
  }

  // ── Quick stock toggle за вариант ─────────────────────────────────────────
  const toggleVariantStock = async (variantId: string, newStock: number) => {
    const res = await fetch(`/api/own-products/variants/${variantId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ stock: newStock }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    // Обновяваме локалния стейт
    setProducts(prev => prev.map(p => ({
      ...p,
      product_variants: p.product_variants?.map(v =>
        v.id === variantId ? { ...v, stock: newStock } : v
      ),
    })))
    toast.success(newStock === 0 ? '⛔ Вариантът е маркиран като изчерпан' : '✓ Вариантът е върнат в наличност')
  }

  // ── Save / PATCH ──────────────────────────────────────────────────────────
  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const { product_variants, ...payload } = editing as any
      const isNew = !payload.id
      const url   = isNew ? '/api/own-products' : `/api/own-products/${payload.id}`
      const res   = await fetch(url, {
        method:  isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`) }
      toast.success(isNew ? 'Продуктът е създаден!' : 'Запазено успешно!')
      setEditing(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const del = async (id: string) => {
    if (!confirm('Сигурен ли си? Действието е необратимо.')) return
    try {
      const res = await fetch(`/api/own-products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('Изтрито успешно')
      if (editing?.id === id) setEditing(null)
      load()
    } catch (e: any) {
      toast.error('Грешка: ' + e.message)
    }
  }

  const startNew = () => setEditing({
    id: '', name: '', slug: '', subtitle: '', description: '',
    badge: 'Хит', emoji: '🌿', image_url: '',
    price: 0, compare_price: 0, unit: 'л.', stock: 100,
    sort_order: 0, active: true, features: [], category: 'atlas',
  })

  const set = (key: string, val: any) =>
    setEditing(prev => prev ? { ...prev, [key]: val } : null)

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isProductOutOfStock = (p: OwnProduct) => {
    if (p.product_variants && p.product_variants.length > 0) {
      const activeVars = p.product_variants.filter(v => v.active)
      return activeVars.length > 0 ? activeVars.every(v => v.stock === 0) : p.stock === 0
    }
    return p.stock === 0
  }

  const hasVariants = (p: OwnProduct) =>
    p.product_variants && p.product_variants.length > 0

  return (
    <div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Info bar */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
        🛒 <strong>Собствени продукти</strong> — управлявай наличностите бързо с бутоните <strong>«⛔ Изчерпан»</strong> или <strong>«+ В наличност»</strong> директно в списъка, без да отваряш редактора. Продуктите с <strong>нулева наличност</strong> се показват на сайта с <strong>„Изчерпан"</strong> badge и заключен бутон.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr 440px' : '1fr', gap: 20 }}>

        {/* ── Product List ────────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {loading ? 'Зарежда...' : `${products.length} продукта`}
              {products.filter(isProductOutOfStock).length > 0 && (
                <span style={{ marginLeft: 8, color: '#dc2626', fontWeight: 700 }}>
                  · {products.filter(isProductOutOfStock).length} изчерпани
                </span>
              )}
            </span>
            <button
              onClick={startNew}
              style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}
            >
              + Добави продукт
            </button>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
                Зарежда...
              </div>
            ) : products.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                Няма продукти. Натисни «+ Добави продукт».
              </div>
            ) : products.map((product, i) => {
              const outOfStock = isProductOutOfStock(product)
              const hasVars    = hasVariants(product)
              const isExpanded = expandedVariants === product.id
              const isToggling = togglingId === product.id

              return (
                <div key={product.id}>
                  {/* Product row */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px',
                      borderBottom: (isExpanded || i < products.length - 1) ? '1px solid #f5f5f5' : 'none',
                      background: editing?.id === product.id ? '#f0fdf4'
                                : outOfStock ? '#fffbeb'
                                : '',
                      transition: 'background .1s',
                    }}
                  >
                    {/* Снимка */}
                    {product.image_url ? (
                      <img
                        src={product.image_url} alt=""
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid #e5e7eb' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 8, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        {product.emoji || '📦'}
                      </div>
                    )}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                          {product.name}
                        </span>

                        {/* Out of stock badge */}
                        {outOfStock && (
                          <span style={{
                            fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
                            background: '#fee2e2', color: '#991b1b',
                            border: '1px solid #fecaca', letterSpacing: '0.03em',
                          }}>
                            ⛔ ИЗЧЕРПАН
                          </span>
                        )}
                        {!outOfStock && (
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                            background: '#dcfce7', color: '#166534',
                          }}>
                            ✓ В наличност
                          </span>
                        )}
                        {product.active === false && (
                          <span style={{ fontSize: 11, color: '#ef4444' }}>● Неактивен</span>
                        )}
                      </div>

                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {product.price != null && (
                          <span style={{ fontWeight: 600, color: '#374151' }}>
                            {Number(product.price).toFixed(2)} €
                          </span>
                        )}
                        {!hasVars && (
                          <span>
                            Наличност: <strong style={{ color: outOfStock ? '#dc2626' : '#16a34a' }}>
                              {product.stock} бр.
                            </strong>
                          </span>
                        )}
                        {hasVars && (
                          <button
                            onClick={() => setExpandedVariants(isExpanded ? null : product.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6b7280', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}
                          >
                            {product.product_variants!.length} варианта {isExpanded ? '▲' : '▼'}
                          </button>
                        )}
                        {product.slug && (
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#d1d5db' }}>
                            {product.slug}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {/* Quick stock toggle — само ако НЕ е с варианти */}
                      {!hasVars && (
                        <button
                          onClick={() => quickToggleStock(product)}
                          disabled={isToggling}
                          style={{
                            padding: '6px 12px', border: 'none', borderRadius: 7,
                            cursor: isToggling ? 'default' : 'pointer',
                            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                            background: outOfStock ? '#16a34a' : '#f97316',
                            color: '#fff', opacity: isToggling ? 0.7 : 1,
                            transition: 'all .15s', whiteSpace: 'nowrap',
                          }}
                        >
                          {isToggling ? '⏳' : (outOfStock ? '+ В наличност' : '⛔ Изчерпан')}
                        </button>
                      )}
                      <button
                        onClick={() => setEditing({ ...product })}
                        style={{ background: editing?.id === product.id ? '#dcfce7' : '#f3f4f6', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151', fontWeight: 600 }}
                      >
                        ✏️ Редактирай
                      </button>
                      <button
                        onClick={() => del(product.id)}
                        style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#991b1b' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Expanded variants */}
                  {hasVars && isExpanded && (
                    <div style={{
                      padding: '12px 16px 12px 76px',
                      background: '#fafaf9',
                      borderBottom: i < products.length - 1 ? '1px solid #f5f5f5' : 'none',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Варианти — управление на наличности
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {product.product_variants!.map(variant => (
                          <VariantStockRow
                            key={variant.id}
                            variant={variant}
                            onStockChange={toggleVariantStock}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Edit Panel ──────────────────────────────────────────────────── */}
        {editing && (
          <div style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
            padding: 20, maxHeight: '88vh', overflowY: 'auto', position: 'sticky', top: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                {editing.id ? `✏️ ${editing.name || 'Редактирай'}` : '+ Нов продукт'}
              </h3>
              <button
                onClick={() => setEditing(null)}
                style={{ background: '#f5f5f5', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', color: '#6b7280', fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <ImageUpload
                value={editing.image_url || ''}
                onChange={url => set('image_url', url)}
                folder="products"
                label="Снимка на продукта"
                height={160}
              />

              {[
                { key: 'name',        label: 'Наименование',   type: 'text',   placeholder: 'Atlas Terra Nitro' },
                { key: 'slug',        label: 'Slug',           type: 'text',   placeholder: 'atlas-terra-nitro' },
                { key: 'subtitle',    label: 'Подзаглавие',    type: 'text',   placeholder: 'Биостимулант за вегетация' },
                { key: 'badge',       label: 'Badge',          type: 'text',   placeholder: 'Хит' },
                { key: 'emoji',       label: 'Emoji',          type: 'text',   placeholder: '🌿' },
                { key: 'category',    label: 'Категория',      type: 'text',   placeholder: 'atlas' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input
                    type="text"
                    value={(editing as any)[f.key] || ''}
                    onChange={e => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    style={{ ...inp, ...(f.key === 'slug' ? { fontFamily: 'monospace' } : {}) }}
                    onFocus={focusGreen} onBlur={blurGray}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Описание</label>
                <textarea
                  rows={3}
                  value={editing.description || ''}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Описание на продукта..."
                  style={{ ...inp, resize: 'vertical' }}
                  onFocus={focusGreen} onBlur={blurGray}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Предимства (по едно на ред)</label>
                <textarea
                  rows={4}
                  value={Array.isArray(editing.features) ? editing.features.join('\n') : ''}
                  onChange={e => set('features', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                  placeholder="Повишава добива&#10;Подобрява почвата"
                  style={{ ...inp, resize: 'vertical' }}
                  onFocus={focusGreen} onBlur={blurGray}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { key: 'price',         label: 'Цена (€)',       placeholder: '14.90' },
                  { key: 'compare_price', label: 'Стара цена (€)', placeholder: '18.00' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>{f.label}</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={(editing as any)[f.key] || ''}
                      onChange={e => set(f.key, parseFloat(e.target.value) || 0)}
                      placeholder={f.placeholder}
                      style={inp}
                      onFocus={focusGreen} onBlur={blurGray}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Мерна единица</label>
                  <input type="text" value={editing.unit || ''} onChange={e => set('unit', e.target.value)} placeholder="л." style={inp} onFocus={focusGreen} onBlur={blurGray} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Наличност (бр.)</label>
                  <input
                    type="number" min="0"
                    value={editing.stock ?? ''}
                    onChange={e => set('stock', parseInt(e.target.value) || 0)}
                    style={{ ...inp, borderColor: editing.stock === 0 ? '#f97316' : '#e5e7eb' }}
                    onFocus={focusGreen} onBlur={blurGray}
                  />
                  {editing.stock === 0 && (
                    <span style={{ fontSize: 11, color: '#f97316', marginTop: 3, display: 'block', fontWeight: 600 }}>
                      ⚠️ Продуктът ще се покаже като «Изчерпан» на сайта
                    </span>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Ред (sort)</label>
                  <input type="number" min="0" value={editing.sort_order || 0} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} style={inp} onFocus={focusGreen} onBlur={blurGray} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}>
                <input type="checkbox" checked={!!editing.active} onChange={e => set('active', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#2d6a4f' }} />
                Активен (видим на сайта)
              </label>

            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setEditing(null)}
                style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: 9, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#374151' }}
              >
                Отказ
              </button>
              <button
                onClick={save}
                disabled={saving}
                style={{ flex: 2, padding: '10px', background: saving ? '#6b7280' : '#1b4332', color: '#fff', border: 'none', borderRadius: 9, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}
              >
                {saving ? '⏳ Запазва...' : '✓ Запази'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
