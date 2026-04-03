'use client'
// app/admin/components/OrdersTab.tsx — v6 с правилна offer detection по notes маркери

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS, PAYMENT_LABELS, COURIER_LABELS, ORDER_STATUSES, type OrderStatus } from '@/lib/constants'
import { useCurrency } from './CurrencyContext'
import { OrderModal } from './OrderModal'
import { toast } from '@/components/ui/Toast'

const PAGE_SIZE = 15

type SortField = 'date' | 'total' | 'name' | 'status'
type SortDir   = 'asc' | 'desc'

// ─── ЦЕНТРАЛИЗИРАНА OFFER DETECTION ───────────────────────────────────────────
// Checkout трябва да записва маркери в customer_notes:
//   [POST-PURCHASE UPSELL]  → post-purchase оферта (нова отделна поръчка)
//   [CART-UPSELL]           → cart upsell (upgrade в количката)
//   [CROSS-SELL]            → cross-sell (допълващ продукт в количката)
//
// Fallback: ако checkout не маркира → detection по product_name

export type OfferType = 'post_purchase' | 'cart_upsell' | 'cross_sell' | null

export function getOfferType(o: Order): OfferType {
  const notes = o.customer_notes || ''
  // Primary: notes markers (set by checkout)
  if (notes.includes('[POST-PURCHASE UPSELL]')) return 'post_purchase'
  if (notes.includes('[CART-UPSELL]'))          return 'cart_upsell'
  if (notes.includes('[CROSS-SELL]'))           return 'cross_sell'
  if (notes.includes('[HAS-OFFER]'))            return 'cart_upsell'

  // Fallback: product_name patterns (legacy / manual)
  const items = o.order_items || []
  const hasDiscountMarker = items.some(i => /\(-\d+%\)/.test(i.product_name || ''))
  const hasUpsellName     = items.some(i =>
    (i.product_name || '').toLowerCase().includes('upsell')
  )
  const hasCrossName = items.some(i =>
    (i.product_name || '').toLowerCase().includes('cross')
  )
  if (hasUpsellName)     return 'cart_upsell'
  if (hasCrossName)      return 'cross_sell'
  if (hasDiscountMarker) return 'cross_sell'
  return null
}

export function hasAnyOffer(o: Order): boolean {
  return getOfferType(o) !== null
}

// ─── Offer type metadata ───────────────────────────────────────────────────────
export const OFFER_META: Record<NonNullable<OfferType>, { label: string; icon: string; color: string; bg: string; border: string }> = {
  post_purchase: { label: 'Post-purchase', icon: '⚡', color: '#dc2626', bg: '#fff1f2', border: '#fecaca' },
  cart_upsell:   { label: 'Ъпсел',         icon: '⬆️', color: '#7c3aed', bg: '#f5f3ff', border: '#ede9fe' },
  cross_sell:    { label: 'Крос-сел',       icon: '🔀', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
}

interface Props {
  orders:          Order[]
  onStatusChange:  (id: string, status: string) => Promise<void>
  onPaymentChange: (id: string, payment_status: string) => Promise<void>
  initialOrder?:   Order | null
}

// ─── Inline status dropdown ────────────────────────────────────────────────────
function InlineStatusSelect({
  order, onStatusChange,
}: { order: Order; onStatusChange: (id: string, status: string) => Promise<void> }) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const s   = STATUS_LABELS[order.status]

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const change = async (key: string) => {
    if (key === order.status) { setOpen(false); return }
    setLoading(true); setOpen(false)
    try {
      await onStatusChange(order.id, key)
      toast.success(`→ ${STATUS_LABELS[key]?.label}`)
    } catch { toast.error('Грешка') }
    finally { setLoading(false) }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open) }}
        disabled={loading}
        style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
          background: s.bg, color: s.color, border: `1px solid ${s.color}33`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          opacity: loading ? .6 : 1, whiteSpace: 'nowrap', fontFamily: 'inherit' }}
      >
        {loading ? '⏳' : s.label}
        <span style={{ fontSize: 8, opacity: .6 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 100, minWidth: 150,
          padding: 4, overflow: 'hidden',
        }}>
          {Object.entries(STATUS_LABELS).map(([key, cfg]) => (
            <button key={key} onClick={e => { e.stopPropagation(); change(key) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 10px', border: 'none', background: key === order.status ? cfg.bg : 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                color: cfg.color, borderRadius: 6, textAlign: 'left',
              }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              {cfg.label}
              {key === order.status && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sort header ───────────────────────────────────────────────────────────────
function SortTh({ label, field, sort, dir, onSort }: {
  label: string; field: SortField
  sort: SortField; dir: SortDir
  onSort: (f: SortField) => void
}) {
  const active = sort === field
  return (
    <th onClick={() => onSort(field)}
      style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: active ? '#1b4332' : 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)',
        background: '#f9fafb', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', transition: 'color .15s' }}>
      {label} {active ? (dir === 'asc' ? '↑' : '↓') : <span style={{ opacity: .3 }}>↕</span>}
    </th>
  )
}

export function OrdersTab({ orders, onStatusChange, onPaymentChange, initialOrder }: Props) {
  const { fmt: formatPrice } = useCurrency()
  const [filter, setFilter]         = useState<OrderStatus>('all')
  const [offerFilter, setOfferFilter] = useState<'all' | 'has_offer' | 'post_purchase' | 'cart_upsell' | 'cross_sell'>('all')
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)
  const [selected, setSelected]     = useState<Order | null>(null)
  const [checked, setChecked]       = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [sort, setSort]             = useState<SortField>('date')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')
  const [density, setDensity]       = useState<'comfortable' | 'compact'>('comfortable')

  useEffect(() => { if (initialOrder) setSelected(initialOrder) }, [initialOrder])

  const handleSort = (field: SortField) => {
    if (sort === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSort(field); setSortDir('desc') }
  }

  // ── Offer stats (всички поръчки, не само филтрираните) ─────────────────────
  const offerStats = useMemo(() => {
    const active     = orders.filter(o => o.status !== 'cancelled')
    const postPurch  = active.filter(o => getOfferType(o) === 'post_purchase')
    const cartUpsell = active.filter(o => getOfferType(o) === 'cart_upsell')
    const crossSell  = active.filter(o => getOfferType(o) === 'cross_sell')
    const withOffer  = active.filter(o => getOfferType(o) !== null)

    const offerRevenue = withOffer.reduce((s, o) => s + Number(o.total), 0)
    const totalRevenue = active.reduce((s, o) => s + Number(o.total), 0)

    return {
      total:       withOffer.length,
      postPurch:   postPurch.length,
      cartUpsell:  cartUpsell.length,
      crossSell:   crossSell.length,
      offerRevenue,
      offerRate:    active.length ? Math.round(withOffer.length / active.length * 100) : 0,
      revenueShare: totalRevenue ? Math.round(offerRevenue / totalRevenue * 100) : 0,
    }
  }, [orders])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let result = orders
      .filter(o => filter === 'all' || o.status === filter)
      .filter(o => {
        if (offerFilter === 'has_offer')     return getOfferType(o) !== null
        if (offerFilter === 'post_purchase') return getOfferType(o) === 'post_purchase'
        if (offerFilter === 'cart_upsell')   return getOfferType(o) === 'cart_upsell'
        if (offerFilter === 'cross_sell')    return getOfferType(o) === 'cross_sell'
        return true
      })
      .filter(o => !q ||
        o.order_number?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.includes(q) ||
        o.customer_city?.toLowerCase().includes(q)
      )

    result = [...result].sort((a, b) => {
      let diff = 0
      if (sort === 'date')   diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'total')  diff = Number(a.total) - Number(b.total)
      if (sort === 'name')   diff = a.customer_name.localeCompare(b.customer_name, 'bg')
      if (sort === 'status') diff = a.status.localeCompare(b.status)
      return sortDir === 'asc' ? diff : -diff
    })
    return result
  }, [orders, filter, offerFilter, search, sort, sortDir])

  const totalPages   = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalRevenue = filtered.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0)

  const toggleCheck = (id: string) => setChecked(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const toggleAll = () => setChecked(checked.size === paginated.length ? new Set() : new Set(paginated.map(o => o.id)))

  const applyBulk = useCallback(async () => {
    if (!bulkStatus || checked.size === 0) return
    setBulkLoading(true)
    try {
      await Promise.all([...checked].map(id => onStatusChange(id, bulkStatus)))
      toast.success(`${checked.size} поръчки → ${STATUS_LABELS[bulkStatus]?.label}`)
      setChecked(new Set()); setBulkStatus('')
    } catch { toast.error('Грешка') }
    finally { setBulkLoading(false) }
  }, [checked, bulkStatus, onStatusChange])

  const exportCSV = () => {
    const rows = [
      ['Номер','Клиент','Телефон','Имейл','Адрес','Град','Куриер','Плащане','Статус','Статус плащане','Оферта','Сума (€)','Дата'],
      ...filtered.map(o => {
        const ot = getOfferType(o)
        return [
          o.order_number, o.customer_name, o.customer_phone,
          o.customer_email || '', o.customer_address, o.customer_city,
          o.courier ? COURIER_LABELS[o.courier]?.label : 'Еконт',
          PAYMENT_LABELS[o.payment_method], STATUS_LABELS[o.status]?.label,
          o.payment_status,
          ot ? OFFER_META[ot].label : '—',
          Number(o.total).toFixed(2),
          new Date(o.created_at).toLocaleDateString('bg-BG'),
        ]
      }),
    ]
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const a    = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    toast.success(`Изтеглени ${filtered.length} поръчки`)
  }

  const rowPad = density === 'compact' ? '7px 14px' : '11px 14px'

  return (
    <div style={{ padding: '24px 28px' }}>
      <style>{`
        .order-tr{transition:background .1s;cursor:pointer}
        .order-tr:hover td{background:#f9fafb!important}
        .filter-btn{transition:all .15s;cursor:pointer;font-family:inherit}
        .offer-badge{display:inline-flex;align-items:center;gap:3px;font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:99px;border:1px solid}
      `}</style>

      {/* ── Offer performance bar ──────────────────────────────────────── */}
      {offerStats.total > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140, background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', borderRadius: 13, padding: '13px 16px', color: '#fff' }}>
            <div style={{ fontSize: 11, opacity: .7, fontWeight: 700, marginBottom: 4 }}>📣 ОФЕРТИ — ОБЩО</div>
            <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{offerStats.total}</div>
            <div style={{ fontSize: 11, opacity: .7, marginTop: 3 }}>поръчки с оферта</div>
          </div>
          <div style={{ flex: 1, minWidth: 140, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', borderRadius: 13, padding: '13px 16px', color: '#fff' }}>
            <div style={{ fontSize: 11, opacity: .7, fontWeight: 700, marginBottom: 4 }}>⚡ POST-PURCHASE</div>
            <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{offerStats.postPurch}</div>
            <div style={{ fontSize: 11, opacity: .7, marginTop: 3 }}>след поръчка</div>
          </div>
          <div style={{ flex: 1, minWidth: 140, background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', borderRadius: 13, padding: '13px 16px', color: '#fff' }}>
            <div style={{ fontSize: 11, opacity: .7, fontWeight: 700, marginBottom: 4 }}>⬆️ ЪПСЕЛ</div>
            <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{offerStats.cartUpsell}</div>
            <div style={{ fontSize: 11, opacity: .7, marginTop: 3 }}>upgrade в количката</div>
          </div>
          <div style={{ flex: 1, minWidth: 140, background: 'linear-gradient(135deg,#0369a1,#1d4ed8)', borderRadius: 13, padding: '13px 16px', color: '#fff' }}>
            <div style={{ fontSize: 11, opacity: .7, fontWeight: 700, marginBottom: 4 }}>🔀 КРОС-СЕЛ</div>
            <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{offerStats.crossSell}</div>
            <div style={{ fontSize: 11, opacity: .7, marginTop: 3 }}>допълващ продукт</div>
          </div>
          <div style={{ flex: 1, minWidth: 140, background: 'linear-gradient(135deg,#059669,#047857)', borderRadius: 13, padding: '13px 16px', color: '#fff' }}>
            <div style={{ fontSize: 11, opacity: .7, fontWeight: 700, marginBottom: 4 }}>💶 ПРИХОД ОТ ОФЕРТИ</div>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{formatPrice(offerStats.offerRevenue)}</div>
            <div style={{ fontSize: 11, opacity: .7, marginTop: 3 }}>{offerStats.revenueShare}% от общия приход</div>
          </div>
          <div style={{ flex: 1, minWidth: 140, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 13, padding: '13px 16px' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}>📊 КОНВЕРСИЯ НА ОФЕРТИ</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>{offerStats.offerRate}%</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>от поръчките</div>
            <div style={{ marginTop: 8, background: '#e9d5ff', borderRadius: 99, height: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${offerStats.offerRate}%`, background: '#7c3aed', borderRadius: 99, transition: 'width .6s ease' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Поръчки</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {filtered.length} резултата · <strong style={{ color: '#16a34a' }}>{formatPrice(totalRevenue)}</strong> приход
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, gap: 2 }}>
            {(['comfortable', 'compact'] as const).map(d => (
              <button key={d} onClick={() => setDensity(d)}
                style={{ padding: '5px 10px', borderRadius: 6, border: 'none', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                  background: density === d ? '#fff' : 'transparent',
                  color: density === d ? '#111' : '#9ca3af',
                  boxShadow: density === d ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
                {d === 'comfortable' ? '⬛ Комфортен' : '▪ Компактен'}
              </button>
            ))}
          </div>
          <input placeholder="🔍 Търси по номер, клиент, телефон..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, width: 280, background: '#fff', color: 'var(--text)', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#2d6a4f'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          <button onClick={exportCSV}
            style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>
            ↓ CSV
          </button>
        </div>
      </div>

      {/* ── Status filter tabs ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {ORDER_STATUSES.map(s => {
          const count    = orders.filter(o => s === 'all' ? true : o.status === s).length
          const cfg      = s !== 'all' ? STATUS_LABELS[s] : null
          const isActive = filter === s
          return (
            <button key={s} className="filter-btn"
              onClick={() => { setFilter(s); setPage(1); setChecked(new Set()) }}
              style={{ padding: '6px 12px', border: `1px solid ${isActive && cfg ? cfg.color + '55' : 'var(--border)'}`,
                borderRadius: 99, background: isActive ? (cfg ? cfg.bg : '#111') : '#fff',
                fontSize: 12.5, fontWeight: 500,
                color: isActive ? (cfg ? cfg.color : '#fff') : 'var(--muted)',
                display: 'flex', alignItems: 'center', gap: 5 }}>
              {s === 'all' ? 'Всички' : cfg?.label}
              <span style={{ background: 'rgba(0,0,0,.08)', borderRadius: 99, padding: '1px 6px', fontSize: 11 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Offer filter row ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginRight: 2 }}>📣 Оферти:</span>
        {([
          { key: 'all',           label: 'Всички',          color: '#6b7280', bg: '#f3f4f6' },
          { key: 'has_offer',     label: '✨ С оферта',      color: '#7c3aed', bg: '#f5f3ff' },
          { key: 'post_purchase', label: '⚡ Post-purchase', color: '#dc2626', bg: '#fff1f2' },
          { key: 'cart_upsell',   label: '⬆️ Ъпсел',        color: '#7c3aed', bg: '#f5f3ff' },
          { key: 'cross_sell',    label: '🔀 Крос-сел',      color: '#1d4ed8', bg: '#eff6ff' },
        ] as const).map(opt => (
          <button key={opt.key} className="filter-btn"
            onClick={() => { setOfferFilter(opt.key); setPage(1) }}
            style={{
              padding: '4px 11px', border: `1px solid ${offerFilter === opt.key ? opt.color + '55' : 'var(--border)'}`,
              borderRadius: 99, background: offerFilter === opt.key ? opt.bg : '#fff',
              fontSize: 12, fontWeight: offerFilter === opt.key ? 700 : 500,
              color: offerFilter === opt.key ? opt.color : 'var(--muted)',
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Bulk bar ──────────────────────────────────────────────────── */}
      {checked.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>{checked.size} избрани</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #bbf7d0', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', background: '#fff' }}>
            <option value="">— Смени статус —</option>
            {Object.entries(STATUS_LABELS).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
          </select>
          <button onClick={applyBulk} disabled={!bulkStatus || bulkLoading}
            style={{ background: '#065f46', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, opacity: (!bulkStatus || bulkLoading) ? .5 : 1 }}>
            {bulkLoading ? 'Обновява...' : '✓ Приложи'}
          </button>
          <button onClick={() => setChecked(new Set())}
            style={{ background: 'transparent', border: '1px solid #bbf7d0', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#6b7280' }}>
            Изчисти
          </button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ width: 40, padding: '11px 14px', background: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={checked.size === paginated.length && paginated.length > 0} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                <SortTh label="Номер"  field="date"   sort={sort} dir={sortDir} onSort={handleSort} />
                <SortTh label="Клиент" field="name"   sort={sort} dir={sortDir} onSort={handleSort} />
                <th style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)', background: '#f9fafb', whiteSpace: 'nowrap' }}>Куриер</th>
                <SortTh label="Статус" field="status" sort={sort} dir={sortDir} onSort={handleSort} />
                <th style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)', background: '#f9fafb', whiteSpace: 'nowrap' }}>📣 Оферта</th>
                <SortTh label="Сума"   field="total"  sort={sort} dir={sortDir} onSort={handleSort} />
                <SortTh label="Дата"   field="date"   sort={sort} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 48, fontSize: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>Няма поръчки
                </td></tr>
              )}
              {paginated.map(o => {
                const offerType = getOfferType(o)
                const offerM    = offerType ? OFFER_META[offerType] : null
                return (
                  <tr key={o.id} className="order-tr"
                    style={{ background: checked.has(o.id) ? '#f0fdf4' : offerType === 'post_purchase' ? '#fffbfb' : '' }}>
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={checked.has(o.id)} onChange={() => toggleCheck(o.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5' }} onClick={() => setSelected(o)}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{o.order_number}</span>
                    </td>
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5' }} onClick={() => setSelected(o)}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.customer_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.customer_phone}</div>
                    </td>
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5', fontSize: 12, color: '#6b7280' }} onClick={() => setSelected(o)}>
                      {o.courier ? COURIER_LABELS[o.courier]?.label : 'Еконт'}
                    </td>
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5' }} onClick={e => e.stopPropagation()}>
                      <InlineStatusSelect order={o} onStatusChange={onStatusChange} />
                    </td>
                    {/* Offer badge */}
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5' }} onClick={() => setSelected(o)}>
                      {offerM ? (
                        <span className="offer-badge" style={{
                          background: offerM.bg,
                          color: offerM.color,
                          borderColor: offerM.border,
                        }}>
                          {offerM.icon} {offerM.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5', fontWeight: 700, textAlign: 'right', color: '#16a34a', whiteSpace: 'nowrap' }} onClick={() => setSelected(o)}>
                      {formatPrice(o.total)}
                    </td>
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }} onClick={() => setSelected(o)}>
                      {new Date(o.created_at).toLocaleDateString('bg-BG', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18 }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, opacity: page === 1 ? .4 : 1 }}>
            ← Назад
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = i + 1
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
                    background: page === p ? '#1b4332' : '#fff', color: page === p ? '#fff' : 'var(--text)', fontWeight: page === p ? 700 : 400 }}>
                  {p}
                </button>
              )
            })}
          </div>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
            style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, opacity: page === totalPages ? .4 : 1 }}>
            Напред →
          </button>
        </div>
      )}

      {/* ── Checkout маркери инфо ─────────────────────────────────────── */}
      {offerStats.total === 0 && orders.length > 0 && (
        <div style={{ marginTop: 20, padding: '14px 18px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, fontSize: 12, color: '#92400e' }}>
          <strong>💡 Как checkout-ът маркира оферти в customer_notes:</strong>
          <div style={{ marginTop: 6, fontFamily: 'monospace', lineHeight: 2 }}>
            <div><code>[POST-PURCHASE UPSELL]</code> — post-purchase оферта (нова поръчка)</div>
            <div><code>[CART-UPSELL]</code> — cart upsell (upgrade в количката)</div>
            <div><code>[CROSS-SELL]</code> — cross-sell (допълващ продукт)</div>
          </div>
        </div>
      )}

      {selected && (
        <OrderModal order={selected} onClose={() => setSelected(null)}
          onStatusChange={async (id, status) => {
            await onStatusChange(id, status)
            setSelected(prev => prev ? { ...prev, status: status as Order['status'] } : null)
          }}
          onPaymentChange={async (id, ps) => {
            await onPaymentChange(id, ps)
            setSelected(prev => prev ? { ...prev, payment_status: ps as Order['payment_status'] } : null)
          }}
        />
      )}
    </div>
  )
}
