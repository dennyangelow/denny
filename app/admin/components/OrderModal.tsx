'use client'

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
  const s = STATUS_LABELS[order.status] || { label: order.status, bg: '#eee', color: '#333' }
  const ps = PAYMENT_STATUS_LABELS[order.payment_status] || { label: order.payment_status, color: '#333' }

  const handleStatus = async (status: string) => {
    if (updating) return
    setUpdating(true)
    try {
      await onStatusChange(order.id, status)
      toast.success(`Статус актуализиран: ${STATUS_LABELS[status]?.label}`)
    } catch {
      toast.error('Грешка при обновяване на статуса')
    } finally {
      setUpdating(false)
    }
  }

  const handlePayment = async (payment_status: string) => {
    if (updating) return
    setUpdating(true)
    try {
      await onPaymentChange(order.id, payment_status)
      toast.success(`Плащане: ${PAYMENT_STATUS_LABELS[payment_status]?.label}`)
    } catch {
      toast.error('Грешка при обновяване на плащането')
    } finally {
      setUpdating(false)
    }
  }

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text)
    toast.info(msg)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="modal-head">
            <div className="head-left">
              <div className="modal-order-num">#{order.order_number}</div>
              <div className="modal-date">
                {new Date(order.created_at).toLocaleString('bg-BG', {
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
            <div className="head-right">
              <button className="print-btn" onClick={handlePrint} title="Принтирай поръчката">🖨️</button>
              <span className="status-pill" style={{ background: s.bg, color: s.color }}>{s.label}</span>
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>
          </div>

          <div className="modal-body">
            {/* Customer + Delivery Grid */}
            <div className="modal-grid-2">
              <div className="modal-section card-style">
                <h3 className="modal-section-title">👤 Клиент</h3>
                <div className="customer-info">
                  <p className="modal-field-val primary-text">{order.customer_name}</p>
                  <div className="action-row">
                    <a href={`tel:${order.customer_phone}`} className="phone-btn">
                      📞 {order.customer_phone}
                    </a>
                    <button className="copy-icon-btn" onClick={() => copyToClipboard(order.customer_phone, 'Телефонът е копиран')}>📋</button>
                  </div>
                  {order.customer_email && (
                    <a className="modal-link" href={`mailto:${order.customer_email}`}>
                      ✉️ {order.customer_email}
                    </a>
                  )}
                </div>
                {order.customer_notes && (
                  <div className="notes-box">
                    <span className="notes-label">Бележка от клиента:</span>
                    <p>"{order.customer_notes}"</p>
                  </div>
                )}
              </div>

              <div className="modal-section card-style">
                <h3 className="modal-section-title">📍 Доставка</h3>
                <div className="delivery-info">
                  <p className="modal-field-val">{order.customer_address}</p>
                  <p className="modal-field-val"><strong>{order.customer_city}</strong></p>
                  <a 
                    href={`https://www.google.com/maps/search/${encodeURIComponent(order.customer_address + ' ' + order.customer_city)}`} 
                    target="_blank" 
                    className="map-link"
                  >
                    🗺️ Виж в Google Maps
                  </a>
                  <div className="payment-method-row">
                    <span className="label-small">Метод:</span>
                    <span className="modal-badge">{PAYMENT_LABELS[order.payment_method]}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="modal-section items-card">
              <h3 className="modal-section-title">🛒 Продукти</h3>
              <div className="table-responsive">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th>Продукт</th>
                      <th className="text-right">Бр.</th>
                      <th className="text-right">Общо</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.order_items?.map(item => (
                      <tr key={item.id}>
                        <td className="product-cell">
                          <span className="product-name">{item.product_name}</span>
                        </td>
                        <td className="text-right">x{item.quantity}</td>
                        <td className="text-right bold-text">{item.total_price.toFixed(2)} лв.</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={2}>Доставка:</td>
                      <td className="text-right">{order.shipping.toFixed(2)} лв.</td>
                    </tr>
                    <tr className="total-row grand">
                      <td colSpan={2}>КРАЙНА СУМА:</td>
                      <td className="text-right">{order.total.toFixed(2)} лв.</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Admin Controls */}
            <div className="admin-controls-grid">
              <div className="modal-section">
                <h3 className="modal-section-title">⚙️ Статус на поръчката</h3>
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
                        disabled={updating}
                      >
                        {order.status === key && updating ? '...' : cfg.label}
                      </button>
                    ))}
                </div>
              </div>

              <div className="modal-section">
                <h3 className="modal-section-title">💳 Статус на плащане</h3>
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
                      disabled={updating}
                    >
                      {order.payment_status === key && updating ? '...' : cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {order.utm_source && (
              <div className="utm-row">
                <div className="utm-tag">📢 {order.utm_source}</div>
                {order.utm_campaign && <div className="utm-tag campaign">🎯 {order.utm_campaign}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6);
          z-index: 1000; display: flex; align-items: center; justify-content: center;
          padding: 16px; backdrop-filter: blur(4px);
          animation: fade-in 0.2s ease-out;
        }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

        .modal-box {
          background: #fff; border-radius: 20px; max-width: 700px; width: 100%;
          max-height: 94vh; overflow-y: auto; position: relative;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slide-up { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .modal-head {
          position: sticky; top: 0; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px);
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 24px; border-bottom: 1px solid #f1f5f9; z-index: 10;
        }
        .modal-order-num { font-family: 'Inter', system-ui; font-size: 20px; font-weight: 800; color: #1e293b; }
        .modal-date { font-size: 13px; color: #64748b; }
        
        .head-right { display: flex; align-items: center; gap: 12px; }
        .print-btn { background: none; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; cursor: pointer; filter: grayscale(1); transition: 0.2s; }
        .print-btn:hover { background: #f8fafc; filter: none; border-color: #cbd5e1; }

        .modal-close {
          background: #f1f5f9; border: none; border-radius: 10px;
          width: 32px; height: 32px; cursor: pointer; color: #64748b;
          display: flex; align-items: center; justify-content: center; transition: 0.2s;
        }
        .modal-close:hover { background: #e2e8f0; color: #0f172a; }

        .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .card-style { background: #f8fafc; padding: 16px; border-radius: 16px; border: 1px solid #f1f5f9; }
        
        .modal-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media(max-width:600px) { .modal-grid-2 { grid-template-columns: 1fr; } }

        .modal-section-title {
          font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
          color: #64748b; font-weight: 700; margin-bottom: 12px;
        }

        .primary-text { font-size: 16px; font-weight: 700; color: #0f172a; }
        .action-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
        
        .phone-btn {
          background: #dcfce7; color: #15803d; padding: 6px 14px; border-radius: 10px;
          font-size: 14px; font-weight: 600; text-decoration: none; transition: 0.2s;
        }
        .phone-btn:hover { background: #bbf7d0; }
        
        .copy-icon-btn { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 8px; cursor: pointer; }

        .map-link { font-size: 13px; color: #2563eb; text-decoration: none; display: block; margin-top: 8px; }
        .map-link:hover { text-decoration: underline; }

        .notes-box {
          background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px;
          padding: 12px; margin-top: 12px;
        }
        .notes-label { font-size: 11px; font-weight: 700; color: #92400e; display: block; margin-bottom: 4px; }
        .notes-box p { font-size: 13px; font-style: italic; color: #78350f; margin: 0; }

        .items-card { border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
        .items-table { width: 100%; border-collapse: collapse; }
        .items-table th { background: #f8fafc; padding: 12px; text-align: left; font-size: 11px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
        .items-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        
        .total-row td { padding: 8px 12px; color: #64748b; }
        .total-row.grand td { font-weight: 800; color: #0f172a; font-size: 17px; background: #f8fafc; border-top: 2px solid #e2e8f0; }

        .admin-controls-grid { display: grid; grid-template-columns: 1fr; gap: 20px; background: #fff; }
        
        .status-btn-group { display: flex; flex-wrap: wrap; gap: 8px; }
        .status-btn {
          padding: 8px 16px; border: 2px solid var(--bc); border-radius: 12px;
          cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700;
          background: var(--bg); color: var(--tc); transition: all 0.2s;
        }
        .status-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .utm-row { display: flex; gap: 10px; margin-top: 10px; }
        .utm-tag { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; color: #475569; }
        .utm-tag.campaign { background: #e0f2fe; color: #0369a1; }

        @media print {
          .modal-backdrop { position: absolute; background: white; padding: 0; }
          .modal-box { box-shadow: none; max-height: none; width: 100%; }
          .modal-close, .admin-controls-grid, .status-btn-group, .print-btn { display: none !important; }
        }
      `}</style>
    </>
  )
}