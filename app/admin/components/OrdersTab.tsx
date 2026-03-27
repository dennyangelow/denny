'use client'
// app/admin/components/OrdersTab.tsx — v3 с bulk actions

import { useState, useMemo, useEffect, useCallback } from 'react'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS, PAYMENT_LABELS, ORDER_STATUSES, type OrderStatus } from '@/lib/constants'
import { OrderModal } from './OrderModal'
import { toast } from '@/components/ui/Toast'

const PAGE_SIZE = 15

interface Props {
  orders: Order[]
  onStatusChange: (id: string, status: string) => Promise<void>
  onPaymentChange: (id: string, payment_status: string) => Promise<void>
  initialOrder?: Order | null
}

export function OrdersTab({ orders, onStatusChange, onPaymentChange, initialOrder }: Props) {
  const [filter, setFilter]       = useState<OrderStatus>('all')
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)
  const [selected, setSelected]   = useState<Order | null>(null)
  const [checked, setChecked]     = useState<Set<string>>(new Set())
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

  const toggleCheck = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (checked.size === paginated.length) {
      setChecked(new Set())
    } else {
      setChecked(new Set(paginated.map(o => o.id)))
    }
  }

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
      ['Номер', 'Клиент', 'Телефон', 'Имейл', 'Адрес', 'Град', 'Плащане', 'Статус', 'Плащане статус', 'Сума', 'Дата'],
      ...filtered.map(o => [
        o.order_number, o.customer_name, o.customer_phone,
        o.customer_email || '', o.customer_address, o.customer_city,
        PAYMENT_LABELS[o.payment_method], STATUS_LABELS[o.status]?.label,
        o.payment_status, Number(o.total).toFixed(2),
        new Date(o.created_at).toLocaleDateString('bg-BG'),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success(`Изтеглени ${filtered.length} поръчки`)
  }

  const statusCount = (s: string) => orders.filter(o => s === 'all' ? true : o.status === s).length
  const totalRevenue = filtered.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0)

  return (
    <div className="orders-root">
      <div className="orders-header">
        <div>
          <h1 className="page-title">Поръчки</h1>
          <p className="page-sub">{filtered.length} резултата · {totalRevenue.toFixed(2)} лв. приход</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="search-box"
            placeholder="🔍 Търси по номер, клиент, телефон..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
          <button onClick={exportCSV} className="btn-export">↓ CSV</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="filter-row">
        {ORDER_STATUSES.map(s => (
          <button
            key={s}
            className={`filter-chip${filter === s ? ' active' : ''}`}
            style={filter === s && s !== 'all' ? {
              background: STATUS_LABELS[s]?.bg,
              color: STATUS_LABELS[s]?.color,
              borderColor: STATUS_LABELS[s]?.color + '55',
            } : {}}
            onClick={() => { setFilter(s); setPage(1); setChecked(new Set()) }}
          >
            {s === 'all' ? 'Всички' : STATUS_LABELS[s]?.label}
            <span className="chip-count">{statusCount(s)}</span>
          </button>
        ))}
      </div>

      {/* Bulk toolbar */}
      {checked.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{checked.size} избрани</span>
          <select
            value={bulkStatus}
            onChange={e => setBulkStatus(e.target.value)}
            className="bulk-select"
          >
            <option value="">— Смени статус на всички —</option>
            {Object.entries(STATUS_LABELS).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <button
            onClick={applyBulk}
            disabled={!bulkStatus || bulkLoading}
            className="bulk-apply"
          >
            {bulkLoading ? 'Обновява...' : '✓ Приложи'}
          </button>
          <button onClick={() => setChecked(new Set())} className="bulk-clear">Изчисти</button>
        </div>
      )}

      {/* Table */}
      <div className="table-wrap">
        <div style={{ overflowX: 'auto' }}>
          <table className="orders-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={checked.size === paginated.length && paginated.length > 0}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer', width: 15, height: 15 }}
                  />
                </th>
                <th>Номер</th>
                <th>Клиент</th>
                <th className="hide-mobile">Град</th>
                <th className="hide-mobile">Плащане</th>
                <th>Статус</th>
                <th className="text-right">Сума</th>
                <th className="text-right hide-mobile">Дата</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={8} className="empty-row">Няма поръчки</td></tr>
              )}
              {paginated.map(o => {
                const s = STATUS_LABELS[o.status]
                return (
                  <tr
                    key={o.id}
                    className={`order-row${checked.has(o.id) ? ' row-checked' : ''}`}
                  >
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked.has(o.id)}
                        onChange={() => toggleCheck(o.id)}
                        style={{ cursor: 'pointer', width: 15, height: 15 }}
                      />
                    </td>
                    <td onClick={() => setSelected(o)}>
                      <span className="order-num">{o.order_number}</span>
                    </td>
                    <td onClick={() => setSelected(o)}>
                      <div className="customer-name">{o.customer_name}</div>
                      <div className="customer-phone">{o.customer_phone}</div>
                    </td>
                    <td className="city-cell hide-mobile" onClick={() => setSelected(o)}>{o.customer_city}</td>
                    <td className="hide-mobile" onClick={() => setSelected(o)}>{PAYMENT_LABELS[o.payment_method]}</td>
                    <td onClick={() => setSelected(o)}>
                      <span className="status-pill" style={{ background: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="text-right amount" onClick={() => setSelected(o)}>
                      {Number(o.total).toFixed(2)} лв.
                    </td>
                    <td className="text-right date-cell hide-mobile" onClick={() => setSelected(o)}>
                      {new Date(o.created_at).toLocaleDateString('bg-BG', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Назад</button>
          <span className="page-info">{page} / {totalPages} · {filtered.length} поръчки</span>
          <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Напред →</button>
        </div>
      )}

      {selected && (
        <OrderModal
          order={selected}
          onClose={() => setSelected(null)}
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

      <style>{`
        .orders-root { padding: 24px 28px; }
        @media(max-width:768px){ .orders-root { padding: 16px; } }
        .orders-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; gap:12px; flex-wrap:wrap; }
        .page-title { font-size:22px; font-weight:700; color:var(--text); letter-spacing:-.02em; }
        .page-sub { font-size:13px; color:var(--muted); margin-top:2px; }
        .search-box { padding:9px 14px; border:1px solid var(--border); border-radius:9px; font-family:inherit; font-size:13px; width:260px; background:#fff; color:var(--text); outline:none; transition:border-color .2s; }
        .search-box:focus { border-color:var(--green); }
        @media(max-width:600px){ .search-box { width:100%; } }
        .btn-export { background:#fff; border:1px solid var(--border); border-radius:8px; padding:9px 14px; cursor:pointer; font-family:inherit; font-size:13px; color:var(--text); transition:all .15s; white-space:nowrap; }
        .btn-export:hover { border-color:var(--green); color:var(--green); }

        .filter-row { display:flex; gap:6px; margin-bottom:14px; flex-wrap:wrap; }
        .filter-chip { padding:6px 12px; border:1px solid var(--border); border-radius:99px; background:#fff; cursor:pointer; font-family:inherit; font-size:12.5px; color:var(--muted); display:flex; align-items:center; gap:5px; transition:all .15s; font-weight:500; }
        .filter-chip:hover { border-color:#9ca3af; color:var(--text); }
        .filter-chip.active:not([style]) { background:var(--text); color:#fff; border-color:var(--text); }
        .chip-count { background:rgba(0,0,0,.08); border-radius:99px; padding:1px 6px; font-size:11px; }

        .bulk-bar { display:flex; align-items:center; gap:10px; margin-bottom:12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:10px 14px; flex-wrap:wrap; }
        .bulk-count { font-size:13px; font-weight:700; color:#065f46; }
        .bulk-select { padding:6px 12px; border:1px solid #bbf7d0; border-radius:8px; font-family:inherit; font-size:13px; outline:none; background:#fff; }
        .bulk-apply { background:#065f46; color:#fff; border:none; border-radius:8px; padding:7px 16px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:700; transition:opacity .2s; }
        .bulk-apply:disabled { opacity:.5; cursor:default; }
        .bulk-clear { background:transparent; border:1px solid #bbf7d0; border-radius:8px; padding:7px 12px; cursor:pointer; font-family:inherit; font-size:13px; color:#6b7280; transition:all .15s; }
        .bulk-clear:hover { background:#fee2e2; border-color:#fca5a5; color:#991b1b; }

        .table-wrap { background:#fff; border:1px solid var(--border); border-radius:12px; overflow:hidden; }
        .orders-table { width:100%; border-collapse:collapse; font-size:13.5px; min-width:600px; }
        .orders-table th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid var(--border); background:#f9fafb; }
        .orders-table td { padding:11px 14px; border-bottom:1px solid #f5f5f5; vertical-align:middle; }
        .order-row { cursor:pointer; transition:background .12s; }
        .order-row:hover { background:#fafcff; }
        .row-checked { background:#f0fdf4 !important; }
        .order-num { font-family:monospace; font-size:12px; color:var(--muted); }
        .customer-name { font-size:13px; font-weight:600; color:var(--text); }
        .customer-phone { font-size:11px; color:var(--muted); margin-top:1px; }
        .city-cell { font-size:13px; color:var(--muted); }
        .text-right { text-align:right; }
        .amount { font-weight:700; color:var(--text); }
        .date-cell { font-size:12px; color:var(--muted); white-space:nowrap; }
        .status-pill { padding:3px 9px; border-radius:99px; font-size:11px; font-weight:700; white-space:nowrap; }
        .empty-row { text-align:center; color:var(--muted); padding:48px !important; font-size:14px; }

        .pagination { display:flex; align-items:center; justify-content:center; gap:16px; margin-top:18px; }
        .page-btn { padding:7px 16px; border:1px solid var(--border); border-radius:8px; background:#fff; cursor:pointer; font-family:inherit; font-size:13px; color:var(--text); transition:all .15s; }
        .page-btn:hover:not(:disabled) { border-color:var(--green); color:var(--green); }
        .page-btn:disabled { opacity:.4; cursor:default; }
        .page-info { font-size:13px; color:var(--muted); }

        @media(max-width:640px){ .hide-mobile { display:none; } }
      `}</style>
    </div>
  )
}
