'use client'
// app/admin/components/OrderModal.tsx — v8
// ✅ Детайли таб: всички offer типове се маркират в таблицата (⚡ PP, ⬆️ Upsell, 🔀 Cross)
// ✅ Детайли таб: чист финансов breakdown (subtotal без PP + PP добавка + доставка = общо)
// ✅ Детайли таб: notes показват само реалните бележки без системните маркери
// ✅ Оферта таб: redesign — красив, компактен, ясен
// ✅ Статус таб: подобрен с описания и бързи бутони
// ✅ getOfferTypes импортиран от OrdersTab (single source of truth)

import { useState, useEffect, useRef } from 'react'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS, PAYMENT_LABELS, PAYMENT_STATUS_LABELS, COURIER_LABELS } from '@/lib/constants'
import { useCurrency } from './CurrencyContext'
import { toast } from '@/components/ui/Toast'
import { getOfferTypes, OFFER_META } from './OrdersTab'

interface Props {
  order: Order
  onClose: () => void
  onStatusChange:  (id: string, status: string) => Promise<void>
  onPaymentChange: (id: string, ps: string) => Promise<void>
}

// ─── Types ────────────────────────────────────────────────────────────────────
type OfferType     = 'post_purchase' | 'cart_upsell' | 'cross_sell'
type OfferItemType = 'post_purchase' | 'cart_upsell' | 'cross_sell'

// ─── Item-level offer detection ──────────────────────────────────────────────
function getOfferItemType(name: string): OfferItemType | null {
  if (!name) return null
  const n = name.toLowerCase()
  // Нови DB маркери: [POST-PURCHASE], [UPSELL], [CROSS]
  if (name.startsWith('[POST-PURCHASE]') || n.includes('(post-purchase')) return 'post_purchase'
  if (name.startsWith('[CROSS]'))  return 'cross_sell'
  if (name.startsWith('[UPSELL]')) return 'cart_upsell'
  // Стари patterns за обратна съвместимост
  if (/\(-\d+%\)/.test(name) || n.includes('cross-sell')) return 'cross_sell'
  if (n.includes('upsell')) return 'cart_upsell'
  return null
}

// ─── Item meta (за таблицата) ─────────────────────────────────────────────────
const ITEM_META: Record<OfferItemType, { icon: string; label: string; color: string; bg: string; border: string }> = {
  post_purchase: { icon: '⚡', label: 'Post-Purchase', color: '#dc2626', bg: '#fff8f8', border: '#fecaca' },
  cart_upsell:   { icon: '⬆️', label: 'Cart Upsell',  color: '#7c3aed', bg: '#faf8ff', border: '#ede9fe' },
  cross_sell:    { icon: '🔀', label: 'Cross-Sell',   color: '#1d4ed8', bg: '#f8faff', border: '#bfdbfe' },
}

// ─── Status flow ──────────────────────────────────────────────────────────────
const STATUS_FLOW  = ['new', 'confirmed', 'shipped', 'delivered'] as const
const STATUS_ICONS: Record<string, string> = {
  new:       '🆕',
  confirmed: '✅',
  shipped:   '🚚',
  delivered: '📦',
  cancelled: '❌',
}
const STATUS_DESC: Record<string, string> = {
  new:       'Поръчката е получена, чака обработка',
  confirmed: 'Поръчката е потвърдена с клиента',
  shipped:   'Пратката е предадена на куриера',
  delivered: 'Клиентът е получил пратката',
  cancelled: 'Поръчката е отказана',
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const isCancelled = currentStatus === 'cancelled'
  const currentIdx  = STATUS_FLOW.indexOf(currentStatus as any)

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4, overflowX: 'auto', paddingBottom: 4 }}>
      {STATUS_FLOW.map((s, i) => {
        const cfg    = STATUS_LABELS[s] || { color: '#9ca3af', label: s }
        const done   = !isCancelled && i <= currentIdx
        const active = s === currentStatus && !isCancelled
        const isLast = i === STATUS_FLOW.length - 1
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 'none' : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: done ? cfg.color : '#f3f4f6',
                border: `2px solid ${done ? cfg.color : '#e5e7eb'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, transition: 'all .3s',
                boxShadow: active ? `0 0 0 3px ${cfg.color}30` : 'none',
              }}>
                <span style={{ color: done ? '#fff' : '#9ca3af', fontSize: done ? 11 : 13 }}>
                  {done ? (active ? '●' : '✓') : '○'}
                </span>
              </div>
              <span style={{ fontSize: 10, fontWeight: done ? 700 : 400, color: done ? cfg.color : '#9ca3af', whiteSpace: 'nowrap' }}>
                {cfg.label}
              </span>
            </div>
            {!isLast && (
              <div style={{ flex: 1, height: 2, background: !isCancelled && i < currentIdx ? '#16a34a' : '#e5e7eb', margin: '0 3px', marginBottom: 18, transition: 'background .3s', minWidth: 12 }} />
            )}
          </div>
        )
      })}
      {isCancelled && (
        <div style={{ marginLeft: 12, padding: '3px 10px', background: '#fee2e2', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#dc2626', flexShrink: 0, whiteSpace: 'nowrap' }}>
          ❌ Отказана
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function OrderModal({ order, onClose, onStatusChange, onPaymentChange }: Props) {
  const { fmt: formatPrice } = useCurrency()
  const [savingStatus,   setSavingStatus]   = useState(false)
  const [savingPayment,  setSavingPayment]  = useState(false)
  const [savingTracking, setSavingTracking] = useState(false)
  const [trackingInput,  setTrackingInput]  = useState(order.tracking_number || '')
  const [activeTab,      setActiveTab]      = useState<'details' | 'status' | 'offer'>('details')
  const backdropRef = useRef<HTMLDivElement>(null)

  // Offer detection
  const offerTypes  = getOfferTypes(order)
  const hasOffer    = offerTypes.length > 0
  const isPostPurch = offerTypes.includes('post_purchase')
  const isUpsell    = offerTypes.includes('cart_upsell')
  const isCross     = offerTypes.includes('cross_sell')

  // Invoice
  const invoiceData = (order as any).invoice_data || (order as any).invoice || null
  const hasInvoice  = invoiceData && invoiceData.type && invoiceData.type !== 'none'

  // Items — разпределени по тип
  const allItems     = order.order_items || []
  const regularItems = allItems.filter(i => getOfferItemType(i.product_name) === null)
  const offerItems   = allItems.filter(i => getOfferItemType(i.product_name) !== null)
  const ppItems      = offerItems.filter(i => getOfferItemType(i.product_name) === 'post_purchase')
  const cartOfferItems = offerItems.filter(i => getOfferItemType(i.product_name) !== 'post_purchase')

  // Финансов breakdown
  const ppTotal      = ppItems.reduce((s, i) => s + Number(i.total_price), 0)
  const cartOfferTotal = cartOfferItems.reduce((s, i) => s + Number(i.total_price), 0)
  const regularTotal = regularItems.reduce((s, i) => s + Number(i.total_price), 0)
  const subtotalCalc = (order as any).subtotal ?? (regularTotal + cartOfferTotal)

  // Clean notes — без системни маркери
  const cleanNotes = (order.customer_notes || '')
    .replace(/\[POST-PURCHASE[^\]]*\]/g, '')
    .replace(/\[CART-UPSELL\]/g, '')
    .replace(/\[CROSS-SELL\]/g, '')
    .replace(/\[HAS-OFFER\]/g, '')
    .trim()

  const s  = STATUS_LABELS[order.status] || { bg: '#f3f4f6', color: '#6b7280', label: order.status }
  const courierLabel = order.courier ? (COURIER_LABELS[order.courier]?.label || order.courier) : 'Еконт'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleStatus = async (status: string) => {
    setSavingStatus(true)
    try {
      await onStatusChange(order.id, status)
      toast.success(`Статус → ${STATUS_LABELS[status]?.label || status}`)
    } catch { toast.error('Грешка') }
    finally { setSavingStatus(false) }
  }

  const handlePayment = async (ps: string) => {
    setSavingPayment(true)
    try {
      await onPaymentChange(order.id, ps)
      toast.success(`Плащане → ${PAYMENT_STATUS_LABELS[ps]?.label || ps}`)
    } catch { toast.error('Грешка') }
    finally { setSavingPayment(false) }
  }

  const handleTracking = async () => {
    setSavingTracking(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_number: trackingInput }),
      })
      if (!res.ok) throw new Error()
      toast.success('Номер запазен')
    } catch { toast.error('Грешка') }
    finally { setSavingTracking(false) }
  }

  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>Поръчка ${order.order_number}</title>
      <style>
        body{font-family:sans-serif;padding:32px;color:#111;max-width:600px;margin:0 auto}
        h1{font-size:20px;margin-bottom:4px}.meta{color:#6b7280;font-size:13px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th{background:#f9fafb;padding:8px 12px;text-align:left;font-size:12px;border-bottom:2px solid #e5e7eb}
        td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px}
        .total{font-size:16px;font-weight:900;color:#16a34a}
        .label{font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;margin-bottom:4px}
        .value{font-size:14px;font-weight:600}
        @media print{button{display:none}}
      </style></head><body>
      <button onclick="window.print()" style="margin-bottom:20px;padding:8px 16px;cursor:pointer">🖨 Принтирай</button>
      <h1>Поръчка ${order.order_number}</h1>
      <div class="meta">${new Date(order.created_at).toLocaleString('bg-BG')} · ${STATUS_LABELS[order.status]?.label || order.status}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div><div class="label">Клиент</div><div class="value">${order.customer_name}</div></div>
        <div><div class="label">Телефон</div><div class="value">${order.customer_phone}</div></div>
        <div><div class="label">Адрес</div><div class="value">${order.customer_address}, ${order.customer_city}</div></div>
        <div><div class="label">Плащане</div><div class="value">${PAYMENT_LABELS[order.payment_method] || order.payment_method}</div></div>
        ${order.tracking_number ? `<div><div class="label">Проследяване</div><div class="value">${order.tracking_number}</div></div>` : ''}
      </div>
      <table>
        <thead><tr><th>Продукт</th><th>Бр.</th><th style="text-align:right">Цена</th></tr></thead>
        <tbody>
          ${allItems.map(item => {
            const t = getOfferItemType(item.product_name)
            const cleanName = item.product_name.replace(/^\[(POST-PURCHASE|UPSELL|CROSS)\]\s*/, '')
            const badge = t ? ` [${t === 'post_purchase' ? '⚡PP' : t === 'cart_upsell' ? '⬆️Upsell' : '🔀Cross'}]` : ''
            return `<tr><td>${cleanName}${badge}</td><td>${item.quantity}</td><td style="text-align:right">${formatPrice(item.total_price)}</td></tr>`
          }).join('')}
          <tr><td colspan="2" style="color:#6b7280;font-size:12px">Доставка</td><td style="text-align:right;color:#6b7280">${formatPrice(order.shipping)}</td></tr>
          <tr><td colspan="2" style="font-weight:800;font-size:15px">Общо</td><td style="text-align:right" class="total">${formatPrice(order.total)}</td></tr>
        </tbody>
      </table>
      ${cleanNotes ? `<div style="margin-top:20px;padding:12px;background:#fffbeb;border-radius:8px"><div class="label">Бележки</div><div>${cleanNotes}</div></div>` : ''}
      </body></html>
    `)
    win.document.close()
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(`${order.customer_name}\n${order.customer_phone}\n${order.customer_address}, ${order.customer_city}`)
    toast.info('Адресът е копиран')
  }

  return (
    <>
      <style>{`
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);animation:mFadeIn .2s ease}
        .modal-box{background:#fff;border-radius:20px;width:100%;max-width:700px;max-height:94vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,.28);animation:mSlideUp .25s cubic-bezier(.34,1.56,.64,1)}
        @keyframes mFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes mSlideUp{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        .m-close{width:30px;height:30px;border:none;background:#f5f5f5;border-radius:8px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;color:#6b7280;transition:all .15s;flex-shrink:0}
        .m-close:hover{background:#fee2e2;color:#dc2626}
        .m-tab{padding:9px 15px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:#9ca3af;border-bottom:2.5px solid transparent;transition:all .15s;white-space:nowrap}
        .m-tab.active{color:#1b4332;border-bottom-color:#1b4332}
        .m-tab:hover:not(.active){color:#374151}
        .ig{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        @media(max-width:500px){.ig{grid-template-columns:1fr}}
        .ii{background:#f9fafb;border-radius:10px;padding:11px 13px}
        .il{font-size:10.5px;color:#9ca3af;margin-bottom:2px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
        .iv{font-size:13.5px;color:#111;font-weight:600}
        .it{width:100%;border-collapse:collapse;font-size:13px}
        .it th{padding:8px 10px;text-align:left;font-size:10px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #f0f0f0;background:#fafafa}
        .it td{padding:9px 10px;border-bottom:1px solid #f7f7f7;color:#374151;vertical-align:middle}
        .it tfoot td{padding:8px 10px}
        .act{padding:7px 12px;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;border:1px solid;display:inline-flex;align-items:center;gap:5px}
        .act:hover{opacity:.85;transform:translateY(-1px)}
        .sbtn{display:flex;align-items:center;gap:10;padding:11px 14px;border-radius:12px;border:1.5px solid;background:#fff;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;transition:all .15s;width:100%;text-align:left}
        .sbtn:disabled{opacity:.5;cursor:default}
        .sbtn:hover:not(:disabled){border-color:#2d6a4f!important;background:#f0fdf4!important}
        .offer-chip{display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:800;padding:1px 6px;border-radius:99px;border:1px solid;white-space:nowrap}
      `}</style>

      <div className="modal-backdrop" ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose() }}>
        <div className="modal-box">

          {/* ── HEADER ── */}
          <div style={{ padding: '18px 22px 0', position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderRadius: '20px 20px 0 0', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Order number */}
                <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginBottom: 4 }}>{order.order_number}</div>
                {/* Name + total + status badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{order.customer_name}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{formatPrice(order.total)}</span>
                  <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>
                  {/* Offer badges в header */}
                  {offerTypes.map(ot => {
                    const m = OFFER_META[ot]
                    return (
                      <span key={ot} style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 800, background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
                        {m.icon} {m.label}
                      </span>
                    )
                  })}
                  {hasInvoice && (
                    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 800, background: '#faf5ff', color: '#6d28d9', border: '1px solid #ede9fe' }}>
                      🧾 Фактура
                    </span>
                  )}
                </div>
              </div>
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button className="act" onClick={handlePrint} style={{ background: '#f9fafb', color: '#374151', borderColor: '#e5e7eb' }}>🖨</button>
                <button className="act" onClick={() => { window.location.href = `tel:${order.customer_phone}` }} style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>📞</button>
                <button className="act" onClick={copyAddress} style={{ background: '#f0f9ff', color: '#0ea5e9', borderColor: '#bae6fd' }}>📋 Адрес</button>
                <button className="m-close" onClick={onClose}>✕</button>
              </div>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
              <button className={`m-tab${activeTab === 'details' ? ' active' : ''}`} onClick={() => setActiveTab('details')}>📋 Детайли</button>
              <button className={`m-tab${activeTab === 'status'  ? ' active' : ''}`} onClick={() => setActiveTab('status')}>🔄 Статус</button>
              <button className={`m-tab${activeTab === 'offer'   ? ' active' : ''}`} onClick={() => setActiveTab('offer')} style={{ position: 'relative' }}>
                📣 Оферта
                {hasOffer && (
                  <span style={{ marginLeft: 4, background: offerTypes.length > 1 ? '#dc2626' : OFFER_META[offerTypes[0]].color, color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 800, padding: '1px 5px' }}>
                    {offerTypes.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div style={{ padding: '18px 22px 22px' }}>

            {/* ══════════════════════════════════════════════════════════
                ── ДЕТАЙЛИ ТАБ ──
            ══════════════════════════════════════════════════════════ */}
            {activeTab === 'details' && (
              <>
                {/* Timeline */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Статус на пратката</div>
                  <StatusTimeline currentStatus={order.status} />
                </div>

                {/* Tracking + Статус плащане — в 1 ред */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 18, alignItems: 'end' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 7 }}>
                      Номер за проследяване ({courierLabel})
                    </div>
                    <div style={{ display: 'flex', gap: 7 }}>
                      <input value={trackingInput} onChange={e => setTrackingInput(e.target.value)}
                        placeholder={`${courierLabel} номер...`}
                        style={{ flex: 1, padding: '8px 11px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontFamily: 'monospace', fontSize: 13, outline: 'none', color: '#111', background: '#fff', transition: 'border-color .15s' }}
                        onFocus={e => e.target.style.borderColor = '#2d6a4f'}
                        onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                      <button onClick={handleTracking} disabled={savingTracking}
                        style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, opacity: savingTracking ? .6 : 1, whiteSpace: 'nowrap' }}>
                        {savingTracking ? '⏳' : '💾 Запази'}
                      </button>
                    </div>
                  </div>
                  {/* Статус плащане */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 7 }}>Плащане</div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {Object.entries(PAYMENT_STATUS_LABELS).map(([key, cfg]) => (
                        <button key={key} disabled={savingPayment}
                          onClick={() => handlePayment(key)}
                          style={{
                            padding: '6px 11px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            border: `1.5px solid ${order.payment_status === key ? cfg.color : cfg.color + '44'}`,
                            background: order.payment_status === key ? cfg.bg : '#fff',
                            color: cfg.color, fontFamily: 'inherit', transition: 'all .15s',
                            boxShadow: order.payment_status === key ? `0 0 0 2px ${cfg.color}30` : 'none',
                          }}>
                          {cfg.label}{order.payment_status === key ? ' ✓' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Клиент инфо */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 9 }}>Клиент</div>
                  <div className="ig">
                    <div className="ii">
                      <div className="il">Имена</div>
                      <div className="iv">{order.customer_name}</div>
                    </div>
                    <div className="ii" onClick={() => { navigator.clipboard.writeText(order.customer_phone); toast.info('Копиран') }} style={{ cursor: 'pointer' }}>
                      <div className="il">Телефон 📋</div>
                      <div className="iv" style={{ color: '#2d6a4f' }}>{order.customer_phone}</div>
                    </div>
                    {order.customer_email && (
                      <div className="ii">
                        <div className="il">Имейл</div>
                        <div className="iv" style={{ fontSize: 12 }}>{order.customer_email}</div>
                      </div>
                    )}
                    <div className="ii">
                      <div className="il">Адрес за доставка</div>
                      <div className="iv" style={{ fontSize: 12 }}>{order.customer_address}, {order.customer_city}</div>
                    </div>
                    <div className="ii">
                      <div className="il">Начин на плащане</div>
                      <div className="iv">{PAYMENT_LABELS[order.payment_method] || order.payment_method} · {courierLabel}</div>
                    </div>
                    <div className="ii">
                      <div className="il">Дата и час</div>
                      <div className="iv" style={{ fontSize: 12 }}>{new Date(order.created_at).toLocaleString('bg-BG')}</div>
                    </div>
                    {/* Бележки — само реалните, без системни маркери */}
                    {cleanNotes && (
                      <div className="ii" style={{ gridColumn: '1/-1', background: '#fffbeb', border: '1px solid #fde68a' }}>
                        <div className="il">Бележки от клиента</div>
                        <div className="iv" style={{ color: '#92400e', fontSize: 13 }}>{cleanNotes}</div>
                      </div>
                    )}
                    {/* UTM */}
                    {(order.utm_source || order.utm_campaign) && (
                      <div className="ii">
                        <div className="il">UTM</div>
                        <div className="iv" style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280' }}>
                          {[order.utm_source, order.utm_campaign].filter(Boolean).join(' / ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Фактура */}
                {hasInvoice && (() => {
                  const inv = invoiceData
                  const isCompany = inv.type === 'company'
                  return (
                    <div style={{ marginBottom: 18, border: '1.5px solid #c4b5fd', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '9px 14px', background: '#7c3aed', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>🧾</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                          Фактура — {isCompany ? 'Фирма' : 'Физическо лице'}
                        </span>
                      </div>
                      <div style={{ padding: '12px 14px', background: 'linear-gradient(135deg,#faf5ff,#f3e8ff)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {isCompany ? (
                          <>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#3b0764' }}>{inv.company_name}</div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 2 }}>
                              {inv.company_eik && <span style={{ fontSize: 12, color: '#5b21b6' }}>ЕИК: <strong>{inv.company_eik}</strong></span>}
                              {inv.company_mol && <span style={{ fontSize: 12, color: '#5b21b6' }}>МОЛ: {inv.company_mol}</span>}
                            </div>
                            {inv.company_address && <div style={{ fontSize: 12, color: '#5b21b6' }}>📍 {inv.company_address}</div>}
                            <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 7, background: inv.company_vat_registered ? '#f0fdf4' : '#fef2f2', border: `1px solid ${inv.company_vat_registered ? '#bbf7d0' : '#fecaca'}`, alignSelf: 'flex-start' }}>
                              <span style={{ fontSize: 11 }}>{inv.company_vat_registered ? '✅' : '❌'}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: inv.company_vat_registered ? '#15803d' : '#dc2626' }}>
                                {inv.company_vat_registered ? 'ДДС регистрирана' : 'Без ДДС'}
                                {inv.company_vat_registered && inv.company_vat_number && ` · ${inv.company_vat_number}`}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#3b0764' }}>{inv.person_names}</div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                              {inv.person_egn && <span style={{ fontSize: 12, color: '#5b21b6' }}>ЕГН: <strong>{inv.person_egn}</strong></span>}
                              {inv.person_phone && <span style={{ fontSize: 12, color: '#5b21b6' }}>Тел: {inv.person_phone}</span>}
                            </div>
                            {inv.person_address && <div style={{ fontSize: 12, color: '#5b21b6' }}>📍 {inv.person_address}</div>}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* ── АРТИКУЛИ ── */}
                {allItems.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 9 }}>
                      Артикули ({allItems.length})
                    </div>
                    <div style={{ border: '1px solid #f0f0f0', borderRadius: 12, overflow: 'hidden' }}>
                      <table className="it">
                        <thead>
                          <tr>
                            <th>Продукт</th>
                            <th style={{ textAlign: 'center', width: 50 }}>Бр.</th>
                            <th style={{ textAlign: 'right', width: 90 }}>Цена</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allItems.map(item => {
                            const itemType = getOfferItemType(item.product_name)
                            const meta     = itemType ? ITEM_META[itemType] : null
                            const cleanName = item.product_name.replace(/^\[(POST-PURCHASE|UPSELL|CROSS)\]\s*/, '')
                            return (
                              <tr key={item.id} style={{ background: meta ? meta.bg : 'transparent' }}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ color: '#1e293b' }}>{cleanName}</span>
                                    {meta && (
                                      <span className="offer-chip" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
                                        {meta.icon} {meta.label}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', color: '#6b7280', fontWeight: 500 }}>{item.quantity}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: meta ? meta.color : '#374151' }}>
                                  {formatPrice(item.total_price)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot style={{ borderTop: '1.5px solid #e5e7eb' }}>
                          {/* Subtotal ред само ако има offer items */}
                          {offerItems.length > 0 && (
                            <tr>
                              <td colSpan={2} style={{ color: '#6b7280', fontSize: 12 }}>Продукти (без добавки)</td>
                              <td style={{ textAlign: 'right', color: '#6b7280', fontSize: 12 }}>{formatPrice(subtotalCalc)}</td>
                            </tr>
                          )}
                          {/* PP добавка */}
                          {isPostPurch && ppTotal > 0 && (
                            <tr>
                              <td colSpan={2} style={{ color: '#dc2626', fontSize: 12, fontWeight: 700 }}>⚡ Post-Purchase добавен</td>
                              <td style={{ textAlign: 'right', color: '#dc2626', fontSize: 12, fontWeight: 700 }}>+{formatPrice(ppTotal)}</td>
                            </tr>
                          )}
                          {/* Доставка */}
                          <tr>
                            <td colSpan={2} style={{ color: '#6b7280', fontSize: 12 }}>🚚 Доставка ({courierLabel})</td>
                            <td style={{ textAlign: 'right', color: order.shipping === 0 ? '#16a34a' : '#6b7280', fontSize: 12, fontWeight: order.shipping === 0 ? 700 : 400 }}>
                              {order.shipping === 0 ? 'Безплатна' : formatPrice(order.shipping)}
                            </td>
                          </tr>
                          {/* Общо */}
                          <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                            <td colSpan={2} style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>
                              Общо
                              {isPostPurch && ppTotal > 0 && (
                                <span style={{ marginLeft: 7, fontSize: 9.5, fontWeight: 800, color: '#dc2626', background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 99, padding: '1px 6px' }}>с PP ⚡</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 17, color: '#16a34a' }}>{formatPrice(order.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ══════════════════════════════════════════════════════════
                ── СТАТУС ТАБ ──
            ══════════════════════════════════════════════════════════ */}
            {activeTab === 'status' && (
              <div>
                {/* Текущ статус hero */}
                <div style={{ background: `${s.bg}`, border: `1.5px solid ${s.color}44`, borderRadius: 14, padding: '16px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 32 }}>{STATUS_ICONS[order.status] || '📋'}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Текущ статус</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{STATUS_DESC[order.status] || ''}</div>
                  </div>
                </div>

                {/* Статус бутони */}
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Смени на:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {Object.entries(STATUS_LABELS).map(([key, cfg]) => {
                    const isActive = order.status === key
                    return (
                      <button key={key}
                        disabled={savingStatus || isActive}
                        onClick={() => handleStatus(key)}
                        className="sbtn"
                        style={{
                          borderColor: isActive ? cfg.color : '#e5e7eb',
                          background: isActive ? cfg.bg : '#fff',
                          color: isActive ? cfg.color : '#374151',
                          opacity: savingStatus ? .6 : 1,
                          gap: 12,
                          padding: '11px 14px',
                        }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{STATUS_ICONS[key] || '●'}</span>
                        <div style={{ flex: 1, textAlign: 'left' as const }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: isActive ? cfg.color : '#111' }}>{cfg.label}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{STATUS_DESC[key] || ''}</div>
                        </div>
                        {isActive && (
                          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 99, border: `1px solid ${cfg.color}33`, flexShrink: 0 }}>
                            ✓ Текущ
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Tracking reminder */}
                {order.status !== 'shipped' && order.status !== 'delivered' && (
                  <div style={{ marginTop: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#166534', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>💡</span>
                    <span>След изпращане добави номера за проследяване в таба <strong>Детайли</strong>.</span>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                ── ОФЕРТА ТАБ — компактен и красив ──
            ══════════════════════════════════════════════════════════ */}
            {activeTab === 'offer' && (
              <div>
                {!hasOffer ? (
                  /* Без оферта */
                  <div style={{ textAlign: 'center', padding: '44px 20px' }}>
                    <div style={{ fontSize: 44, marginBottom: 10 }}>📭</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Без оферта</div>
                    <div style={{ fontSize: 13, color: '#9ca3af' }}>Тази поръчка е без ъпсел, крос-сел или post-purchase.</div>
                  </div>
                ) : (
                  <>
                    {/* ── Offer summary карти — компактни ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 18 }}>
                      {offerTypes.map(ot => {
                        const m = OFFER_META[ot]
                        // Намираме артикулите от този тип
                        const typeItems = ot === 'post_purchase'
                          ? ppItems
                          : ot === 'cart_upsell'
                            ? offerItems.filter(i => getOfferItemType(i.product_name) === 'cart_upsell')
                            : offerItems.filter(i => getOfferItemType(i.product_name) === 'cross_sell')
                        const typeTotal = typeItems.reduce((s, i) => s + Number(i.total_price), 0)
                        return (
                          <div key={ot} style={{ background: m.bg, border: `1.5px solid ${m.border}`, borderRadius: 14, padding: '14px 16px' }}>
                            <div style={{ fontSize: 22, marginBottom: 6 }}>{m.icon}</div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: m.color, marginBottom: 2 }}>{m.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: m.color }}>{formatPrice(typeTotal)}</div>
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                              {typeItems.length} артикул{typeItems.length !== 1 ? 'а' : ''}
                            </div>
                          </div>
                        )
                      })}
                      {/* Обща поръчка карта */}
                      <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 14, padding: '14px 16px' }}>
                        <div style={{ fontSize: 22, marginBottom: 6 }}>💶</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#166534', marginBottom: 2 }}>Общо</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a' }}>{formatPrice(order.total)}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{allItems.length} арт. общо</div>
                      </div>
                    </div>

                    {/* ── Продукти от оферти — компактна таблица ── */}
                    {offerItems.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                          Продукти от оферта
                        </div>
                        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                          {offerItems.map((item, idx) => {
                            const t = getOfferItemType(item.product_name)!
                            const m = ITEM_META[t]
                            const cleanName = item.product_name.replace(/^\[(POST-PURCHASE|UPSELL|CROSS)\]\s*/, '')
                            return (
                              <div key={item.id} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '11px 14px',
                                borderBottom: idx < offerItems.length - 1 ? `1px solid ${m.border}` : 'none',
                                background: m.bg,
                              }}>
                                <span style={{ fontSize: 18, flexShrink: 0 }}>{m.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{cleanName}</div>
                                  <div style={{ fontSize: 11, color: m.color, marginTop: 1 }}>{m.label} · ×{item.quantity}</div>
                                </div>
                                <div style={{ fontSize: 15, fontWeight: 900, color: m.color, flexShrink: 0 }}>{formatPrice(item.total_price)}</div>
                              </div>
                            )
                          })}
                          {/* Total */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb', borderTop: '1.5px solid #e5e7eb' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Сума от оферти</span>
                            <span style={{ fontSize: 14, fontWeight: 900, color: '#374151' }}>
                              {formatPrice(offerItems.reduce((s, i) => s + Number(i.total_price), 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Notes маркери (само системните) ── */}
                    {(order.customer_notes || '').match(/\[(POST-PURCHASE|CART-UPSELL|CROSS-SELL)[^\]]*\]/) && (
                      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>Системни маркери:</span>
                        {(order.customer_notes || '').includes('[POST-PURCHASE') && (
                          <span className="offer-chip" style={{ background: '#fff1f2', color: '#dc2626', borderColor: '#fecaca' }}>⚡ POST-PURCHASE</span>
                        )}
                        {(order.customer_notes || '').includes('[CART-UPSELL]') && (
                          <span className="offer-chip" style={{ background: '#faf5ff', color: '#7c3aed', borderColor: '#ede9fe' }}>⬆️ CART-UPSELL</span>
                        )}
                        {(order.customer_notes || '').includes('[CROSS-SELL]') && (
                          <span className="offer-chip" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>🔀 CROSS-SELL</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
