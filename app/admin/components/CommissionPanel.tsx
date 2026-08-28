'use client'
// app/admin/components/CommissionPanel.tsx
// Вгражда се в ProductStatsSection.tsx, ПОД breakdown списъка.
//
// USAGE в ProductStatsSection.tsx:
//   import { CommissionPanel } from './CommissionPanel'
//   ...
//   <CommissionPanel filteredOrders={filteredOrders} formatPrice={formatPrice} />
//
// Приема ВЕЧЕ филтрираните по период поръчки (filteredOrders от ProductStatsSection).
// Сам изчислява revenue по 5л/20л САМО от доставените (delivered), защото само
// тогава реално има платена поръчка (COD магазин — pending поръчки не значат нищо).

import { useState, useEffect, useMemo } from 'react'

interface OrderItem {
  product_name?: string
  quantity?: number | string
  total_price?: number | string
}
interface Order {
  status: string
  order_items?: OrderItem[]
}
interface EarningsEntry {
  id: string
  source: 'atlas_terra' | 'affiliate'
  payer?: string
  amount: number
  paid_date: string
  period_start?: string
  period_end?: string
  note?: string
}

// ── Продукт+вариант, както ги връща /api/own-products?include_variants=true ──
interface RateVariant {
  id: string
  label: string
  size_liters: number
  price: number
  active: boolean
  commission_rate?: number
}
interface RateProduct {
  id: string
  name: string
  active: boolean
  product_variants?: RateVariant[]
}

// ── Списък с всички активни продукти/варианти — за въвеждане на % ──
// Data-driven: нов продукт в базата се появява тук автоматично, без промяна в кода.
function RatesEditor({ formatPrice }: { formatPrice: (n: number) => string }) {
  const [products, setProducts] = useState<RateProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [localRates, setLocalRates] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/own-products?include_variants=true')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const list: RateProduct[] = data?.products || []
        setProducts(list.filter(p => p.active))
        const rates: Record<string, string> = {}
        list.forEach(p => p.product_variants?.forEach(v => {
          rates[v.id] = String(v.commission_rate ?? 0)
        }))
        setLocalRates(rates)
      })
      .finally(() => setLoading(false))
  }, [])

  async function saveRate(variantId: string) {
    const val = Number(localRates[variantId])
    if (Number.isNaN(val)) return
    setSavingId(variantId)
    try {
      await fetch(`/api/own-products/variants/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commission_rate: val }),
      })
    } finally {
      setSavingId(null)
    }
  }

  if (loading) return <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>Зареждане...</div>
  if (products.length === 0) return <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 0' }}>Няма активни продукти</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
      {products.map(p => (
        <div key={p.id}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4 }}>{p.name}</div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
            {(p.product_variants || []).filter(v => v.active).map(v => (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', background: '#fafafa', borderRadius: 7,
              }}>
                <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{v.label}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatPrice(Number(v.price))}</span>
                <input
                  type="number" step="0.5"
                  value={localRates[v.id] ?? '0'}
                  onChange={e => setLocalRates(prev => ({ ...prev, [v.id]: e.target.value }))}
                  onBlur={() => saveRate(v.id)}
                  style={{
                    width: 55, padding: '4px 6px', borderRadius: 6,
                    border: '1px solid #d1d5db', fontSize: 12, fontFamily: 'inherit',
                    textAlign: 'right' as const,
                    color: savingId === v.id ? '#9ca3af' : '#111',
                  }}
                />
                <span style={{ fontSize: 11, color: '#6b7280' }}>%</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

interface Props {
  filteredOrders: Order[]
  formatPrice: (n: number) => string
}

export function CommissionPanel({ filteredOrders, formatPrice }: Props) {
  // matchKey ("{product.name} — {variant.label}") → commission_rate
  const [rateMap, setRateMap] = useState<Record<string, number>>({})
  const [entries, setEntries] = useState<EarningsEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showRates, setShowRates] = useState(false)
  const [loading, setLoading] = useState(true)

  // ── форма за ново плащане ──
  const [fSource, setFSource]   = useState<'atlas_terra' | 'affiliate'>('atlas_terra')
  const [fPayer, setFPayer]     = useState('')
  const [fAmount, setFAmount]   = useState('')
  const [fDate, setFDate]       = useState(new Date().toISOString().slice(0, 10))
  const [fNote, setFNote]       = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/own-products?include_variants=true').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/earnings').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([productsRes, earningsRes]) => {
      const map: Record<string, number> = {}
      const products: RateProduct[] = productsRes?.products || []
      products.forEach(p => {
        p.product_variants?.forEach(v => {
          // Точно както се записва order_items.product_name при поръчка
          map[`${p.name} — ${v.label}`] = Number(v.commission_rate) || 0
        })
      })
      setRateMap(map)
      setEntries(earningsRes?.entries || [])
      setLoading(false)
    })
  }, [])

  // ── прогнозна комисионна за периода (само delivered) ──
  const estimate = useMemo(() => {
    let total = 0
    filteredOrders
      .filter(o => o.status === 'delivered')
      .flatMap(o => o.order_items || [])
      .forEach(item => {
        const price = Number(item.total_price) || 0
        const name  = (item.product_name || '').replace(/^\[(POST-PURCHASE|UPSELL|CROSS)\]\s*/i, '').trim()
        const rate  = rateMap[name] ?? 0
        total += price * (rate / 100)
      })
    return total
  }, [filteredOrders, rateMap])

  const atlasEntries = entries.filter(e => e.source === 'atlas_terra')
  const affiliateEntries = entries.filter(e => e.source === 'affiliate')
  const atlasReceived = atlasEntries.reduce((s, e) => s + Number(e.amount), 0)
  const affiliateReceived = affiliateEntries.reduce((s, e) => s + Number(e.amount), 0)

  async function submitEntry() {
    if (!fAmount || !fDate) return
    setSaving(true)
    try {
      const res = await fetch('/api/earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: fSource, payer: fPayer || null, amount: Number(fAmount),
          paid_date: fDate, note: fNote || null,
        }),
      })
      if (res.ok) {
        const { entry } = await res.json()
        setEntries(prev => [entry, ...prev])
        setFAmount(''); setFPayer(''); setFNote(''); setShowForm(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function removeEntry(id: string) {
    if (!confirm('Изтриване на записа?')) return
    const res = await fetch(`/api/earnings?id=${id}`, { method: 'DELETE' })
    if (res.ok) setEntries(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return null

  return (
    <div style={{ borderTop: '1px solid #f3f4f6', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap' as const, gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>💰 Комисионна</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setShowRates(v => !v)}
            style={{
              padding: '5px 12px', borderRadius: 7, border: '1px solid #d1d5db',
              background: showRates ? '#f3f4f6' : '#fff', color: '#374151',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ⚙️ % по продукти
          </button>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              padding: '5px 12px', borderRadius: 7, border: '1px solid #1b4332',
              background: showForm ? '#1b4332' : '#fff', color: showForm ? '#fff' : '#1b4332',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {showForm ? '✕ Отказ' : '+ Отбележи плащане'}
          </button>
        </div>
      </div>

      {/* ── % по продукти ── */}
      {showRates && (
        <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <RatesEditor formatPrice={formatPrice} />
        </div>
      )}

      {/* ── Summary cards ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginBottom: showForm ? 12 : 0 }}>
        <div style={{ flex: '1 1 160px', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>ПРОГНОЗНА (тоз период)</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#374151' }}>{formatPrice(estimate)}</div>
          <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>по текущи % — не хваща еднократни оферти</div>
        </div>
        <div style={{ flex: '1 1 160px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, marginBottom: 2 }}>ПОЛУЧЕНО · ATLAS TERRA</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#15803d' }}>{formatPrice(atlasReceived)}</div>
          <div style={{ fontSize: 9, color: '#16a34a', marginTop: 2 }}>{atlasEntries.length} плащания общо</div>
        </div>
        <div style={{ flex: '1 1 160px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: '#0369a1', fontWeight: 600, marginBottom: 2 }}>ПОЛУЧЕНО · АФИЛИЕЙТ</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#0369a1' }}>{formatPrice(affiliateReceived)}</div>
          <div style={{ fontSize: 9, color: '#0369a1', marginTop: 2 }}>{affiliateEntries.length} плащания общо</div>
        </div>
      </div>

      {/* ── Форма ── */}
      {showForm && (
        <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, display: 'flex', flexWrap: 'wrap' as const, gap: 8, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
            Източник<br />
            <select value={fSource} onChange={e => setFSource(e.target.value as any)}
              style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontFamily: 'inherit', fontSize: 12 }}>
              <option value="atlas_terra">Atlas Terra</option>
              <option value="affiliate">Афилиейт (AgroApteki)</option>
            </select>
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
            От кого<br />
            <input value={fPayer} onChange={e => setFPayer(e.target.value)} placeholder="напр. Атлас Агро"
              style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontFamily: 'inherit', fontSize: 12, width: 140 }} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
            Сума<br />
            <input type="number" step="0.01" value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0.00"
              style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontFamily: 'inherit', fontSize: 12, width: 100 }} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
            Дата<br />
            <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontFamily: 'inherit', fontSize: 12 }} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', flex: '1 1 160px' }}>
            Бележка<br />
            <input value={fNote} onChange={e => setFNote(e.target.value)} placeholder="напр. февруари + офертата 20%"
              style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid #d1d5db', fontFamily: 'inherit', fontSize: 12, width: '100%' }} />
          </label>
          <button onClick={submitEntry} disabled={saving || !fAmount}
            style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#1b4332', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? '...' : '✓ Запази'}
          </button>
        </div>
      )}

      {/* ── История ── */}
      {entries.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
            История на плащанията ({entries.length})
          </summary>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
            {entries.map(e => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                padding: '6px 10px', background: '#fafafa', borderRadius: 7,
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                  background: e.source === 'atlas_terra' ? '#f0fdf4' : '#eff6ff',
                  color: e.source === 'atlas_terra' ? '#16a34a' : '#0369a1',
                }}>
                  {e.source === 'atlas_terra' ? 'ATLAS' : 'АФИЛИЕЙТ'}
                </span>
                <span style={{ color: '#9ca3af' }}>{e.paid_date}</span>
                {e.payer && <span style={{ color: '#6b7280' }}>· {e.payer}</span>}
                <span style={{ fontWeight: 700, marginLeft: 'auto' }}>{formatPrice(Number(e.amount))}</span>
                {e.note && <span style={{ color: '#9ca3af', fontSize: 11 }}>({e.note})</span>}
                <button onClick={() => removeEntry(e.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
