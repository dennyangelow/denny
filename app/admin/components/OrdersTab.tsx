'use client'
// app/admin/components/OrdersTab.tsx — v4 с евро, bulk actions, CSV

import { useState, useMemo, useEffect, useCallback } from 'react'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS, PAYMENT_LABELS, COURIER_LABELS, ORDER_STATUSES, formatPrice, type OrderStatus } from '@/lib/constants'
import { OrderModal } from './OrderModal'
import { toast } from '@/components/ui/Toast'

const PAGE_SIZE = 15

interface Props {
  orders: Order[]
  onStatusChange:  (id: string, status: string) => Promise<void>
  onPaymentChange: (id: string, payment_status: string) => Promise<void>
  initialOrder?: Order | null
}

export function OrdersTab({ orders, onStatusChange, onPaymentChange, initialOrder }: Props) {
  const [filter, setFilter]   = useState<OrderStatus>('all')
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [selected, setSelected] = useState<Order | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => { if (initialOrder) setSelected(initialOrder) }, [initialOrder])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return orders
      .filter(o => filter === 'all' || o.status === filter)
      .filter(o => !q ||
        o.order_number?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.includes(q) ||
        o.customer_city?.toLowerCase().includes(q)
      )
  }, [orders, filter, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleCheck = (id: string) => setChecked(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleAll = () => setChecked(checked.size === paginated.length ? new Set() : new Set(paginated.map(o => o.id)))

  const applyBulk = useCallback(async () => {
    if (!bulkStatus || checked.size === 0) return
    setBulkLoading(true)
    try {
      await Promise.all([...checked].map(id => onStatusChange(id, bulkStatus)))
      toast.success(`${checked.size} поръчки → ${STATUS_LABELS[bulkStatus]?.label}`)
      setChecked(new Set())
      setBulkStatus('')
    } catch { toast.error('Грешка при bulk обновяване') }
    finally { setBulkLoading(false) }
  }, [checked, bulkStatus, onStatusChange])

  const exportCSV = () => {
    const rows = [
      ['Номер','Клиент','Телефон','Имейл','Адрес','Град','Куриер','Плащане','Статус','Плащане статус','Сума (€)','Дата'],
      ...filtered.map(o => [
        o.order_number, o.customer_name, o.customer_phone,
        o.customer_email || '', o.customer_address, o.customer_city,
        o.courier ? COURIER_LABELS[o.courier]?.label : 'Еконт',
        PAYMENT_LABELS[o.payment_method], STATUS_LABELS[o.status]?.label,
        o.payment_status, Number(o.total).toFixed(2),
        new Date(o.created_at).toLocaleDateString('bg-BG'),
      ]),
    ]
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const a    = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success(`Изтеглени ${filtered.length} поръчки`)
  }

  const totalRevenue = filtered.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0)

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Поръчки</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {filtered.length} резултата · {formatPrice(totalRevenue)} приход
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="🔍 Търси по номер, клиент, телефон..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, width: 280, background: '#fff', color: 'var(--text)', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#2d6a4f'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <button onClick={exportCSV} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {ORDER_STATUSES.map(s => {
          const count = orders.filter(o => s === 'all' ? true : o.status === s).length
          const cfg   = s !== 'all' ? STATUS_LABELS[s] : null
          const isActive = filter === s
          return (
            <button key={s}
              onClick={() => { setFilter(s); setPage(1); setChecked(new Set()) }}
              style={{
                padding: '6px 12px', border: `1px solid ${isActive && cfg ? cfg.color + '55' : 'var(--border)'}`,
                borderRadius: 99, background: isActive ? (cfg ? cfg.bg : '#111') : '#fff',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
                color: isActive ? (cfg ? cfg.color : '#fff') : 'var(--muted)',
                display: 'flex', alignItems: 'center', gap: 5, transition: 'all .15s',
              }}
            >
              {s === 'all' ? 'Всички' : cfg?.label}
              <span style={{ background: 'rgba(0,0,0,.08)', borderRadius: 99, padding: '1px 6px', fontSize: 11 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Bulk bar */}
      {checked.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>{checked.size} избрани</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #bbf7d0', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', background: '#fff' }}>
            <option value="">— Смени статус —</option>
            {Object.entries(STATUS_LABELS).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
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

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 620 }}>
            <thead>
              <tr>
                <th style={{ width: 40, padding: '11px 14px', background: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={checked.size === paginated.length && paginated.length > 0} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                {['Номер','Клиент','Куриер','Статус','Сума','Дата'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)', background: '#f9fafb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 48, fontSize: 14 }}>Няма поръчки</td></tr>
              )}
              {paginated.map(o => {
                const s = STATUS_LABELS[o.status]
                return (
                  <tr key={o.id} style={{ cursor: 'pointer', background: checked.has(o.id) ? '#f0fdf4' : '' }}
                    onMouseEnter={e => { if (!checked.has(o.id)) (e.currentTarget as HTMLElement).style.background = '#fafcff' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = checked.has(o.id) ? '#f0fdf4' : '' }}
                  >
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #f5f5f5' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={checked.has(o.id)} onChange={() => toggleCheck(o.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #f5f5f5' }} onClick={() => setSelected(o)}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{o.order_number}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #f5f5f5' }} onClick={() => setSelected(o)}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.customer_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.customer_phone}</div>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #f5f5f5', fontSize: 12, color: '#6b7280' }} onClick={() => setSelected(o)}>
                      {o.courier ? COURIER_LABELS[o.courier]?.label : 'Еконт'}
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #f5f5f5' }} onClick={() => setSelected(o)}>
                      <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #f5f5f5', fontWeight: 700, textAlign: 'right', color: '#16a34a', whiteSpace: 'nowrap' }} onClick={() => setSelected(o)}>
                      {formatPrice(o.total)}
                    </td>
                    <td style={{ padding: '11px 14px', borderBottom: '1px solid #f5f5f5', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }} onClick={() => setSelected(o)}>
                      {new Date(o.created_at).toLocaleDateString('bg-BG', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18 }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>← Назад</button>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{page} / {totalPages} · {filtered.length} поръчки</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Напред →</button>
        </div>
      )}

      {selected && (
        <OrderModal
          order={selected} onClose={() => setSelected(null)}
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
