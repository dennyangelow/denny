'use client'
// app/admin/components/OrderModal.tsx — v5 с timeline, print, копиране на адрес

import { useState, useEffect, useRef, useMemo } from 'react'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS, PAYMENT_LABELS, PAYMENT_STATUS_LABELS, COURIER_LABELS, formatPrice } from '@/lib/constants'
import { toast } from '@/components/ui/Toast'

interface Props {
  order: Order
  onClose: () => void
  onStatusChange:  (id: string, status: string) => Promise<void>
  onPaymentChange: (id: string, ps: string) => Promise<void>
}

// ─── Status timeline ─────────────────────────────────────────────────────────
const STATUS_FLOW = ['new', 'processing', 'shipped', 'delivered']

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const isCancelled = currentStatus === 'cancelled'
  const currentIdx  = STATUS_FLOW.indexOf(currentStatus)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16, padding: '16px 0', overflowX: 'auto' }}>
      {STATUS_FLOW.map((s, i) => {
        const cfg     = STATUS_LABELS[s]
        const done    = !isCancelled && i <= currentIdx
        const active  = s === currentStatus && !isCancelled
        const isLast  = i === STATUS_FLOW.length - 1

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

export function OrderModal({ order, onClose, onStatusChange, onPaymentChange }: Props) {
  const [savingStatus,   setSavingStatus]   = useState(false)
  const [savingPayment,  setSavingPayment]  = useState(false)
  const [savingTracking, setSavingTracking] = useState(false)
  const [trackingInput,  setTrackingInput]  = useState(order.tracking_number || '')
  const [activeTab,      setActiveTab]      = useState<'details' | 'status'>('details')
  const backdropRef = useRef<HTMLDivElement>(null)

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

  // Сигурно взимане на стилове с резервни (fallback) стойности
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
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="action-btn" onClick={handlePrint}
                  style={{ background: '#f9fafb', color: '#374151', borderColor: '#e5e7eb' }}>
                  🖨
                </button>
                <button className="action-btn" onClick={callPhone}
                  style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>
                  📞
                </button>
                <button className="action-btn" onClick={copyAddress}
                  style={{ background: '#f0f9ff', color: '#0ea5e9', borderColor: '#bae6fd' }}>
                  📋 Адрес
                </button>
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
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {activeTab === 'details' && (
              <>
                {/* Status timeline */}
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
                          {order.order_items.map(item => (
                            <tr key={item.id}>
                              <td>{item.product_name}</td>
                              <td style={{ textAlign: 'center', color: '#6b7280' }}>{item.quantity}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPrice(item.total_price)}</td>
                            </tr>
                          ))}
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

            {activeTab === 'status' && (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Смени статус на поръчката</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(STATUS_LABELS).map(([key, cfg]) => (
                      <button key={key}
                        className={`status-btn${order.status === key ? ' active' : ''}`}
                        style={{ background: cfg?.bg || '#f3f4f6', color: cfg?.color || '#111', borderColor: (cfg?.color || '#e5e7eb') + '44' }}
                        onClick={() => handleStatus(key)}
                        disabled={savingStatus || order.status === key}>
                        {savingStatus && order.status === key ? '⏳' : (cfg?.label || key)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Смени статус на плащане</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([key, cfg]) => (
                      <button key={key}
                        className={`status-btn${order.payment_status === key ? ' active' : ''}`}
                        style={{ background: cfg?.bg || '#f3f4f6', color: cfg?.color || '#111', borderColor: (cfg?.color || '#e5e7eb') + '44' }}
                        onClick={() => handlePayment(key)}
                        disabled={savingPayment || order.payment_status === key}>
                        {cfg?.label || key}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}