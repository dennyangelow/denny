'use client'
// app/admin/components/OrdersTab.tsx — v5 с sorting, inline status edit, column density

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS, PAYMENT_LABELS, COURIER_LABELS, ORDER_STATUSES, formatPrice, type OrderStatus } from '@/lib/constants'
import { OrderModal } from './OrderModal'
import { toast } from '@/components/ui/Toast'

const PAGE_SIZE = 15

type SortField = 'date' | 'total' | 'name' | 'status'
type SortDir   = 'asc' | 'desc'

interface Props {
  orders:          Order[]
  onStatusChange:  (id: string, status: string) => Promise<void>
  onPaymentChange: (id: string, payment_status: string) => Promise<void>
  initialOrder?:   Order | null
}

// ─── Inline status dropdown ────────────────────────────────────────────────────
function InlineStatusSelect({
  order, onStatusChange,
}: { order: Order; onStatusChange: (id: string, status: string) => Promise<void> }) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const s   = STATUS_LABELS[order.status]

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const change = async (key: string) => {
    if (key === order.status) { setOpen(false); return }
    setLoading(true); setOpen(false)
    try {
      await onStatusChange(order.id, key)
      toast.success(`→ ${STATUS_LABELS[key]?.label}`)
    } catch { toast.error('Грешка') }
    finally { setLoading(false) }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open) }}
        disabled={loading}
        style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
          background: s.bg, color: s.color, border: `1px solid ${s.color}33`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          opacity: loading ? .6 : 1, whiteSpace: 'nowrap', fontFamily: 'inherit' }}
      >
        {loading ? '⏳' : s.label}
        <span style={{ fontSize: 8, opacity: .6 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 100, minWidth: 150,
          padding: 4, overflow: 'hidden',
        }}>
          {Object.entries(STATUS_LABELS).map(([key, cfg]) => (
            <button key={key} onClick={e => { e.stopPropagation(); change(key) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '7px 10px', border: 'none', background: key === order.status ? cfg.bg : 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                color: cfg.color, borderRadius: 6, textAlign: 'left',
              }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              {cfg.label}
              {key === order.status && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sort header ───────────────────────────────────────────────────────────────
function SortTh({ label, field, sort, dir, onSort }: {
  label: string; field: SortField
  sort: SortField; dir: SortDir
  onSort: (f: SortField) => void
}) {
  const active = sort === field
  return (
    <th onClick={() => onSort(field)}
      style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: active ? '#1b4332' : 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)',
        background: '#f9fafb', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', transition: 'color .15s' }}>
      {label} {active ? (dir === 'asc' ? '↑' : '↓') : <span style={{ opacity: .3 }}>↕</span>}
    </th>
  )
}

export function OrdersTab({ orders, onStatusChange, onPaymentChange, initialOrder }: Props) {
  const [filter, setFilter]     = useState<OrderStatus>('all')
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState<Order | null>(null)
  const [checked, setChecked]   = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [sort, setSort]         = useState<SortField>('date')
  const [sortDir, setSortDir]   = useState<SortDir>('desc')
  const [density, setDensity]   = useState<'comfortable' | 'compact'>('comfortable')

  useEffect(() => { if (initialOrder) setSelected(initialOrder) }, [initialOrder])

  const handleSort = (field: SortField) => {
    if (sort === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSort(field); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let result = orders
      .filter(o => filter === 'all' || o.status === filter)
      .filter(o => !q ||
        o.order_number?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.includes(q) ||
        o.customer_city?.toLowerCase().includes(q)
      )

    result = [...result].sort((a, b) => {
      let diff = 0
      if (sort === 'date')   diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'total')  diff = Number(a.total) - Number(b.total)
      if (sort === 'name')   diff = a.customer_name.localeCompare(b.customer_name, 'bg')
      if (sort === 'status') diff = a.status.localeCompare(b.status)
      return sortDir === 'asc' ? diff : -diff
    })
    return result
  }, [orders, filter, search, sort, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalRevenue = filtered.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total), 0)

  const toggleCheck = (id: string) => setChecked(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const toggleAll = () => setChecked(checked.size === paginated.length ? new Set() : new Set(paginated.map(o => o.id)))

  const applyBulk = useCallback(async () => {
    if (!bulkStatus || checked.size === 0) return
    setBulkLoading(true)
    try {
      await Promise.all([...checked].map(id => onStatusChange(id, bulkStatus)))
      toast.success(`${checked.size} поръчки → ${STATUS_LABELS[bulkStatus]?.label}`)
      setChecked(new Set()); setBulkStatus('')
    } catch { toast.error('Грешка') }
    finally { setBulkLoading(false) }
  }, [checked, bulkStatus, onStatusChange])

  const exportCSV = () => {
    const rows = [
      ['Номер','Клиент','Телефон','Имейл','Адрес','Град','Куриер','Плащане','Статус','Статус плащане','Сума (€)','Дата'],
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
    a.href = URL.createObjectURL(blob); a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    toast.success(`Изтеглени ${filtered.length} поръчки`)
  }

  const rowPad = density === 'compact' ? '7px 14px' : '11px 14px'

  return (
    <div style={{ padding: '24px 28px' }}>
      <style>{`
        .order-tr{transition:background .1s;cursor:pointer}
        .order-tr:hover td{background:#f9fafb!important}
        .filter-btn{transition:all .15s;cursor:pointer;font-family:inherit}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Поръчки</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {filtered.length} резултата · <strong style={{ color: '#16a34a' }}>{formatPrice(totalRevenue)}</strong> приход
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Density toggle */}
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, gap: 2 }}>
            {(['comfortable', 'compact'] as const).map(d => (
              <button key={d} onClick={() => setDensity(d)}
                style={{ padding: '5px 10px', borderRadius: 6, border: 'none', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                  background: density === d ? '#fff' : 'transparent',
                  color: density === d ? '#111' : '#9ca3af',
                  boxShadow: density === d ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
                {d === 'comfortable' ? '⬛ Комфортен' : '▪ Компактен'}
              </button>
            ))}
          </div>
          <input placeholder="🔍 Търси по номер, клиент, телефон..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, width: 280, background: '#fff', color: 'var(--text)', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = '#2d6a4f'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          <button onClick={exportCSV}
            style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {ORDER_STATUSES.map(s => {
          const count    = orders.filter(o => s === 'all' ? true : o.status === s).length
          const cfg      = s !== 'all' ? STATUS_LABELS[s] : null
          const isActive = filter === s
          return (
            <button key={s} className="filter-btn"
              onClick={() => { setFilter(s); setPage(1); setChecked(new Set()) }}
              style={{ padding: '6px 12px', border: `1px solid ${isActive && cfg ? cfg.color + '55' : 'var(--border)'}`,
                borderRadius: 99, background: isActive ? (cfg ? cfg.bg : '#111') : '#fff',
                fontSize: 12.5, fontWeight: 500,
                color: isActive ? (cfg ? cfg.color : '#fff') : 'var(--muted)',
                display: 'flex', alignItems: 'center', gap: 5 }}>
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
            {Object.entries(STATUS_LABELS).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ width: 40, padding: '11px 14px', background: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={checked.size === paginated.length && paginated.length > 0} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                <SortTh label="Номер"   field="date"   sort={sort} dir={sortDir} onSort={handleSort} />
                <SortTh label="Клиент"  field="name"   sort={sort} dir={sortDir} onSort={handleSort} />
                <th style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)', background: '#f9fafb', whiteSpace: 'nowrap' }}>Куриер</th>
                <SortTh label="Статус"  field="status" sort={sort} dir={sortDir} onSort={handleSort} />
                <SortTh label="Сума"    field="total"  sort={sort} dir={sortDir} onSort={handleSort} />
                <SortTh label="Дата"    field="date"   sort={sort} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 48, fontSize: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>Няма поръчки
                </td></tr>
              )}
              {paginated.map(o => (
                <tr key={o.id} className="order-tr"
                  style={{ background: checked.has(o.id) ? '#f0fdf4' : '' }}>
                  <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={checked.has(o.id)} onChange={() => toggleCheck(o.id)} style={{ cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5' }} onClick={() => setSelected(o)}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{o.order_number}</span>
                  </td>
                  <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5' }} onClick={() => setSelected(o)}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{o.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.customer_phone}</div>
                  </td>
                  <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5', fontSize: 12, color: '#6b7280' }} onClick={() => setSelected(o)}>
                    {o.courier ? COURIER_LABELS[o.courier]?.label : 'Еконт'}
                  </td>
                  {/* Inline status — click stops propagation */}
                  <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5' }} onClick={e => e.stopPropagation()}>
                    <InlineStatusSelect order={o} onStatusChange={onStatusChange} />
                  </td>
                  <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5', fontWeight: 700, textAlign: 'right', color: '#16a34a', whiteSpace: 'nowrap' }} onClick={() => setSelected(o)}>
                    {formatPrice(o.total)}
                  </td>
                  <td style={{ padding: rowPad, borderBottom: '1px solid #f5f5f5', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }} onClick={() => setSelected(o)}>
                    {new Date(o.created_at).toLocaleDateString('bg-BG', { day: '2-digit', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18 }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, opacity: page === 1 ? .4 : 1 }}>
            ← Назад
          </button>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = i + 1
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer',
                    background: page === p ? '#1b4332' : '#fff', color: page === p ? '#fff' : 'var(--text)', fontWeight: page === p ? 700 : 400 }}>
                  {p}
                </button>
              )
            })}
          </div>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
            style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, opacity: page === totalPages ? .4 : 1 }}>
            Напред →
          </button>
        </div>
      )}

      {selected && (
        <OrderModal order={selected} onClose={() => setSelected(null)}
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
