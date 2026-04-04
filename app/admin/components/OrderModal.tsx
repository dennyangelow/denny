'use client'
// app/admin/components/OrderModal.tsx — v6 с правилна offer detection по notes маркери

import { useState, useEffect, useRef } from 'react'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS, PAYMENT_LABELS, PAYMENT_STATUS_LABELS, COURIER_LABELS } from '@/lib/constants'
import { useCurrency } from './CurrencyContext'
import { toast } from '@/components/ui/Toast'

interface Props {
  order: Order
  onClose: () => void
  onStatusChange:  (id: string, status: string) => Promise<void>
  onPaymentChange: (id: string, ps: string) => Promise<void>
}

// ─── Status timeline ──────────────────────────────────────────────────────────
const STATUS_FLOW = ['new', 'processing', 'shipped', 'delivered']

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const isCancelled = currentStatus === 'cancelled'
  const currentIdx  = STATUS_FLOW.indexOf(currentStatus)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16, padding: '16px 0', overflowX: 'auto' }}>
      {STATUS_FLOW.map((s, i) => {
        const cfg    = STATUS_LABELS[s]
        const done   = !isCancelled && i <= currentIdx
        const active = s === currentStatus && !isCancelled
        const isLast = i === STATUS_FLOW.length - 1
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 'none' : 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: done ? (cfg?.color || '#16a34a') : '#f3f4f6',
                border: `2px solid ${done ? (cfg?.color || '#16a34a') : '#e5e7eb'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, transition: 'all .3s',
                boxShadow: active ? `0 0 0 4px ${cfg?.color || '#16a34a'}22` : 'none',
              }}>
                {done ? (active ? '●' : '✓') : '○'}
              </div>
              <span style={{ fontSize: 10, fontWeight: done ? 700 : 400, color: done ? (cfg?.color || '#16a34a') : '#9ca3af', whiteSpace: 'nowrap' }}>
                {cfg?.label || s}
              </span>
            </div>
            {!isLast && (
              <div style={{ flex: 1, height: 2, background: !isCancelled && i < currentIdx ? '#16a34a' : '#e5e7eb', margin: '0 4px', marginBottom: 20, transition: 'background .3s' }} />
            )}
          </div>
        )
      })}
      {isCancelled && (
        <div style={{ marginLeft: 'auto', padding: '4px 12px', background: '#fee2e2', borderRadius: 99, fontSize: 12, fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>
          ❌ Отказана
        </div>
      )}
    </div>
  )
}

// ─── ЦЕНТРАЛИЗИРАНА OFFER DETECTION (same as OrdersTab) ──────────────────────
type OfferType = 'post_purchase' | 'cart_upsell' | 'cross_sell' | null

function getOfferType(order: Order): OfferType {
  const notes = order.customer_notes || ''
  // Primary: notes markers (set by checkout)
  if (notes.includes('[POST-PURCHASE UPSELL]')) return 'post_purchase'
  if (notes.includes('[CART-UPSELL]'))          return 'cart_upsell'
  if (notes.includes('[CROSS-SELL]'))           return 'cross_sell'
  if (notes.includes('[HAS-OFFER]'))            return 'cart_upsell'

  // Fallback: product_name patterns
  const items = order.order_items || []
  const hasUpsellName  = items.some(i => (i.product_name || '').toLowerCase().includes('upsell'))
  const hasCrossName   = items.some(i => (i.product_name || '').toLowerCase().includes('cross'))
  const hasDiscount    = items.some(i => /\(-\d+%\)/.test(i.product_name || ''))
  if (hasUpsellName) return 'cart_upsell'
  if (hasCrossName)  return 'cross_sell'
  if (hasDiscount)   return 'cross_sell'
  return null
}

// Offer item detection (individual items within order)
function isOfferItem(name: string): boolean {
  return !!(
    name?.includes('(-') ||
    name?.toLowerCase().includes('upsell') ||
    name?.toLowerCase().includes('cross')
  )
}

const OFFER_META = {
  post_purchase: {
    label: '⚡ Post-purchase оферта',
    sublabel: 'Клиентът е приел post-purchase оферта след финализиране на поръчката.',
    icon: '⚡', color: '#dc2626', bg: '#fff1f2', border: '#fecaca',
  },
  cart_upsell: {
    label: '⬆️ Cart Upsell оферта',
    sublabel: 'Клиентът е добавил upgrade продукт от cart upsell оферта.',
    icon: '⬆️', color: '#7c3aed', bg: '#f5f3ff', border: '#ede9fe',
  },
  cross_sell: {
    label: '🔀 Cross-sell оферта',
    sublabel: 'Клиентът е добавил допълващ продукт от cross-sell оферта.',
    icon: '🔀', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe',
  },
}

export function OrderModal({ order, onClose, onStatusChange, onPaymentChange }: Props) {
  const { fmt: formatPrice } = useCurrency()
  const [savingStatus,   setSavingStatus]   = useState(false)
  const [savingPayment,  setSavingPayment]  = useState(false)
  const [savingTracking, setSavingTracking] = useState(false)
  const [trackingInput,  setTrackingInput]  = useState(order.tracking_number || '')
  const [activeTab,      setActiveTab]      = useState<'details' | 'status' | 'offer'>('details')
  const backdropRef = useRef<HTMLDivElement>(null)

  // Offer detection
  const offerType  = getOfferType(order)
  const offerM     = offerType ? OFFER_META[offerType] : null
  const isPostPurch = offerType === 'post_purchase'

  // Items marked as offer items (by product name patterns)
  const offerItems = (order.order_items || []).filter(i => isOfferItem(i.product_name))
  const hasOffer   = offerType !== null

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
        h1{font-size:20px;margin-bottom:4px}
        .meta{color:#6b7280;font-size:13px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th{background:#f9fafb;padding:8px 12px;text-align:left;font-size:12px;border-bottom:2px solid #e5e7eb}
        td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px}
        .total{font-size:16px;font-weight:900;color:#16a34a}
        .section{margin-bottom:20px}
        .label{font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;margin-bottom:4px}
        .value{font-size:14px;font-weight:600}
        @media print{button{display:none}}
      </style></head><body>
      <button onclick="window.print()" style="margin-bottom:20px;padding:8px 16px;cursor:pointer">🖨 Принтирай</button>
      <h1>Поръчка ${order.order_number}</h1>
      <div class="meta">${new Date(order.created_at).toLocaleString('bg-BG')} · ${STATUS_LABELS[order.status]?.label || order.status}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="section">
        <div><div class="label">Клиент</div><div class="value">${order.customer_name}</div></div>
        <div><div class="label">Телефон</div><div class="value">${order.customer_phone}</div></div>
        <div><div class="label">Адрес</div><div class="value">${order.customer_address}, ${order.customer_city}</div></div>
        <div><div class="label">Плащане</div><div class="value">${PAYMENT_LABELS[order.payment_method] || order.payment_method}</div></div>
        ${order.tracking_number ? `<div><div class="label">Номер за проследяване</div><div class="value">${order.tracking_number}</div></div>` : ''}
      </div>
      <table>
        <thead><tr><th>Продукт</th><th>Бр.</th><th style="text-align:right">Цена</th></tr></thead>
        <tbody>
          ${(order.order_items || []).map(item => `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td style="text-align:right">${formatPrice(item.total_price)}</td></tr>`).join('')}
          <tr><td colspan="2" style="color:#6b7280;font-size:12px">Доставка</td><td style="text-align:right;color:#6b7280">${formatPrice(order.shipping)}</td></tr>
          <tr><td colspan="2" style="font-weight:800;font-size:15px">Общо</td><td style="text-align:right" class="total">${formatPrice(order.total)}</td></tr>
        </tbody>
      </table>
      ${order.customer_notes ? `<div style="margin-top:20px;padding:12px;background:#fffbeb;border-radius:8px"><div class="label">Бележки</div><div>${order.customer_notes}</div></div>` : ''}
      </body></html>
    `)
    win.document.close()
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(`${order.customer_name}\n${order.customer_phone}\n${order.customer_address}, ${order.customer_city}`)
    toast.info('Адресът е копиран')
  }

  const callPhone = () => { window.location.href = `tel:${order.customer_phone}` }

  const s  = STATUS_LABELS[order.status] || { bg: '#f3f4f6', color: '#111', label: order.status }
  const ps = PAYMENT_STATUS_LABELS[order.payment_status] || { bg: '#f3f4f6', color: '#111', label: order.payment_status }
  const courierLabel = order.courier ? (COURIER_LABELS[order.courier]?.label || order.courier) : 'Еконт'

  return (
    <>
      <style>{`
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);animation:fadeIn .2s ease}
        .modal-box{background:#fff;border-radius:20px;width:100%;max-width:680px;max-height:92vh;overflow-y:auto;box-shadow:0 32px 80px rgba(0,0,0,.3);animation:slideUp .25s cubic-bezier(.34,1.56,.64,1)}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        .modal-close{width:32px;height:32px;border:none;background:#f5f5f5;border-radius:8px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;color:#6b7280;transition:all .15s;flex-shrink:0}
        .modal-close:hover{background:#fee2e2;color:#991b1b}
        .tab-btn{padding:8px 16px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;color:#9ca3af;border-bottom:2px solid transparent;transition:all .15s}
        .tab-btn.active{color:#1b4332;border-bottom-color:#1b4332}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        @media(max-width:480px){.info-grid{grid-template-columns:1fr}}
        .info-item{background:#f9fafb;border-radius:10px;padding:12px 14px}
        .info-label{font-size:11px;color:#9ca3af;margin-bottom:3px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}
        .info-value{font-size:13.5px;color:#111;font-weight:600}
        .status-btn{padding:6px 14px;border-radius:99px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid transparent;transition:all .15s;font-family:inherit}
        .status-btn:disabled{opacity:.5;cursor:default}
        .status-btn.active{box-shadow:0 0 0 2px #111}
        .items-table{width:100%;border-collapse:collapse;font-size:13px}
        .items-table th{padding:8px 10px;text-align:left;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;border-bottom:1px solid #f0f0f0}
        .items-table td{padding:10px;border-bottom:1px solid #f5f5f5;color:#374151}
        .action-btn{padding:8px 14px;border-radius:9px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;border:1px solid;display:inline-flex;align-items:center;gap:6px}
        .action-btn:hover{opacity:.85;transform:translateY(-1px)}
      `}</style>

      <div className="modal-backdrop" ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose() }}>
        <div className="modal-box">
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '20px 20px 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace', marginBottom: 3 }}>{order.order_number}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#111', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {order.customer_name}
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>{formatPrice(order.total)}</span>
                  <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>
                  {offerM && (
                    <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: offerM.bg, color: offerM.color, border: `1px solid ${offerM.border}` }}>
                      {offerM.label.split(' ').slice(0, 2).join(' ')}
                    </span>
                  )}
                  {(order as any).invoice?.type && (order as any).invoice.type !== 'none' && (
                    <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: '#faf5ff', color: '#6d28d9', border: '1px solid #ede9fe' }}>
                      🧾 Фактура
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="action-btn" onClick={handlePrint}
                  style={{ background: '#f9fafb', color: '#374151', borderColor: '#e5e7eb' }}>🖨</button>
                <button className="action-btn" onClick={callPhone}
                  style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>📞</button>
                <button className="action-btn" onClick={copyAddress}
                  style={{ background: '#f0f9ff', color: '#0ea5e9', borderColor: '#bae6fd' }}>📋 Адрес</button>
                <button className="modal-close" onClick={onClose}>✕</button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginTop: 14, borderBottom: '1px solid #f0f0f0', marginBottom: -1 }}>
              <button className={`tab-btn${activeTab === 'details' ? ' active' : ''}`} onClick={() => setActiveTab('details')}>
                📋 Детайли
              </button>
              <button className={`tab-btn${activeTab === 'status' ? ' active' : ''}`} onClick={() => setActiveTab('status')}>
                🔄 Смени статус
              </button>
              <button className={`tab-btn${activeTab === 'offer' ? ' active' : ''}`} onClick={() => setActiveTab('offer')}
                style={{ position: 'relative' }}>
                📣 Оферта
                {hasOffer && (
                  <span style={{ marginLeft: 5, background: offerM?.color || '#7c3aed', color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 800, padding: '1px 5px', verticalAlign: 'middle' }}>
                    ✓
                  </span>
                )}
              </button>
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {/* ── Details tab ───────────────────────────────────────── */}
            {activeTab === 'details' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Timeline</div>
                  <StatusTimeline currentStatus={order.status} />
                </div>

                {/* Tracking */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                    Номер за проследяване ({courierLabel})
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={trackingInput} onChange={e => setTrackingInput(e.target.value)}
                      placeholder={`${courierLabel} номер...`}
                      style={{ flex: 1, padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontFamily: 'monospace', fontSize: 13, outline: 'none', background: '#fff', color: '#111' }}
                      onFocus={e => e.target.style.borderColor = '#2d6a4f'}
                      onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                    <button onClick={handleTracking} disabled={savingTracking}
                      style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 16px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, opacity: savingTracking ? .6 : 1, whiteSpace: 'nowrap' }}>
                      {savingTracking ? '⏳' : '💾 Запази'}
                    </button>
                  </div>
                </div>

                {/* Customer info */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Клиент</div>
                  <div className="info-grid">
                    <div className="info-item">
                      <div className="info-label">Имена</div>
                      <div className="info-value">{order.customer_name}</div>
                    </div>
                    <div className="info-item" onClick={() => { navigator.clipboard.writeText(order.customer_phone); toast.info('Копиран') }} style={{ cursor: 'pointer' }}>
                      <div className="info-label">Телефон 📋</div>
                      <div className="info-value" style={{ color: '#2d6a4f' }}>{order.customer_phone}</div>
                    </div>
                    {order.customer_email && (
                      <div className="info-item">
                        <div className="info-label">Имейл</div>
                        <div className="info-value" style={{ fontSize: 12 }}>{order.customer_email}</div>
                      </div>
                    )}
                    <div className="info-item">
                      <div className="info-label">Адрес</div>
                      <div className="info-value" style={{ fontSize: 12 }}>{order.customer_address}, {order.customer_city}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Плащане</div>
                      <div className="info-value">{PAYMENT_LABELS[order.payment_method] || order.payment_method} · {courierLabel}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Дата</div>
                      <div className="info-value">{new Date(order.created_at).toLocaleString('bg-BG')}</div>
                    </div>
                    {order.customer_notes && (
                      <div className="info-item" style={{ gridColumn: '1/-1', background: '#fffbeb', border: '1px solid #fde68a' }}>
                        <div className="info-label">Бележки</div>
                        <div className="info-value" style={{ color: '#92400e' }}>{order.customer_notes}</div>
                      </div>
                    )}
                    {(order as any).invoice && (order as any).invoice.type !== 'none' && (() => {
                      const inv = (order as any).invoice
                      const isCompany = inv.type === 'company'
                      return (
                        <div className="info-item" style={{ gridColumn: '1/-1', background: 'linear-gradient(135deg,#faf5ff,#f3e8ff)', border: '1.5px solid #c4b5fd', borderRadius: 12, padding: 0, overflow: 'hidden' }}>
                          {/* Header */}
                          <div style={{ padding: '8px 14px', background: '#7c3aed', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14 }}>🧾</span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                              Фактура — {isCompany ? 'Фирма' : 'Физическо лице'}
                            </span>
                          </div>
                          {/* Body */}
                          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {isCompany ? (
                              <>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#3b0764' }}>{inv.company_name}</div>
                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 2 }}>
                                  <div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '.05em' }}>ЕИК </span>
                                    <span style={{ fontSize: 12.5, fontFamily: 'monospace', color: '#1e1b4b', fontWeight: 700 }}>{inv.company_eik}</span>
                                  </div>
                                  {inv.company_mol && (
                                    <div>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '.05em' }}>МОЛ </span>
                                      <span style={{ fontSize: 12.5, color: '#1e1b4b' }}>{inv.company_mol}</span>
                                    </div>
                                  )}
                                </div>
                                {inv.company_address && (
                                  <div style={{ fontSize: 12, color: '#5b21b6' }}>📍 {inv.company_address}</div>
                                )}
                                {/* ДДС */}
                                <div style={{ marginTop: 4, padding: '5px 10px', borderRadius: 7, display: 'inline-flex', alignItems: 'center', gap: 6, background: inv.company_vat_registered ? '#f0fdf4' : '#fef2f2', border: `1px solid ${inv.company_vat_registered ? '#bbf7d0' : '#fecaca'}`, alignSelf: 'flex-start' }}>
                                  <span style={{ fontSize: 12 }}>{inv.company_vat_registered ? '✅' : '❌'}</span>
                                  <span style={{ fontSize: 11.5, fontWeight: 700, color: inv.company_vat_registered ? '#15803d' : '#dc2626' }}>
                                    {inv.company_vat_registered ? 'ДДС регистрирана' : 'Без ДДС регистрация'}
                                  </span>
                                  {inv.company_vat_registered && inv.company_vat_number && (
                                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#166534', background: '#dcfce7', padding: '1px 6px', borderRadius: 4 }}>
                                      {inv.company_vat_number}
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#3b0764' }}>{inv.person_names}</div>
                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 2 }}>
                                  <div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '.05em' }}>ЕГН </span>
                                    <span style={{ fontSize: 12.5, fontFamily: 'monospace', color: '#1e1b4b', fontWeight: 700 }}>{inv.person_egn}</span>
                                  </div>
                                  {inv.person_phone && (
                                    <div>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '.05em' }}>ТЕЛ </span>
                                      <span style={{ fontSize: 12.5, color: '#1e1b4b' }}>{inv.person_phone}</span>
                                    </div>
                                  )}
                                </div>
                                {inv.person_address && (
                                  <div style={{ fontSize: 12, color: '#5b21b6' }}>📍 {inv.person_address}</div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                    {(order.utm_source || order.utm_campaign) && (
                      <div className="info-item">
                        <div className="info-label">UTM</div>
                        <div className="info-value" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                          {[order.utm_source, order.utm_campaign].filter(Boolean).join(' / ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment status */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Статус плащане</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([key, cfg]) => (
                      <button key={key}
                        disabled={savingPayment}
                        onClick={() => handlePayment(key)}
                        className={`status-btn ${order.payment_status === key ? 'active' : ''}`}
                        style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.color + '44' }}>
                        {cfg.label}
                        {order.payment_status === key && ' ✓'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items */}
                {order.order_items && order.order_items.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Артикули</div>
                    <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, overflow: 'hidden' }}>
                      <table className="items-table">
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            <th>Продукт</th>
                            <th style={{ textAlign: 'center' }}>Бр.</th>
                            <th style={{ textAlign: 'right' }}>Цена</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.order_items.map(item => {
                            const isOffer = isOfferItem(item.product_name)
                            return (
                              <tr key={item.id} style={{ background: isOffer ? '#faf5ff' : 'transparent' }}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {item.product_name}
                                    {isOffer && (
                                      <span style={{ fontSize: 9, fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 99, padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                        ✨ оферта
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', color: '#6b7280' }}>{item.quantity}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPrice(item.total_price)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={2} style={{ padding: '10px', color: '#6b7280', fontSize: 12 }}>Доставка ({courierLabel})</td>
                            <td style={{ padding: '10px', textAlign: 'right', color: '#6b7280' }}>{formatPrice(order.shipping)}</td>
                          </tr>
                          <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                            <td colSpan={2} style={{ padding: '10px', fontWeight: 800, fontSize: 15 }}>Общо</td>
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: 900, fontSize: 16, color: '#16a34a' }}>{formatPrice(order.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Status tab ────────────────────────────────────────── */}
            {activeTab === 'status' && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Смени статус на поръчката</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(STATUS_LABELS).map(([key, cfg]) => (
                    <button key={key}
                      disabled={savingStatus || order.status === key}
                      onClick={() => handleStatus(key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                        border: `1.5px solid ${order.status === key ? cfg.color : '#e5e7eb'}`,
                        borderRadius: 12, background: order.status === key ? cfg.bg : '#fff',
                        cursor: order.status === key ? 'default' : 'pointer', fontFamily: 'inherit',
                        fontWeight: 600, fontSize: 13, color: order.status === key ? cfg.color : '#374151',
                        transition: 'all .15s', opacity: savingStatus ? .6 : 1,
                      }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                      {cfg.label}
                      {order.status === key && <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓ Текущ</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Offer tab ─────────────────────────────────────────── */}
            {activeTab === 'offer' && (
              <div>
                {!hasOffer ? (
                  <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Без оферта</div>
                    <div style={{ fontSize: 13 }}>Тази поръчка не е маркирана като оферта.</div>
                    <div style={{ marginTop: 16, fontSize: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px', textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>💡 Checkout маркери (в customer_notes):</div>
                      <code style={{ display: 'block', lineHeight: 2, color: '#374151' }}>
                        [POST-PURCHASE UPSELL] — след поръчка<br/>
                        [CART-UPSELL] — ъпсел в количката<br/>
                        [CROSS-SELL] — крос-сел в количката
                      </code>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Offer type banner */}
                    <div style={{ background: offerM!.bg, border: `1px solid ${offerM!.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 28 }}>{offerM!.icon}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: offerM!.color }}>{offerM!.label}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{offerM!.sublabel}</div>
                      </div>
                    </div>

                    {/* Notes (if post-purchase) */}
                    {isPostPurch && order.customer_notes && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Бележка от поръчката</div>
                        <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>{order.customer_notes}</div>
                      </div>
                    )}

                    {/* Offer items list (by product name detection) */}
                    {offerItems.length > 0 && (
                      <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                          Продукти от оферта ({offerItems.length})
                        </div>
                        <div style={{ border: '1px solid #ede9fe', borderRadius: 10, overflow: 'hidden' }}>
                          {offerItems.map((item, i) => (
                            <div key={item.id} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '12px 14px',
                              borderBottom: i < offerItems.length - 1 ? '1px solid #f5f0ff' : 'none',
                              background: '#faf5ff',
                            }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b' }}>{item.product_name}</div>
                                <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>× {item.quantity} бр.</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 15, fontWeight: 900, color: '#7c3aed' }}>{formatPrice(item.total_price)}</div>
                                {item.quantity > 1 && (
                                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{formatPrice(item.unit_price)} / бр.</div>
                                )}
                              </div>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f5f3ff', borderTop: '2px solid #ede9fe' }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#6d28d9' }}>Сума от оферти</span>
                            <span style={{ fontSize: 15, fontWeight: 900, color: '#6d28d9' }}>
                              {formatPrice(offerItems.reduce((s, i) => s + Number(i.total_price), 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}>ОБЩА ПОРЪЧКА</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a' }}>{formatPrice(order.total)}</div>
                      </div>
                      <div style={{ background: offerM!.bg, border: `1px solid ${offerM!.border}`, borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, color: offerM!.color, fontWeight: 700, marginBottom: 4 }}>ТИП ОФЕРТА</div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: offerM!.color }}>{offerM!.icon} {offerM!.label.split(' ').slice(1).join(' ')}</div>
                        {offerItems.length > 0 && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                            {offerItems.length} артикул{offerItems.length > 1 ? 'а' : ''} от оферта
                          </div>
                        )}
                      </div>
                    </div>
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
