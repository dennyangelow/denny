'use client'

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
      .filter(l => !q || l.email.toLowerCase().includes(q) || l.name?.toLowerCase().includes(q) || l.phone?.includes(q))
  }, [leads, search, filter])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const exportCSV = () => {
    if (leads.length === 0) return toast.error('Няма данни за изтегляне')
    
    const rows = [
      ['Email', 'Име', 'Телефон', 'Източник', 'Абониран', 'Дата'],
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
    toast.success(`Експортирани ${leads.length} контакта`)
  }

  const copyAllEmails = () => {
    const activeLeads = filtered.filter(l => l.subscribed)
    if (activeLeads.length === 0) return toast.error('Няма активни имейли за копиране')
    
    const emails = activeLeads.map(l => l.email).join(', ')
    navigator.clipboard.writeText(emails)
    toast.success(`${activeLeads.length} имейла са копирани в клипборда`)
  }

  const sourceCounts = useMemo(() => {
    const m: Record<string, number> = {}
    leads.forEach(l => { m[l.source] = (m[l.source] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]) // Сортиране по популярност
  }, [leads])

  return (
    <div className="leads-root">
      <div className="leads-header">
        <div className="header-text">
          <h1 className="page-title">Маркетинг контакти</h1>
          <p className="page-sub">Общо <strong>{leads.filter(l => l.subscribed).length}</strong> активни абоната в базата</p>
        </div>
        <div className="leads-actions">
          <button className="btn-secondary" onClick={copyAllEmails}>
            <span className="icon">📋</span> Копирай активните
          </button>
          <button className="btn-primary" onClick={exportCSV}>
            <span className="icon">↓</span> Експорт (CSV)
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="source-grid">
        <div className="source-card source-total">
          <div className="card-info">
            <span className="source-label">Всички контакти</span>
            <span className="source-count">{leads.length}</span>
          </div>
          <div className="card-icon">👥</div>
        </div>
        {sourceCounts.map(([src, cnt]) => (
          <div key={src} className="source-card">
            <div className="card-info">
              <span className="source-label">{src || 'Директни'}</span>
              <span className="source-count">{cnt}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Area */}
      <div className="leads-filters">
        <div className="filter-group">
          {(['all', 'subscribed', 'unsubscribed'] as const).map(f => (
            <button
              key={f}
              className={`filter-chip${filter === f ? ' active' : ''}`}
              onClick={() => { setFilter(f); setPage(1) }}
            >
              {f === 'all' ? 'Всички' : f === 'subscribed' ? 'Абонирани' : 'Отписани'}
              <span className="chip-count">
                {f === 'all' ? leads.length :
                 f === 'subscribed' ? leads.filter(l => l.subscribed).length :
                 leads.filter(l => !l.subscribed).length}
              </span>
            </button>
          ))}
        </div>
        <div className="search-wrapper">
          <input
            className="search-box"
            placeholder="Търси име, имейл, телефон..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
          {search && <button className="clear-search" onClick={() => setSearch('')}>✕</button>}
        </div>
      </div>

      {/* Table Section */}
      <div className="table-container">
        <table className="leads-table">
          <thead>
            <tr>
              <th>Контакт</th>
              <th>Име</th>
              <th>Телефон</th>
              <th>Източник</th>
              <th>Статус</th>
              <th>Регистрация</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  <div className="empty-content">
                    <span className="empty-icon">🔎</span>
                    <p>Няма намерени резултати за тези критерии</p>
                    {search && <button onClick={() => setSearch('')} className="link-btn">Изчисти търсенето</button>}
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map(l => (
                <tr key={l.id} className="lead-row">
                  <td>
                    <a href={`mailto:${l.email}`} className="email-link">{l.email}</a>
                  </td>
                  <td className="name-cell">{l.name || <span className="empty-dash">—</span>}</td>
                  <td>
                    {l.phone ? (
                      <a href={`tel:${l.phone}`} className="phone-link">{l.phone}</a>
                    ) : (
                      <span className="empty-dash">—</span>
                    )}
                  </td>
                  <td><span className="source-tag">{l.source}</span></td>
                  <td>
                    <span className={`status-pill ${l.subscribed ? 'is-sub' : 'is-unsub'}`}>
                      {l.subscribed ? 'Активен' : 'Отписан'}
                    </span>
                  </td>
                  <td className="date-cell">
                    {new Date(l.created_at).toLocaleDateString('bg-BG', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination-bar">
          <button className="nav-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            ← Предишна
          </button>
          <div className="page-numbers">
             Страница <strong>{page}</strong> от {totalPages}
          </div>
          <button className="nav-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            Следваща →
          </button>
        </div>
      )}

      <style>{`
        .leads-root { padding: 32px; max-width: 1200px; margin: 0 auto; }
        
        .leads-header { 
          display: flex; justify-content: space-between; align-items: center; 
          margin-bottom: 30px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;
        }
        .page-title { font-size: 26px; font-weight: 800; color: #0f172a; }
        .page-sub { color: #64748b; font-size: 14px; margin-top: 4px; }
        
        .leads-actions { display: flex; gap: 12px; }
        .btn-primary, .btn-secondary {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 18px; border-radius: 10px; font-weight: 600; font-size: 14px;
          cursor: pointer; transition: 0.2s;
        }
        .btn-primary { background: #10b981; color: white; border: none; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); }
        .btn-primary:hover { background: #059669; transform: translateY(-1px); }
        .btn-secondary { background: white; border: 1px solid #e2e8f0; color: #475569; }
        .btn-secondary:hover { border-color: #10b981; color: #10b981; }

        .source-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .source-card { 
          background: white; padding: 16px; border-radius: 16px; 
          border: 1px solid #f1f5f9; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          display: flex; justify-content: space-between; align-items: center;
        }
        .source-total { background: #f0fdf4; border-color: #dcfce7; }
        .source-label { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
        .source-count { display: block; font-size: 22px; font-weight: 800; color: #1e293b; margin-top: 4px; }
        .card-icon { font-size: 24px; opacity: 0.8; }

        .leads-filters { 
          display: flex; justify-content: space-between; align-items: center; 
          margin-bottom: 20px; gap: 16px;
        }
        .filter-group { display: flex; background: #f1f5f9; padding: 4px; border-radius: 12px; }
        .filter-chip {
          padding: 8px 16px; border: none; border-radius: 10px; font-size: 13px;
          cursor: pointer; font-weight: 600; color: #64748b; background: transparent;
          display: flex; align-items: center; gap: 6px; transition: 0.2s;
        }
        .filter-chip.active { background: white; color: #0f172a; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .chip-count { font-size: 11px; background: #e2e8f0; padding: 2px 6px; border-radius: 6px; }

        .search-wrapper { position: relative; width: 300px; }
        .search-box {
          width: 100%; padding: 10px 35px 10px 15px; border-radius: 12px;
          border: 1px solid #e2e8f0; font-size: 14px; transition: 0.2s;
        }
        .search-box:focus { border-color: #10b981; outline: none; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1); }
        .clear-search { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); border: none; background: none; color: #cbd5e1; cursor: pointer; }

        .table-container { background: white; border-radius: 16px; border: 1px solid #f1f5f9; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        .leads-table { width: 100%; border-collapse: collapse; text-align: left; }
        .leads-table th { background: #f8fafc; padding: 14px 20px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; }
        .leads-table td { padding: 16px 20px; border-bottom: 1px solid #f8fafc; font-size: 14px; color: #334155; }
        .lead-row:hover { background: #fdfdfd; }
        
        .email-link { color: #2563eb; text-decoration: none; font-weight: 500; }
        .email-link:hover { text-decoration: underline; }
        .phone-link { color: #475569; text-decoration: none; }
        .phone-link:hover { color: #10b981; }
        .name-cell { font-weight: 600; color: #1e293b; }
        .empty-dash { color: #cbd5e1; }
        
        .source-tag { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 12px; color: #475569; }
        .status-pill { padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; }
        .status-pill.is-sub { background: #dcfce7; color: #15803d; }
        .status-pill.is-unsub { background: #f1f5f9; color: #64748b; }
        
        .empty-state { padding: 80px !important; text-align: center; }
        .empty-icon { font-size: 40px; display: block; margin-bottom: 10px; }
        .link-btn { background: none; border: none; color: #10b981; cursor: pointer; font-weight: 600; text-decoration: underline; }

        .pagination-bar { display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 30px; }
        .nav-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 13px; transition: 0.2s; }
        .nav-btn:hover:not(:disabled) { border-color: #10b981; color: #10b981; }
        .nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-numbers { font-size: 14px; color: #64748b; }
      `}</style>
    </div>
  )
}