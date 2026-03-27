'use client'
// app/admin/components/LeadsTab.tsx

import { useState, useMemo } from 'react'
import type { Lead } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'

interface Props {
  leads: Lead[]
}

export function LeadsTab({ leads }: Props) {
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<'all' | 'subscribed' | 'unsubscribed'>('all')
  const [page, setPage]       = useState(1)
  const PAGE_SIZE = 20

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return leads
      .filter(l => filter === 'all' ? true : filter === 'subscribed' ? l.subscribed : !l.subscribed)
      .filter(l => !q || l.email.toLowerCase().includes(q) || l.name?.toLowerCase().includes(q))
  }, [leads, search, filter])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const exportCSV = () => {
    const rows = [
      ['Email', 'Имe', 'Телефон', 'Източник', 'Абониран', 'Дата'],
      ...leads.map(l => [
        l.email,
        l.name || '',
        l.phone || '',
        l.source,
        l.subscribed ? 'Да' : 'Не',
        new Date(l.created_at).toLocaleDateString('bg-BG'),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Изтеглени ${leads.length} контакта`)
  }

  const copyAllEmails = () => {
    const emails = filtered.filter(l => l.subscribed).map(l => l.email).join(', ')
    navigator.clipboard.writeText(emails)
    toast.success(`${filtered.filter(l => l.subscribed).length} имейла копирани`)
  }

  const sourceCounts = useMemo(() => {
    const m: Record<string, number> = {}
    leads.forEach(l => { m[l.source] = (m[l.source] || 0) + 1 })
    return m
  }, [leads])

  return (
    <div className="leads-root">
      <div className="leads-header">
        <div>
          <h1 className="page-title">Email листа</h1>
          <p className="page-sub">{leads.filter(l => l.subscribed).length} активни абоната</p>
        </div>
        <div className="leads-actions">
          <button className="btn-secondary" onClick={copyAllEmails}>
            ⊕ Копирай имейли
          </button>
          <button className="btn-primary" onClick={exportCSV}>
            ↓ Изтегли CSV
          </button>
        </div>
      </div>

      {/* Source stats */}
      <div className="source-grid">
        {Object.entries(sourceCounts).map(([src, cnt]) => (
          <div key={src} className="source-card">
            <span className="source-label">{src}</span>
            <span className="source-count">{cnt}</span>
          </div>
        ))}
        <div className="source-card source-total">
          <span className="source-label">Общо</span>
          <span className="source-count">{leads.length}</span>
        </div>
      </div>

      {/* Filters + search */}
      <div className="leads-filters">
        <div className="filter-row">
          {(['all', 'subscribed', 'unsubscribed'] as const).map(f => (
            <button
              key={f}
              className={`filter-chip${filter === f ? ' active' : ''}`}
              onClick={() => { setFilter(f); setPage(1) }}
            >
              {f === 'all' ? 'Всички' : f === 'subscribed' ? 'Активни' : 'Отписани'}
              <span className="chip-count">
                {f === 'all' ? leads.length :
                 f === 'subscribed' ? leads.filter(l => l.subscribed).length :
                 leads.filter(l => !l.subscribed).length}
              </span>
            </button>
          ))}
        </div>
        <input
          className="search-box"
          placeholder="Търси по имейл или име..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="leads-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Имe</th>
              <th>Телефон</th>
              <th>Източник</th>
              <th>Статус</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr><td colSpan={6} className="empty-row">Няма резултати</td></tr>
            )}
            {paginated.map(l => (
              <tr key={l.id} className="lead-row">
                <td>
                  <a href={`mailto:${l.email}`} className="email-link">{l.email}</a>
                </td>
                <td>{l.name || <span className="empty-val">—</span>}</td>
                <td>{l.phone || <span className="empty-val">—</span>}</td>
                <td><span className="source-badge">{l.source}</span></td>
                <td>
                  <span className={`sub-pill${l.subscribed ? ' sub' : ' unsub'}`}>
                    {l.subscribed ? 'Активен' : 'Отписан'}
                  </span>
                </td>
                <td className="date-cell">
                  {new Date(l.created_at).toLocaleDateString('bg-BG', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Назад</button>
          <span className="page-info">{page} / {totalPages}</span>
          <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Напред →</button>
        </div>
      )}

      <style>{`
        .leads-root { padding: 28px 32px; }
        .leads-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; gap: 16px; flex-wrap: wrap; }
        .page-title { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -.02em; }
        .page-sub { font-size: 13px; color: var(--muted); margin-top: 2px; }
        .leads-actions { display: flex; gap: 8px; }
        .btn-primary {
          background: var(--green); color: #fff; border: none; border-radius: 8px;
          padding: 8px 16px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 500;
          transition: opacity .2s;
        }
        .btn-primary:hover { opacity: .88; }
        .btn-secondary {
          background: #fff; border: 1px solid var(--border); border-radius: 8px;
          padding: 8px 14px; cursor: pointer; font-family: inherit; font-size: 13px; color: var(--text);
          transition: all .15s;
        }
        .btn-secondary:hover { border-color: var(--green); color: var(--green); }

        .source-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
        .source-card {
          background: #fff; border: 1px solid var(--border); border-radius: 10px;
          padding: 10px 16px; display: flex; align-items: center; gap: 10px;
        }
        .source-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
        .source-count { font-size: 18px; font-weight: 700; color: var(--text); }
        .source-total { border-color: var(--green); }
        .source-total .source-count { color: var(--green); }

        .leads-filters { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
        .filter-row { display: flex; gap: 6px; }
        .filter-chip {
          padding: 6px 12px; border: 1px solid var(--border); border-radius: 99px;
          background: #fff; cursor: pointer; font-family: inherit; font-size: 12.5px;
          color: var(--muted); display: flex; align-items: center; gap: 5px; transition: all .15s;
        }
        .filter-chip.active { background: var(--text); color: #fff; border-color: var(--text); }
        .chip-count { background: rgba(0,0,0,.08); border-radius: 99px; padding: 1px 6px; font-size: 11px; }
        .search-box {
          padding: 8px 14px; border: 1px solid var(--border); border-radius: 9px;
          font-family: inherit; font-size: 13px; width: 260px;
        }
        .search-box:focus { outline: none; border-color: var(--green); }

        .table-wrap { background: #fff; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .leads-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .leads-table th {
          padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 600;
          color: var(--muted); text-transform: uppercase; letter-spacing: .05em;
          border-bottom: 1px solid var(--border); background: #f9fafb;
        }
        .leads-table td { padding: 11px 14px; border-bottom: 1px solid #f5f5f5; vertical-align: middle; }
        .lead-row:hover { background: #fafcff; }
        .email-link { color: var(--green); text-decoration: none; font-size: 13px; }
        .email-link:hover { text-decoration: underline; }
        .empty-val { color: #ccc; }
        .source-badge {
          background: #ede9fe; color: #5b21b6; padding: 2px 8px;
          border-radius: 6px; font-size: 11px; font-weight: 500;
        }
        .sub-pill { padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 600; }
        .sub-pill.sub { background: #d1fae5; color: #065f46; }
        .sub-pill.unsub { background: #f3f4f6; color: #6b7280; }
        .date-cell { font-size: 12px; color: var(--muted); white-space: nowrap; }
        .empty-row { text-align: center; color: var(--muted); padding: 48px !important; font-size: 14px; }
        .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 18px; }
        .page-btn {
          padding: 7px 16px; border: 1px solid var(--border); border-radius: 8px;
          background: #fff; cursor: pointer; font-family: inherit; font-size: 13px; transition: all .15s;
        }
        .page-btn:hover:not(:disabled) { border-color: var(--green); color: var(--green); }
        .page-btn:disabled { opacity: .4; cursor: default; }
        .page-info { font-size: 13px; color: var(--muted); }
      `}</style>
    </div>
  )
}
