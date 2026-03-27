'use client'
// app/admin/components/OrderModal.tsx — v3 с tracking number, PDF бутон, пълна UX

import { useState } from 'react'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS, PAYMENT_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/constants'
import { toast } from '@/components/ui/Toast'

interface Props {
  order: Order
  onClose: () => void
  onStatusChange: (id: string, status: string) => Promise<void>
  onPaymentChange: (id: string, payment_status: string) => Promise<void>
}

export function OrderModal({ order, onClose, onStatusChange, onPaymentChange }: Props) {
  const [updating, setUpdating] = useState(false)
  const [trackingInput, setTrackingInput] = useState(order.tracking_number || '')
  const [savingTracking, setSavingTracking] = useState(false)
  const s  = STATUS_LABELS[order.status]
  const ps = PAYMENT_STATUS_LABELS[order.payment_status]

  const handleStatus = async (status: string) => {
    setUpdating(true)
    try {
      await onStatusChange(order.id, status)
      toast.success(`Статус → ${STATUS_LABELS[status]?.label}`)
    } catch { toast.error('Грешка при обновяване') }
    finally { setUpdating(false) }
  }

  const handlePayment = async (payment_status: string) => {
    setUpdating(true)
    try {
      await onPaymentChange(order.id, payment_status)
      toast.success(`Плащане → ${PAYMENT_STATUS_LABELS[payment_status]?.label}`)
    } catch { toast.error('Грешка при обновяване') }
    finally { setUpdating(false) }
  }

  const saveTracking = async () => {
    if (trackingInput === (order.tracking_number || '')) return
    setSavingTracking(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_number: trackingInput }),
      })
      if (!res.ok) throw new Error()
      toast.success('Номерът на пратката е запазен')
    } catch { toast.error('Грешка при запазване') }
    finally { setSavingTracking(false) }
  }

  const copyPhone = () => {
    navigator.clipboard.writeText(order.customer_phone)
    toast.info('Телефонът е копиран')
  }

  const copyEmail = () => {
    if (!order.customer_email) return
    navigator.clipboard.writeText(order.customer_email)
    toast.info('Имейлът е копиран')
  }

  const printOrder = () => {
    const w = window.open('', '_blank')
    if (!w) return
    const items = order.order_items?.map(i =>
      `<tr><td>${i.product_name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${Number(i.unit_price).toFixed(2)} лв.</td><td style="text-align:right">${Number(i.total_price).toFixed(2)} лв.</td></tr>`
    ).join('') || ''
    w.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Поръчка ${order.order_number}</title>
      <style>
        body{font-family:sans-serif;padding:40px;color:#111;max-width:700px;margin:0 auto}
        h1{font-size:22px;margin-bottom:4px}
        .meta{color:#6b7280;font-size:13px;margin-bottom:32px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px}
        .section h3{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:8px}
        .section p{font-size:14px;margin:4px 0}
        table{width:100%;border-collapse:collapse;margin-bottom:24px}
        th{background:#f9fafb;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb}
        td{padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:14px}
        .total{font-weight:700;border-top:2px solid #e5e7eb}
        .status{display:inline-block;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:700;background:${s.bg};color:${s.color}}
        @media print{body{padding:20px}}
      </style></head><body>
      <h1>Поръчка ${order.order_number}</h1>
      <p class="meta">${new Date(order.created_at).toLocaleString('bg-BG')} · <span class="status">${s.label}</span></p>
      <div class="grid">
        <div class="section"><h3>Клиент</h3>
          <p><strong>${order.customer_name}</strong></p>
          <p>${order.customer_phone}</p>
          ${order.customer_email ? `<p>${order.customer_email}</p>` : ''}
          ${order.customer_notes ? `<p><em>${order.customer_notes}</em></p>` : ''}
        </div>
        <div class="section"><h3>Доставка</h3>
          <p>${order.customer_address}</p>
          <p>${order.customer_city}</p>
          <p>${PAYMENT_LABELS[order.payment_method]}</p>
          ${order.tracking_number ? `<p>Товарителница: <strong>${order.tracking_number}</strong></p>` : ''}
        </div>
      </div>
      <table>
        <thead><tr><th>Продукт</th><th style="text-align:center">Бр.</th><th style="text-align:right">Ед. цена</th><th style="text-align:right">Сума</th></tr></thead>
        <tbody>${items}</tbody>
        <tfoot>
          <tr><td colspan="3" style="text-align:right;color:#6b7280;font-size:13px">Доставка</td><td style="text-align:right">${Number(order.shipping).toFixed(2)} лв.</td></tr>
          <tr class="total"><td colspan="3" style="text-align:right">Общо</td><td style="text-align:right">${Number(order.total).toFixed(2)} лв.</td></tr>
        </tfoot>
      </table>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script>
      </body></html>
    `)
    w.document.close()
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="modal-head">
            <div>
              <div className="modal-order-num">{order.order_number}</div>
              <div className="modal-date">
                {new Date(order.created_at).toLocaleString('bg-BG', {
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="status-pill" style={{ background: s.bg, color: s.color }}>{s.label}</span>
              <button className="icon-btn" onClick={printOrder} title="Принтирай / PDF">🖨️</button>
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>
          </div>

          <div className="modal-body">
            {/* Customer + Delivery */}
            <div className="modal-grid-2">
              <div className="modal-section">
                <h3 className="modal-section-title">Клиент</h3>
                <p className="modal-field-val" style={{ fontWeight: 600 }}>{order.customer_name}</p>
                <button className="phone-btn" onClick={copyPhone}>📞 {order.customer_phone}</button>
                {order.customer_email && (
                  <button className="phone-btn" onClick={copyEmail} style={{ marginTop: 4 }}>
                    ✉️ {order.customer_email}
                  </button>
                )}
                {order.customer_notes && (
                  <div className="notes-box">💬 {order.customer_notes}</div>
                )}
              </div>
              <div className="modal-section">
                <h3 className="modal-section-title">Доставка</h3>
                <p className="modal-field-val">{order.customer_address}</p>
                <p className="modal-field-val">{order.customer_city}</p>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="modal-badge">{PAYMENT_LABELS[order.payment_method]}</span>
                  <span className="modal-badge" style={{ background: ps.bg, color: ps.color }}>{ps.label}</span>
                </div>
              </div>
            </div>

            {/* Tracking number */}
            <div className="modal-section">
              <h3 className="modal-section-title">Номер на пратка (товарителница)</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Въведи номер на пратката..."
                  value={trackingInput}
                  onChange={e => setTrackingInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveTracking()}
                  style={{
                    flex: 1, padding: '9px 14px', border: '1.5px solid #e5e7eb',
                    borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none',
                    background: '#fafafa', color: '#111', transition: 'border-color .2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#2d6a4f'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
                <button
                  onClick={saveTracking}
                  disabled={savingTracking || trackingInput === (order.tracking_number || '')}
                  style={{
                    padding: '9px 18px', background: '#1b4332', color: '#fff',
                    border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity .2s',
                    opacity: savingTracking ? .6 : 1,
                  }}
                >
                  {savingTracking ? '...' : 'Запази'}
                </button>
              </div>
              {trackingInput && (
                <a
                  href={`https://www.speedy.bg/bg/track-shipment/?shipmentNumber=${trackingInput}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: '#2d6a4f', textDecoration: 'none', marginTop: 6, display: 'inline-block' }}
                >
                  ↗ Проследи в Speedy
                </a>
              )}
            </div>

            {/* Items */}
            {order.order_items && order.order_items.length > 0 && (
              <div className="modal-section">
                <h3 className="modal-section-title">Продукти</h3>
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Продукт</th>
                      <th className="text-right">Бр.</th>
                      <th className="text-right">Цена</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.order_items.map(item => (
                      <tr key={item.id}>
                        <td>{item.product_name}</td>
                        <td className="text-right">{item.quantity}</td>
                        <td className="text-right">{Number(item.total_price).toFixed(2)} лв.</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={2}>Доставка</td>
                      <td className="text-right">{Number(order.shipping).toFixed(2)} лв.</td>
                    </tr>
                    <tr className="total-row grand">
                      <td colSpan={2}>Общо</td>
                      <td className="text-right">{Number(order.total).toFixed(2)} лв.</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Status update */}
            <div className="modal-section">
              <h3 className="modal-section-title">Промени статус</h3>
              <div className="status-btn-group">
                {Object.entries(STATUS_LABELS).map(([key, cfg]) => (
                  <button
                    key={key}
                    className={`status-btn${order.status === key ? ' active' : ''}`}
                    style={{
                      borderColor: cfg.color,
                      background: order.status === key ? cfg.color : 'transparent',
                      color: order.status === key ? '#fff' : cfg.color,
                    }}
                    onClick={() => handleStatus(key)}
                    disabled={updating || order.status === key}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment status */}
            <div className="modal-section">
              <h3 className="modal-section-title">Статус плащане</h3>
              <div className="status-btn-group">
                {Object.entries(PAYMENT_STATUS_LABELS).map(([key, cfg]) => (
                  <button
                    key={key}
                    className={`status-btn${order.payment_status === key ? ' active' : ''}`}
                    style={{
                      borderColor: cfg.color,
                      background: order.payment_status === key ? cfg.color : 'transparent',
                      color: order.payment_status === key ? '#fff' : cfg.color,
                    }}
                    onClick={() => handlePayment(key)}
                    disabled={updating || order.payment_status === key}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {order.utm_source && (
              <div className="utm-row">
                <span className="utm-label">UTM source:</span>
                <span className="utm-val">{order.utm_source}</span>
                {order.utm_campaign && (
                  <><span className="utm-label">Campaign:</span>
                  <span className="utm-val">{order.utm_campaign}</span></>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 200;
          display: flex; align-items: center; justify-content: center;
          padding: 16px; backdrop-filter: blur(4px); animation: fade-in .2s;
        }
        @keyframes fade-in { from{opacity:0} to{opacity:1} }
        .modal-box {
          background: #fff; border-radius: 18px; width: 100%; max-width: 620px;
          max-height: 92vh; overflow-y: auto;
          animation: slide-up .25s cubic-bezier(.34,1.56,.64,1);
          box-shadow: 0 24px 80px rgba(0,0,0,.3);
        }
        @keyframes slide-up { from{transform:translateY(20px);opacity:0} to{transform:none;opacity:1} }
        .modal-head {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 20px 20px 16px; border-bottom: 1px solid #f0f0f0;
          position: sticky; top: 0; background: #fff; z-index: 10;
          border-radius: 18px 18px 0 0;
        }
        .modal-order-num { font-family: monospace; font-size: 20px; font-weight: 700; color: var(--text); }
        .modal-date { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .icon-btn { background: #f3f4f6; border: none; border-radius: 8px; width: 32px; height: 32px; cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: background .15s; }
        .icon-btn:hover { background: #e5e7eb; }
        .modal-close { background: #f3f4f6; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 14px; color: var(--muted); display: flex; align-items: center; justify-content: center; transition: background .15s; }
        .modal-close:hover { background: #fee2e2; color: #ef4444; }
        .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        .modal-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media(max-width:500px) { .modal-grid-2 { grid-template-columns: 1fr; } }
        .modal-section { display: flex; flex-direction: column; gap: 5px; }
        .modal-section-title { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 700; margin-bottom: 6px; }
        .modal-field-val { font-size: 14px; color: var(--text); }
        .phone-btn { background: #f0fdf4; border: none; border-radius: 8px; padding: 7px 12px; font-size: 13px; color: var(--green); cursor: pointer; font-family: inherit; text-align: left; transition: background .15s; }
        .phone-btn:hover { background: #dcfce7; }
        .modal-badge { background: #f3f4f6; color: var(--muted); padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; display: inline-block; }
        .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 9px 12px; font-size: 13px; color: #92400e; }
        .items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .items-table th { text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #f0f0f0; }
        .items-table td { padding: 9px 10px; border-bottom: 1px solid #f9f9f9; }
        .items-table .text-right { text-align: right; }
        .total-row td { padding: 8px 10px; color: var(--muted); font-size: 13px; }
        .total-row.grand td { font-weight: 800; color: var(--text); font-size: 16px; border-top: 2px solid #f0f0f0; }
        .status-btn-group { display: flex; flex-wrap: wrap; gap: 8px; }
        .status-btn { padding: 7px 16px; border: 1.5px solid; border-radius: 99px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; transition: all .15s; }
        .status-btn:hover:not(:disabled) { opacity: .85; transform: translateY(-1px); }
        .status-btn:disabled { cursor: default; opacity: .6; }
        .utm-row { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; background: #f8fafc; border-radius: 8px; padding: 10px 12px; }
        .utm-label { font-size: 12px; color: var(--muted); }
        .utm-val { font-size: 12px; font-family: monospace; color: var(--text); background: #fff; padding: 2px 8px; border-radius: 4px; border: 1px solid #e5e7eb; }
      `}</style>
    </>
  )
}
