'use client'
// app/admin/components/OrderModal.tsx

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
  const s = STATUS_LABELS[order.status]
  const ps = PAYMENT_STATUS_LABELS[order.payment_status]

  const handleStatus = async (status: string) => {
    setUpdating(true)
    try {
      await onStatusChange(order.id, status)
      toast.success(`Статус → ${STATUS_LABELS[status]?.label}`)
    } catch {
      toast.error('Грешка при обновяване')
    } finally {
      setUpdating(false)
    }
  }

  const handlePayment = async (payment_status: string) => {
    setUpdating(true)
    try {
      await onPaymentChange(order.id, payment_status)
      toast.success(`Плащане → ${PAYMENT_STATUS_LABELS[payment_status]?.label}`)
    } catch {
      toast.error('Грешка при обновяване')
    } finally {
      setUpdating(false)
    }
  }

  const copyPhone = () => {
    navigator.clipboard.writeText(order.customer_phone)
    toast.info('Телефонът е копиран')
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
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>
          </div>

          <div className="modal-body">
            {/* Customer + Delivery */}
            <div className="modal-grid-2">
              <div className="modal-section">
                <h3 className="modal-section-title">Клиент</h3>
                <p className="modal-field-val" style={{ fontWeight: 600 }}>{order.customer_name}</p>
                <button className="phone-btn" onClick={copyPhone}>
                  📞 {order.customer_phone}
                </button>
                {order.customer_email && (
                  <a className="modal-link" href={`mailto:${order.customer_email}`}>
                    {order.customer_email}
                  </a>
                )}
                {order.customer_notes && (
                  <div className="notes-box">💬 {order.customer_notes}</div>
                )}
              </div>
              <div className="modal-section">
                <h3 className="modal-section-title">Доставка</h3>
                <p className="modal-field-val">{order.customer_address}</p>
                <p className="modal-field-val">{order.customer_city}</p>
                <div style={{ marginTop: 8 }}>
                  <span className="modal-badge">{PAYMENT_LABELS[order.payment_method]}</span>
                </div>
              </div>
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
                        <td className="text-right">{item.total_price.toFixed(2)} лв.</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={2}>Доставка</td>
                      <td className="text-right">{order.shipping.toFixed(2)} лв.</td>
                    </tr>
                    <tr className="total-row grand">
                      <td colSpan={2}>Общо</td>
                      <td className="text-right">{order.total.toFixed(2)} лв.</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Status update */}
            <div className="modal-section">
              <h3 className="modal-section-title">Промени статус</h3>
              <div className="status-btn-group">
                {Object.entries(STATUS_LABELS)
                  .filter(([k]) => k !== 'all')
                  .map(([key, cfg]) => (
                    <button
                      key={key}
                      className={`status-btn${order.status === key ? ' active' : ''}`}
                      style={{
                        '--bc': cfg.color,
                        '--bg': order.status === key ? cfg.color : 'transparent',
                        '--tc': order.status === key ? '#fff' : cfg.color,
                      } as React.CSSProperties}
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
              <h3 className="modal-section-title">Плащане</h3>
              <div className="status-btn-group">
                {Object.entries(PAYMENT_STATUS_LABELS).map(([key, cfg]) => (
                  <button
                    key={key}
                    className={`status-btn${order.payment_status === key ? ' active' : ''}`}
                    style={{
                      '--bc': cfg.color,
                      '--bg': order.payment_status === key ? cfg.color : 'transparent',
                      '--tc': order.payment_status === key ? '#fff' : cfg.color,
                    } as React.CSSProperties}
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
                <span className="utm-label">Източник:</span>
                <span className="utm-val">{order.utm_source}</span>
                {order.utm_campaign && (
                  <><span className="utm-label">Кампания:</span>
                  <span className="utm-val">{order.utm_campaign}</span></>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,.45);
          z-index: 200; display: flex; align-items: center; justify-content: center;
          padding: 20px; backdrop-filter: blur(3px);
          animation: fade-in .2s;
        }
        @keyframes fade-in { from{opacity:0} to{opacity:1} }
        .modal-box {
          background: #fff; border-radius: 16px; max-width: 600px; width: 100%;
          max-height: 90vh; overflow-y: auto;
          animation: slide-up .25s cubic-bezier(.34,1.56,.64,1);
          box-shadow: 0 20px 60px rgba(0,0,0,.25);
        }
        @keyframes slide-up { from{transform:translateY(20px);opacity:0} to{transform:none;opacity:1} }
        .modal-head {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 20px 20px 16px; border-bottom: 1px solid #f0f0f0;
        }
        .modal-order-num { font-family: monospace; font-size: 18px; font-weight: 700; color: var(--text); }
        .modal-date { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .modal-close {
          background: #f3f4f6; border: none; border-radius: 50%;
          width: 30px; height: 30px; cursor: pointer; font-size: 13px; color: var(--muted);
          display: flex; align-items: center; justify-content: center; transition: background .15s;
        }
        .modal-close:hover { background: #e5e7eb; }
        .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 18px; }
        .modal-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media(max-width:500px) { .modal-grid-2 { grid-template-columns: 1fr; } }
        .modal-section { display: flex; flex-direction: column; gap: 4px; }
        .modal-section-title {
          font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
          color: var(--muted); font-weight: 600; margin-bottom: 6px;
        }
        .modal-field-val { font-size: 14px; color: var(--text); }
        .phone-btn {
          background: #f0fdf4; border: none; border-radius: 7px; padding: 6px 12px;
          font-size: 13px; color: var(--green); cursor: pointer; font-family: inherit;
          text-align: left; transition: background .15s; margin-top: 2px;
        }
        .phone-btn:hover { background: #dcfce7; }
        .modal-link { font-size: 13px; color: var(--green); text-decoration: none; }
        .modal-badge {
          background: #f3f4f6; color: var(--muted); padding: 3px 10px;
          border-radius: 99px; font-size: 12px; display: inline-block;
        }
        .notes-box {
          background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;
          padding: 8px 12px; font-size: 13px; color: #92400e; margin-top: 4px;
        }
        .items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .items-table th {
          text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 600;
          color: var(--muted); text-transform: uppercase; letter-spacing: .04em;
          border-bottom: 1px solid #f0f0f0;
        }
        .items-table td { padding: 9px 10px; border-bottom: 1px solid #f9f9f9; }
        .items-table .text-right { text-align: right; }
        .total-row td { padding: 8px 10px; color: var(--muted); font-size: 13px; }
        .total-row.grand td { font-weight: 700; color: var(--text); font-size: 15px; border-top: 2px solid #f0f0f0; }
        .status-btn-group { display: flex; flex-wrap: wrap; gap: 8px; }
        .status-btn {
          padding: 6px 14px; border: 1.5px solid var(--bc); border-radius: 99px;
          cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600;
          background: var(--bg); color: var(--tc);
          transition: all .15s; letter-spacing: .02em;
        }
        .status-btn:hover:not(:disabled) { opacity: .85; }
        .status-btn:disabled { cursor: default; }
        .utm-row {
          display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center;
          background: #f8fafc; border-radius: 8px; padding: 10px 12px;
        }
        .utm-label { font-size: 12px; color: var(--muted); }
        .utm-val { font-size: 12px; font-family: monospace; color: var(--text); }
      `}</style>
    </>
  )
}
