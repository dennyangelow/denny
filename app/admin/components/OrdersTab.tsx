'use client'
// app/admin/components/OrdersTab.tsx

import { useState, useMemo, useEffect } from 'react'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS, PAYMENT_LABELS, ORDER_STATUSES, type OrderStatus } from '@/lib/constants'
import { OrderModal } from './OrderModal'

const PAGE_SIZE = 15

interface Props {
  orders: Order[]
  onStatusChange: (id: string, status: string) => Promise<void>
  onPaymentChange: (id: string, payment_status: string) => Promise<void>
  initialOrder?: Order | null
}

export function OrdersTab({ orders, onStatusChange, onPaymentChange, initialOrder }: Props) {
  const [filter, setFilter]     = useState<OrderStatus>('all')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState<Order | null>(null)

  useEffect(() => {
    if (initialOrder) setSelected(initialOrder)
  }, [initialOrder])

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

  const handleFilter = (f: OrderStatus) => { setFilter(f); setPage(1) }
  const handleSearch = (v: string)      => { setSearch(v); setPage(1) }

  const statusCount = (s: string) => orders.filter(o => s === 'all' ? true : o.status === s).length

  return (
    <div className="orders-root">
      <div className="orders-header">
        <div>
          <h1 className="page-title">Поръчки</h1>
          <p className="page-sub">{filtered.length} резултата</p>
        </div>
        <input
          className="search-box"
          placeholder="Търси по номер, клиент, телефон..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
        />
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
            onClick={() => handleFilter(s)}
          >
            {s === 'all' ? 'Всички' : STATUS_LABELS[s]?.label}
            <span className="chip-count">{statusCount(s)}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Клиент</th>
              <th>Град</th>
              <th>Плащане</th>
              <th>Статус</th>
              <th className="text-right">Сума</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr><td colSpan={7} className="empty-row">Няма поръчки</td></tr>
            )}
            {paginated.map(o => {
              const s  = STATUS_LABELS[o.status]
              return (
                <tr key={o.id} className="order-row" onClick={() => setSelected(o)}>
                  <td><span className="order-num">{o.order_number}</span></td>
                  <td>
                    <div className="customer-name">{o.customer_name}</div>
                    <div className="customer-phone">{o.customer_phone}</div>
                  </td>
                  <td className="city-cell">{o.customer_city}</td>
                  <td>{PAYMENT_LABELS[o.payment_method]}</td>
                  <td>
                    <span className="status-pill" style={{ background: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                  </td>
                  <td className="text-right amount">{o.total.toFixed(2)} лв.</td>
                  <td className="date-cell">
                    {new Date(o.created_at).toLocaleDateString('bg-BG', {
                      day: '2-digit', month: 'short',
                    })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            ← Назад
          </button>
          <span className="page-info">
            {page} / {totalPages}
          </span>
          <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            Напред →
          </button>
        </div>
      )}

      {/* Modal */}
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
        .orders-root { padding: 28px 32px; }
        .orders-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 18px; gap: 16px; flex-wrap: wrap;
        }
        .page-title { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -.02em; }
        .page-sub { font-size: 13px; color: var(--muted); margin-top: 2px; }
        .search-box {
          padding: 9px 14px; border: 1px solid var(--border); border-radius: 9px;
          font-family: inherit; font-size: 13px; width: 280px; background: #fff; color: var(--text);
          transition: border-color .2s;
        }
        .search-box:focus { outline: none; border-color: var(--green); }
        @media(max-width:600px) { .search-box { width: 100%; } }

        .filter-row { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-chip {
          padding: 6px 12px; border: 1px solid var(--border); border-radius: 99px;
          background: #fff; cursor: pointer; font-family: inherit; font-size: 12.5px;
          color: var(--muted); display: flex; align-items: center; gap: 5px;
          transition: all .15s; font-weight: 500;
        }
        .filter-chip:hover { border-color: #9ca3af; color: var(--text); }
        .filter-chip.active:not([style]) { background: var(--text); color: #fff; border-color: var(--text); }
        .chip-count {
          background: rgba(0,0,0,.08); border-radius: 99px; padding: 1px 6px; font-size: 11px;
        }
        .filter-chip.active .chip-count { background: rgba(0,0,0,.15); }

        .table-wrap { background: #fff; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .orders-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .orders-table th {
          padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 600;
          color: var(--muted); text-transform: uppercase; letter-spacing: .05em;
          border-bottom: 1px solid var(--border); background: #f9fafb;
        }
        .orders-table td { padding: 11px 14px; border-bottom: 1px solid #f5f5f5; vertical-align: middle; }
        .order-row { cursor: pointer; transition: background .12s; }
        .order-row:hover { background: #fafcff; }
        .order-num { font-family: monospace; font-size: 12px; color: var(--muted); }
        .customer-name { font-size: 13px; font-weight: 500; color: var(--text); }
        .customer-phone { font-size: 11px; color: var(--muted); margin-top: 1px; }
        .city-cell { font-size: 13px; color: var(--muted); }
        .text-right { text-align: right; }
        .amount { font-weight: 600; color: var(--text); }
        .date-cell { font-size: 12px; color: var(--muted); white-space: nowrap; }
        .status-pill { padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 600; white-space: nowrap; }
        .empty-row { text-align: center; color: var(--muted); padding: 48px !important; font-size: 14px; }

        .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 18px; }
        .page-btn {
          padding: 7px 16px; border: 1px solid var(--border); border-radius: 8px;
          background: #fff; cursor: pointer; font-family: inherit; font-size: 13px;
          color: var(--text); transition: all .15s;
        }
        .page-btn:hover:not(:disabled) { border-color: var(--green); color: var(--green); }
        .page-btn:disabled { opacity: .4; cursor: default; }
        .page-info { font-size: 13px; color: var(--muted); }
      `}</style>
    </div>
  )
}
