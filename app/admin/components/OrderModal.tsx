'use client'
// app/admin/components/OrderModal.tsx — v4 с евро, courier, tracking

import { useState, useEffect, useRef } from 'react'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS, PAYMENT_LABELS, PAYMENT_STATUS_LABELS, COURIER_LABELS, formatPrice } from '@/lib/constants'
import { toast } from '@/components/ui/Toast'

interface Props {
  order: Order
  onClose: () => void
  onStatusChange:  (id: string, status: string) => Promise<void>
  onPaymentChange: (id: string, ps: string) => Promise<void>
}

export function OrderModal({ order, onClose, onStatusChange, onPaymentChange }: Props) {
  const [savingStatus,  setSavingStatus]  = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [savingTracking,setSavingTracking]= useState(false)
  const [trackingInput, setTrackingInput] = useState(order.tracking_number || '')
  const backdropRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleStatus = async (status: string) => {
    setSavingStatus(true)
    try {
      await onStatusChange(order.id, status)
      toast.success(`Статус → ${STATUS_LABELS[status]?.label}`)
    } catch { toast.error('Грешка при промяна на статус') }
    finally { setSavingStatus(false) }
  }

  const handlePayment = async (ps: string) => {
    setSavingPayment(true)
    try {
      await onPaymentChange(order.id, ps)
      toast.success(`Плащане → ${PAYMENT_STATUS_LABELS[ps]?.label}`)
    } catch { toast.error('Грешка при промяна на плащане') }
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
      toast.success('Номер за проследяване запазен')
    } catch { toast.error('Грешка при запазване') }
    finally { setSavingTracking(false) }
  }

  const copyPhone = () => {
    navigator.clipboard.writeText(order.customer_phone)
    toast.info('Телефонът е копиран')
  }

  const s  = STATUS_LABELS[order.status]
  const ps = PAYMENT_STATUS_LABELS[order.payment_status]
  const courierLabel = order.courier ? COURIER_LABELS[order.courier]?.label : 'Еконт'

  return (
    <>
      <style>{`
        .modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px)}
        .modal-box{background:#fff;border-radius:20px;width:100%;max-width:660px;max-height:90vh;overflow-y:auto;box-shadow:0 32px 80px rgba(0,0,0,.35)}
        .modal-header{padding:22px 24px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:1;border-radius:20px 20px 0 0}
        .modal-close{width:32px;height:32px;border:none;background:#f5f5f5;border-radius:8px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;color:#6b7280;transition:all .15s}
        .modal-close:hover{background:#fee2e2;color:#991b1b}
        .modal-body{padding:20px 24px}
        .modal-section{margin-bottom:20px}
        .modal-section-title{font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        @media(max-width:480px){.info-grid{grid-template-columns:1fr}}
        .info-item{background:#f9fafb;border-radius:10px;padding:12px 14px}
        .info-label{font-size:11px;color:#9ca3af;margin-bottom:3px;font-weight:600}
        .info-value{font-size:13.5px;color:#111;font-weight:600}
        .status-buttons{display:flex;flex-wrap:wrap;gap:6px}
        .status-btn{padding:6px 14px;border-radius:99px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid transparent;transition:all .15s;font-family:inherit}
        .status-btn:disabled{opacity:.5;cursor:default}
        .status-btn.active{box-shadow:0 0 0 2px #111}
        .items-table{width:100%;border-collapse:collapse;font-size:13px}
        .items-table th{padding:8px 10px;text-align:left;font-size:11px;color:#9ca3af;font-weight:700;text-transform:uppercase;border-bottom:1px solid #f0f0f0}
        .items-table td{padding:10px;border-bottom:1px solid #f5f5f5;color:#374151}
        .tracking-row{display:flex;gap:8px;align-items:center}
        .tracking-input{flex:1;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:9px;font-family:inherit;font-size:13px;outline:none;transition:border-color .2s;font-family:monospace}
        .tracking-input:focus{border-color:#2d6a4f}
        .tracking-save{background:#2d6a4f;color:#fff;border:none;border-radius:9px;padding:9px 16px;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit;transition:opacity .2s;white-space:nowrap}
        .tracking-save:disabled{opacity:.5}
      `}</style>

      <div className="modal-backdrop" ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose() }}>
        <div className="modal-box">
          {/* Header */}
          <div className="modal-header">
            <div>
              <div style={{ fontSize: 13, color: '#6b7280', fontFamily: 'monospace', marginBottom: 2 }}>{order.order_number}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>
                {order.customer_name}
                <span style={{ marginLeft: 12, fontSize: 16, fontWeight: 700, color: '#16a34a' }}>
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body">
            {/* Status pills */}
            <div className="modal-section">
              <div className="modal-section-title">Текущ статус</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: s.bg, color: s.color }}>
                  {s.label}
                </span>
                <span style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: ps.bg, color: ps.color }}>
                  {ps.label}
                </span>
                <span style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: '#f3f4f6', color: '#374151' }}>
                  {PAYMENT_LABELS[order.payment_method]} · {courierLabel}
                </span>
              </div>

              <div className="modal-section-title">Смени статус на поръчката</div>
              <div className="status-buttons">
                {Object.entries(STATUS_LABELS).map(([key, cfg]) => (
                  <button
                    key={key}
                    className={`status-btn${order.status === key ? ' active' : ''}`}
                    style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.color + '44' }}
                    onClick={() => handleStatus(key)}
                    disabled={savingStatus || order.status === key}
                  >
                    {savingStatus && order.status === key ? '⏳' : cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment status */}
            <div className="modal-section">
              <div className="modal-section-title">Смени статус на плащане</div>
              <div className="status-buttons">
                {Object.entries(PAYMENT_STATUS_LABELS).map(([key, cfg]) => (
                  <button
                    key={key}
                    className={`status-btn${order.payment_status === key ? ' active' : ''}`}
                    style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.color + '44' }}
                    onClick={() => handlePayment(key)}
                    disabled={savingPayment || order.payment_status === key}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tracking */}
            <div className="modal-section">
              <div className="modal-section-title">Номер за проследяване ({courierLabel})</div>
              <div className="tracking-row">
                <input
                  className="tracking-input"
                  placeholder={`${courierLabel} номер...`}
                  value={trackingInput}
                  onChange={e => setTrackingInput(e.target.value)}
                />
                <button className="tracking-save" onClick={handleTracking} disabled={savingTracking}>
                  {savingTracking ? '⏳' : '💾 Запази'}
                </button>
              </div>
            </div>

            {/* Customer info */}
            <div className="modal-section">
              <div className="modal-section-title">Клиент</div>
              <div className="info-grid">
                <div className="info-item">
                  <div className="info-label">Имена</div>
                  <div className="info-value">{order.customer_name}</div>
                </div>
                <div className="info-item" onClick={copyPhone} style={{ cursor: 'pointer' }} title="Кликни за копиране">
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
                {order.customer_notes && (
                  <div className="info-item" style={{ gridColumn: '1/-1' }}>
                    <div className="info-label">Бележки</div>
                    <div className="info-value" style={{ color: '#6b7280' }}>{order.customer_notes}</div>
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
                <div className="info-item">
                  <div className="info-label">Дата</div>
                  <div className="info-value">{new Date(order.created_at).toLocaleString('bg-BG')}</div>
                </div>
              </div>
            </div>

            {/* Items */}
            {order.order_items && order.order_items.length > 0 && (
              <div className="modal-section">
                <div className="modal-section-title">Артикули</div>
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
                        <td colSpan={2} style={{ padding: '10px', color: '#6b7280', fontSize: 12 }}>
                          Доставка ({courierLabel})
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: '#6b7280' }}>{formatPrice(order.shipping)}</td>
                      </tr>
                      <tr style={{ borderTop: '2px solid #e5e7eb' }}>
                        <td colSpan={2} style={{ padding: '10px', fontWeight: 800, fontSize: 15 }}>Общо</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 900, fontSize: 16, color: '#16a34a' }}>
                          {formatPrice(order.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
