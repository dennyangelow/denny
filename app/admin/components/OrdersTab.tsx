'use client'
// app/admin/components/OrdersTab.tsx — v8
// ✅ Discord статус индикатор (discord_sent колона)
// ✅ Бутон "Изпрати пропуснати в Discord" — само за admin
// ✅ Мобилен изглед — карти вместо таблица
// ✅ Подобрен десктоп дизайн

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS, PAYMENT_LABELS, COURIER_LABELS, ORDER_STATUSES, type OrderStatus } from '@/lib/constants'
import { useCurrency } from './CurrencyContext'
import { OrderModal } from './OrderModal'
import { toast } from '@/components/ui/Toast'

const PAGE_SIZE = 15

type SortField = 'date' | 'total' | 'name' | 'status'
type SortDir   = 'asc' | 'desc'

// ─── OFFER DETECTION ──────────────────────────────────────────────────────────
export type OfferType = 'post_purchase' | 'cart_upsell' | 'cross_sell'

// Връща ВСИЧКИ активни оферти за поръчката (масив)
export function getOfferTypes(o: Order & { offer_type?: string | null; has_post_purchase_upsell?: boolean }): OfferType[] {
  const notes = o.customer_notes || ''
  const found = new Set<OfferType>()

  // Post-purchase
  if (
    (o as any).has_post_purchase_upsell ||
    o.offer_type === 'post_purchase' ||
    notes.includes('[POST-PURCHASE')
  ) found.add('post_purchase')

  // Cart upsell
  if (
    o.offer_type === 'cart_upsell' ||
    notes.includes('[CART-UPSELL]') ||
    notes.includes('[HAS-OFFER]') ||
    (o.order_items || []).some(i => (i.product_name || '').toLowerCase().includes('upsell'))
  ) found.add('cart_upsell')

  // Cross-sell
  if (
    o.offer_type === 'cross_sell' ||
    notes.includes('[CROSS-SELL]') ||
    (o.order_items || []).some(i => /\(-\d+%\)/.test(i.product_name || '')) ||
    (o.order_items || []).some(i => (i.product_name || '').toLowerCase().includes('cross'))
  ) found.add('cross_sell')

  return Array.from(found)
}

// Обратна съвместимост — само първия тип
export function getOfferType(o: Order & { offer_type?: string | null; has_post_purchase_upsell?: boolean }): OfferType | null {
  const types = getOfferTypes(o)
  return types.length > 0 ? types[0] : null
}

export function hasAnyOffer(o: Order): boolean {
  return getOfferTypes(o).length > 0
}

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
  setOrders?:      React.Dispatch<React.SetStateAction<Order[]>>
}

// ─── Inline status dropdown ───────────────────────────────────────────────────
function InlineStatusSelect({ order, onStatusChange }: {
  order: Order; onStatusChange: (id: string, status: string) => Promise<void>
}) {
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
          opacity: loading ? .6 : 1, whiteSpace: 'nowrap' as const, fontFamily: 'inherit' }}>
        {loading ? '⏳' : s.label}
        <span style={{ fontSize: 8, opacity: .6 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 100, minWidth: 150, padding: 4,
        }}>
          {Object.entries(STATUS_LABELS).map(([key, cfg]) => (
            <button key={key} onClick={e => { e.stopPropagation(); change(key) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 10px', border: 'none', background: key === order.status ? cfg.bg : 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                color: cfg.color, borderRadius: 6, textAlign: 'left' as const,
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

// ─── Sort header ──────────────────────────────────────────────────────────────
function SortTh({ label, field, sort, dir, onSort }: {
  label: string; field: SortField; sort: SortField; dir: SortDir; onSort: (f: SortField) => void
}) {
  const active = sort === field
  return (
    <th onClick={() => onSort(field)} style={{
      padding: '11px 14px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700,
      color: active ? '#1b4332' : 'var(--muted)', textTransform: 'uppercase' as const,
      letterSpacing: '.05em', borderBottom: '1px solid var(--border)',
      background: '#f9fafb', whiteSpace: 'nowrap' as const, cursor: 'pointer', userSelect: 'none' as const,
    }}>
      {label} {active ? (dir === 'asc' ? '↑' : '↓') : <span style={{ opacity: .3 }}>↕</span>}
    </th>
  )
}

// ─── Discord dot indicator ────────────────────────────────────────────────────
function DiscordDot({ sent }: { sent: boolean }) {
  return (
    <span
      title={sent ? 'Discord изпратен ✅' : 'Discord НЕ изпратен ⚠️'}
      style={{
        display: 'inline-block',
        width: 8, height: 8, borderRadius: '50%',
        background: sent ? '#22c55e' : '#f59e0b',
        flexShrink: 0,
        boxShadow: sent ? '0 0 0 2px #dcfce7' : '0 0 0 2px #fef3c7',
      }}
    />
  )
}

// ─── Mobile order card ────────────────────────────────────────────────────────
function OrderCard({ o, onOpen, formatPrice }: {
  o: Order & { discord_sent?: boolean }
  onOpen: () => void
  formatPrice: (n: number) => string
}) {
  const offerTypes  = getOfferTypes(o)
  const offerType   = offerTypes[0] ?? null
  const offerM      = offerType ? OFFER_META[offerType] : null
  const s           = STATUS_LABELS[o.status]
  const hasPP       = offerTypes.includes('post_purchase')
  const discordSent = (o as any).discord_sent ?? true

  return (
    <div onClick={onOpen} style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      padding: '14px 16px', cursor: 'pointer', transition: 'box-shadow .15s',
      boxShadow: '0 1px 3px rgba(0,0,0,.04)',
    }}
    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)')}
    onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.04)')}
    >
      {/* Row 1: number + status + discord */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
            {o.order_number}
          </span>
          <DiscordDot sent={discordSent} />
        </div>
        <span style={{
          padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
          background: s.bg, color: s.color, border: `1px solid ${s.color}33`,
        }}>
          {s.label}
        </span>
      </div>

      {/* Row 2: name + phone */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{o.customer_name}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{o.customer_phone} · {o.customer_city}</div>
      </div>

      {/* Row 3: offer + total + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {offerTypes.length > 0 ? offerTypes.map(ot => {
            const m = OFFER_META[ot]
            return (
              <span key={ot} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 9.5, fontWeight: 800, padding: '2px 7px',
                borderRadius: 99, border: `1px solid ${m.border}`,
                background: m.bg, color: m.color,
              }}>
                {m.icon} {m.label}
              </span>
            )
          }) : (
            <span style={{ fontSize: 11, color: '#d1d5db' }}>без оферта</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>
            {new Date(o.created_at).toLocaleDateString('bg-BG', { day: '2-digit', month: 'short' })}
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>
            {formatPrice(o.total)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN OrdersTab ───────────────────────────────────────────────────────────
export function OrdersTab({ orders, onStatusChange, onPaymentChange, initialOrder, setOrders }: Props) {
  const { fmt: formatPrice }           = useCurrency()
  const [filter, setFilter]            = useState<OrderStatus>('all')
  const [offerFilter, setOfferFilter]  = useState<'all' | 'has_offer' | 'post_purchase' | 'cart_upsell' | 'cross_sell'>('all')
  const [discordFilter, setDiscordFilter] = useState<'all' | 'sent' | 'unsent'>('all')
  const [search, setSearch]            = useState('')
  const [page, setPage]                = useState(1)
  const [selected, setSelected]        = useState<Order | null>(null)
  const [checked, setChecked]          = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus]    = useState('')
  const [bulkLoading, setBulkLoading]  = useState(false)
  const [sort, setSort]                = useState<SortField>('date')
  const [sortDir, setSortDir]          = useState<SortDir>('desc')
  const [density, setDensity]          = useState<'comfortable' | 'compact'>('comfortable')
  const [isMobile, setIsMobile]        = useState(false)
  const [sendingMissed, setSendingMissed] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { if (initialOrder) setSelected(initialOrder) }, [initialOrder])

  const handleSort = (field: SortField) => {
    if (sort === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSort(field); setSortDir('desc') }
  }

  // ── Discord stats ──────────────────────────────────────────────────────────
  const discordStats = useMemo(() => {
    const unsent = orders.filter(o => (o as any).discord_sent === false)
    const sent   = orders.filter(o => (o as any).discord_sent === true)
    return { unsent: unsent.length, sent: sent.length }
  }, [orders])

  // ── Offer stats ────────────────────────────────────────────────────────────
  const offerStats = useMemo(() => {
    const active     = orders.filter(o => o.status !== 'cancelled')
    const postPurch  = active.filter(o => getOfferType(o) === 'post_purchase')
    const cartUpsell = active.filter(o => getOfferType(o) === 'cart_upsell')
    const crossSell  = active.filter(o => getOfferType(o) === 'cross_sell')
    const withOffer  = active.filter(o => getOfferType(o) !== null)
    const offerRevenue = withOffer.reduce((s, o) => s + Number(o.total), 0)
    const totalRevenue = active.reduce((s, o) => s + Number(o.total), 0)
    return {
      total: withOffer.length, postPurch: postPurch.length,
      cartUpsell: cartUpsell.length, crossSell: crossSell.length,
      offerRevenue,
      offerRate: active.length ? Math.round(withOffer.length / active.length * 100) : 0,
      revenueShare: totalRevenue ? Math.round(offerRevenue / totalRevenue * 100) : 0,
    }
  }, [orders])

  // ── Filtered & sorted ─────────────────────────────────────────────────────
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
      .filter(o => {
        if (discordFilter === 'sent')   return (o as any).discord_sent === true
        if (discordFilter === 'unsent') return (o as any).discord_sent === false
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
  }, [orders, filter, offerFilter, discordFilter, search, sort, sortDir])

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

  // ── Изпрати пропуснатите в Discord ────────────────────────────────────────
  const sendMissedDiscord = async () => {
    const unsent = orders.filter(o => (o as any).discord_sent === false)
    if (unsent.length === 0) { toast.success('Няма пропуснати поръчки! ✅'); return }

    setSendingMissed(true)
    let success = 0
    let failed  = 0
    const successIds: string[] = []

    for (const order of unsent) {
      try {
        // Вземаме пълните данни за поръчката
        const res = await fetch(`/api/orders/${order.id}`)
        if (!res.ok) { failed++; continue }
        const fullOrder = await res.json()

        // ✅ Новият notify route чете всичко от DB сам — подаваме само force:true
        const notifyRes = await fetch(`/api/orders/${order.id}/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
        })

        const result = await notifyRes.json().catch(() => ({}))

        if (notifyRes.ok && result.ok) {
          success++
          successIds.push(order.id)
        } else if (notifyRes.status === 503) {
          // DISCORD_WEBHOOK_URL не е настроен в Vercel
          setSendingMissed(false)
          toast.error('⚠️ DISCORD_WEBHOOK_URL не е настроен в Vercel Environment Variables!')
          return
        } else {
          console.error(`Discord грешка за поръчка ${order.id}:`, result)
          failed++
        }

      } catch { failed++ }
    }

    // ✅ Обновяваме локалния state за успешно изпратените
    if (successIds.length > 0 && setOrders) {
      setOrders((prev: Order[]) =>
        prev.map(o => successIds.includes(o.id) ? { ...o, discord_sent: true } as any : o)
      )
    }

    setSendingMissed(false)
    if (failed === 0) toast.success(`✅ Изпратени ${success} поръчки в Discord!`)
    else toast.error(`${success} изпратени, ${failed} грешки`)
  }

  const exportCSV = () => {
    const rows = [
      ['Номер','Клиент','Телефон','Адрес','Град','Куриер','Статус','Оферта','PP Upsell','Discord','Сума','Дата'],
      ...filtered.map(o => {
        const ot = getOfferType(o)
        return [
          o.order_number, o.customer_name, o.customer_phone,
          o.customer_address, o.customer_city,
          o.courier ? COURIER_LABELS[o.courier]?.label : 'Еконт',
          STATUS_LABELS[o.status]?.label,
          ot ? OFFER_META[ot].label : '—',
          (o as any).has_post_purchase_upsell ? 'Да' : '—',
          (o as any).discord_sent ? 'Да' : 'Не',
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
    <div style={{ padding: isMobile ? '16px' : '24px 28px' }}>
      <style>{`
        .order-tr { transition: background .1s; cursor: pointer }
        .order-tr:hover td { background: #f9fafb !important }
        .filter-btn { transition: all .15s; cursor: pointer; font-family: inherit }
        .offer-badge {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 9.5px; font-weight: 800; padding: 2px 7px;
          border-radius: 99px; border: 1px solid; white-space: nowrap;
        }
        .pp-badge {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 9px; font-weight: 800; padding: 1px 6px;
          border-radius: 5px; background: #fff1f2; color: #dc2626;
          border: 1px solid #fecaca; margin-left: 4px;
        }
        @media (max-width: 767px) {
          .desktop-only { display: none !important; }
        }
        @media (min-width: 768px) {
          .mobile-only { display: none !important; }
        }
      `}</style>

      {/* ── Discord alert banner ── */}
      {discordStats.unsent > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
          background: 'linear-gradient(135deg, #fff7ed, #fef3c7)',
          border: '1px solid #fde68a', borderRadius: 12,
          padding: '14px 18px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>
                {discordStats.unsent} поръчки не са изпратени в Discord
              </div>
              <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
                Клиентите са затворили страницата преди Discord-ът да е изпратен
              </div>
            </div>
          </div>
          <button
            onClick={sendMissedDiscord}
            disabled={sendingMissed}
            style={{
              background: sendingMissed ? '#d97706' : 'linear-gradient(135deg,#d97706,#b45309)',
              color: '#fff', border: 'none', borderRadius: 9,
              padding: '10px 18px', cursor: sendingMissed ? 'default' : 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 7,
              opacity: sendingMissed ? .7 : 1,
              boxShadow: '0 2px 8px rgba(180,83,9,.3)',
              whiteSpace: 'nowrap' as const,
            }}>
            {sendingMissed
              ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Изпраща се...</>
              : <>📣 Изпрати {discordStats.unsent} в Discord</>
            }
          </button>
        </div>
      )}

      {discordStats.unsent === 0 && orders.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
          fontSize: 13, color: '#065f46',
        }}>
          <span>✅</span>
          <span><strong>Всички поръчки</strong> са изпратени в Discord</span>
        </div>
      )}

      {/* ── Offer performance cards ── */}
      {offerStats.total > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: '📣 С ОФЕРТА',      value: offerStats.total,      sub: 'поръчки',            bg: 'linear-gradient(135deg,#7c3aed,#6d28d9)' },
            { label: '⚡ POST-PURCHASE', value: offerStats.postPurch,  sub: 'след поръчка',        bg: 'linear-gradient(135deg,#dc2626,#b91c1c)' },
            { label: '⬆️ ЪПСЕЛ',        value: offerStats.cartUpsell, sub: 'в количката',         bg: 'linear-gradient(135deg,#7c3aed,#5b21b6)' },
            { label: '🔀 КРОС-СЕЛ',     value: offerStats.crossSell,  sub: 'допълващ продукт',    bg: 'linear-gradient(135deg,#0369a1,#1d4ed8)' },
          ].map(card => (
            <div key={card.label} style={{ flex: '1 1 110px', minWidth: 110, background: card.bg, borderRadius: 12, padding: '12px 14px', color: '#fff' }}>
              <div style={{ fontSize: 9, opacity: .75, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.04em' }}>{card.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{card.value}</div>
              <div style={{ fontSize: 10, opacity: .65, marginTop: 2 }}>{card.sub}</div>
            </div>
          ))}
          <div style={{ flex: '1 1 110px', minWidth: 110, background: 'linear-gradient(135deg,#059669,#047857)', borderRadius: 12, padding: '12px 14px', color: '#fff' }}>
            <div style={{ fontSize: 9, opacity: .75, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.04em' }}>💶 ОТ ОФЕРТИ</div>
            <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{formatPrice(offerStats.offerRevenue)}</div>
            <div style={{ fontSize: 10, opacity: .65, marginTop: 2 }}>{offerStats.revenueShare}% от общия</div>
          </div>
          <div style={{ flex: '1 1 110px', minWidth: 110, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '.04em' }}>📊 КОНВЕРСИЯ</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>{offerStats.offerRate}%</div>
            <div style={{ marginTop: 8, background: '#e9d5ff', borderRadius: 99, height: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${offerStats.offerRate}%`, background: '#7c3aed', borderRadius: 99, transition: 'width .6s' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' as const }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Поръчки</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {filtered.length} резултата · <strong style={{ color: '#16a34a' }}>{formatPrice(totalRevenue)}</strong> приход
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
          {/* Density toggle — desktop only */}
          <div className="desktop-only" style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, gap: 2 }}>
            {(['comfortable', 'compact'] as const).map(d => (
              <button key={d} onClick={() => setDensity(d)} style={{
                padding: '5px 10px', borderRadius: 6, border: 'none', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: density === d ? '#fff' : 'transparent',
                color: density === d ? '#111' : '#9ca3af',
                boxShadow: density === d ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
              }}>
                {d === 'comfortable' ? '⬛ Комфортен' : '▪ Компактен'}
              </button>
            ))}
          </div>
          <input placeholder="🔍 Търси..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, width: isMobile ? '100%' : 260, background: '#fff', color: 'var(--text)', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#2d6a4f'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <button onClick={exportCSV} className="desktop-only" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' as const }}>
            ↓ CSV
          </button>
        </div>
      </div>

      {/* ── Status filter tabs ── */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' as const, overflowX: isMobile ? 'auto' : 'visible' }}>
        {ORDER_STATUSES.map(s => {
          const count    = orders.filter(o => s === 'all' ? true : o.status === s).length
          const cfg      = s !== 'all' ? STATUS_LABELS[s] : null
          const isActive = filter === s
          return (
            <button key={s} className="filter-btn"
              onClick={() => { setFilter(s); setPage(1); setChecked(new Set()) }}
              style={{
                padding: '6px 11px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                border: `1px solid ${isActive && cfg ? cfg.color + '55' : 'var(--border)'}`,
                background: isActive ? (cfg ? cfg.bg : '#111') : '#fff',
                color: isActive ? (cfg ? cfg.color : '#fff') : 'var(--muted)',
                display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' as const,
              }}>
              {s === 'all' ? 'Всички' : cfg?.label}
              <span style={{ background: 'rgba(0,0,0,.08)', borderRadius: 99, padding: '1px 5px', fontSize: 10 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Offer + Discord filter row ── */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 14, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginRight: 2 }}>📣</span>
        {([
          { key: 'all',           label: 'Всички',           color: '#6b7280', bg: '#f3f4f6' },
          { key: 'has_offer',     label: '✨ С оферта',       color: '#7c3aed', bg: '#f5f3ff' },
          { key: 'post_purchase', label: '⚡ Post-purchase',  color: '#dc2626', bg: '#fff1f2' },
          { key: 'cart_upsell',   label: '⬆️ Ъпсел',         color: '#7c3aed', bg: '#f5f3ff' },
          { key: 'cross_sell',    label: '🔀 Крос-сел',       color: '#1d4ed8', bg: '#eff6ff' },
        ] as const).map(opt => (
          <button key={opt.key} className="filter-btn"
            onClick={() => { setOfferFilter(opt.key); setPage(1) }}
            style={{
              padding: '4px 10px', borderRadius: 99, fontSize: 11.5, cursor: 'pointer',
              border: `1px solid ${offerFilter === opt.key ? opt.color + '55' : 'var(--border)'}`,
              background: offerFilter === opt.key ? opt.bg : '#fff',
              fontWeight: offerFilter === opt.key ? 700 : 500,
              color: offerFilter === opt.key ? opt.color : 'var(--muted)',
              whiteSpace: 'nowrap' as const,
            }}>
            {opt.label}
          </button>
        ))}

        {/* Discord filter */}
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginLeft: 8, marginRight: 2 }}>📣 Discord:</span>
        {([
          { key: 'all',    label: 'Всички' },
          { key: 'sent',   label: '🟢 Изпратени' },
          { key: 'unsent', label: '🟡 Пропуснати' },
        ] as const).map(opt => (
          <button key={opt.key} className="filter-btn"
            onClick={() => { setDiscordFilter(opt.key); setPage(1) }}
            style={{
              padding: '4px 10px', borderRadius: 99, fontSize: 11.5, cursor: 'pointer',
              border: `1px solid ${discordFilter === opt.key ? '#2d6a4f55' : 'var(--border)'}`,
              background: discordFilter === opt.key ? '#f0fdf4' : '#fff',
              fontWeight: discordFilter === opt.key ? 700 : 500,
              color: discordFilter === opt.key ? '#065f46' : 'var(--muted)',
              whiteSpace: 'nowrap' as const,
            }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Bulk bar ── */}
      {checked.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', flexWrap: 'wrap' as const }}>
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

      {/* ── MOBILE: карти ── */}
      <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {paginated.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 48, fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>Няма поръчки
          </div>
        )}
        {paginated.map(o => (
          <OrderCard key={o.id} o={o as any} onOpen={() => setSelected(o)} formatPrice={formatPrice} />
        ))}
      </div>

      {/* ── DESKTOP: таблица ── */}
      <div className="desktop-only" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 750 }}>
            <thead>
              <tr>
                <th style={{ width: 40, padding: '11px 14px', background: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={checked.size === paginated.length && paginated.length > 0} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                <SortTh label="Номер"  field="date"   sort={sort} dir={sortDir} onSort={handleSort} />
                <SortTh label="Клиент" field="name"   sort={sort} dir={sortDir} onSort={handleSort} />
                <th style={{ padding: '11px 14px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '.05em', borderBottom: '1px solid var(--border)', background: '#f9fafb', whiteSpace: 'nowrap' as const }}>Куриер</th>
                <SortTh label="Статус" field="status" sort={sort} dir={sortDir} onSort={handleSort} />
                <th style={{ padding: '11px 14px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' as const, letterSpacing: '.05em', borderBottom: '1px solid var(--border)', background: '#f9fafb', whiteSpace: 'nowrap' as const }}>📣 Оферта</th>
                <th style={{ padding: '11px 14px', textAlign: 'center' as const, fontSize: 11, fontWeight: 700, color: '#5865F2', textTransform: 'uppercase' as const, letterSpacing: '.05em', borderBottom: '1px solid var(--border)', background: '#f9fafb', whiteSpace: 'nowrap' as const }}>Discord</th>
                <SortTh label="Сума"   field="total"  sort={sort} dir={sortDir} onSort={handleSort} />
                <SortTh label="Дата"   field="date"   sort={sort} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center' as const, color: 'var(--muted)', padding: 48, fontSize: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>Няма поръчки
                </td></tr>
              )}
              {paginated.map(o => {
                const offerTypes  = getOfferTypes(o)
                const offerType   = offerTypes[0] ?? null
                const offerM      = offerType ? OFFER_META[offerType] : null
                const hasPP       = offerTypes.includes('post_purchase')
                const discordSent = (o as any).discord_sent ?? true // стари поръчки = true (вече изпратени)
                return (
                  <tr key={o.id} className="order-tr"
                    style={{ background: checked.has(o.id) ? '#f0fdf4' : hasPP ? '#fffbfb' : '' }}>
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={checked.has(o.id)} onChange={() => toggleCheck(o.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5' }} onClick={() => setSelected(o)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{o.order_number}</span>
                        {hasPP && offerType !== 'post_purchase' && (
                          <span title="Има добавен post-purchase upsell" style={{ fontSize: 12 }}>⚡</span>
                        )}
                      </div>
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
                    {/* Offer badge — показваме ВСИЧКИ оферти */}
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5' }} onClick={() => setSelected(o)}>
                      {offerTypes.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' as const }}>
                          {offerTypes.map(ot => {
                            const m = OFFER_META[ot]
                            return (
                              <span key={ot} className="offer-badge" style={{ background: m.bg, color: m.color, borderColor: m.border }}>
                                {m.icon} {m.label}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>
                      )}
                    </td>
                    {/* Discord column */}
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5', textAlign: 'center' as const }} onClick={() => setSelected(o)}>
                      <span
                        title={discordSent ? 'Изпратено в Discord ✅' : 'НЕ е изпратено в Discord ⚠️'}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 22, height: 22, borderRadius: '50%',
                          background: discordSent ? '#dcfce7' : '#fef3c7',
                          fontSize: 12,
                        }}>
                        {discordSent ? '✅' : '⚠️'}
                      </span>
                    </td>
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5', fontWeight: 700, textAlign: 'right' as const, color: '#16a34a', whiteSpace: 'nowrap' as const }} onClick={() => setSelected(o)}>
                      {formatPrice(o.total)}
                    </td>
                    <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' as const }} onClick={() => setSelected(o)}>
                      {new Date(o.created_at).toLocaleDateString('bg-BG', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, opacity: page === 1 ? .4 : 1 }}>
            ← Назад
          </button>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
