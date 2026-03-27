'use client'
// app/admin/components/LeadsTab.tsx — v3 с email изпращане

import { useState, useMemo } from 'react'
import type { Lead } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'

interface Props { leads: Lead[] }

export function LeadsTab({ leads }: Props) {
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<'all' | 'subscribed' | 'unsubscribed'>('all')
  const [page, setPage]         = useState(1)
  const [showEmail, setShowEmail] = useState(false)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody]       = useState('')
  const [sending, setSending]           = useState(false)
  const PAGE_SIZE = 20

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return leads
      .filter(l => filter === 'all' ? true : filter === 'subscribed' ? l.subscribed : !l.subscribed)
      .filter(l => !q || l.email.toLowerCase().includes(q) || l.name?.toLowerCase().includes(q))
  }, [leads, search, filter])

  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const activeLeads = leads.filter(l => l.subscribed)

  const exportCSV = () => {
    const rows = [
      ['Email', 'Имe', 'Телефон', 'Източник', 'Абониран', 'Наръчник', 'Дата'],
      ...leads.map(l => [
        l.email, l.name || '', l.phone || '', l.source,
        l.subscribed ? 'Да' : 'Не',
        (l as any).naruchnik_slug || '',
        new Date(l.created_at).toLocaleDateString('bg-BG'),
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    toast.success(`Изтеглени ${leads.length} контакта`)
  }

  const copyAllEmails = () => {
    const emails = activeLeads.map(l => l.email).join(', ')
    navigator.clipboard.writeText(emails)
    toast.success(`${activeLeads.length} имейла копирани`)
  }

  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error('Въведи тема и съдържание')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/leads/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: emailSubject, body: emailBody }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка')
      toast.success(`Изпратено до ${data.sent} абоната!`)
      setShowEmail(false)
      setEmailSubject('')
      setEmailBody('')
    } catch (err: any) {
      toast.error(err.message || 'Грешка при изпращане')
    } finally { setSending(false) }
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
          <p className="page-sub">{activeLeads.length} активни абоната · {leads.length} общо</p>
        </div>
        <div className="leads-actions">
          <button className="btn-secondary" onClick={copyAllEmails}>⊕ Копирай имейли</button>
          <button className="btn-secondary" onClick={() => setShowEmail(true)} style={{ borderColor: '#0ea5e9', color: '#0ea5e9' }}>✉ Изпрати имейл</button>
          <button className="btn-primary" onClick={exportCSV}>↓ CSV</button>
        </div>
      </div>

      {/* Source stats */}
      <div className="source-grid">
        <div className="source-card source-total">
          <span className="source-label">Общо</span>
          <span className="source-count">{leads.length}</span>
        </div>
        <div className="source-card" style={{ borderColor: '#d1fae5' }}>
          <span className="source-label">Активни</span>
          <span className="source-count" style={{ color: '#16a34a' }}>{activeLeads.length}</span>
        </div>
        {Object.entries(sourceCounts).map(([src, cnt]) => (
          <div key={src} className="source-card">
            <span className="source-label">{src}</span>
            <span className="source-count">{cnt}</span>
          </div>
        ))}
      </div>

      {/* Email broadcast modal */}
      {showEmail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>✉ Изпрати имейл до абонатите</h2>
              <button onClick={() => setShowEmail(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#0369a1' }}>
              📧 Ще бъде изпратено до <strong>{activeLeads.length}</strong> активни абоната
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Тема *</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="напр. Нови продукти за пролетта 🌱"
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Съдържание * (HTML е поддържан)</label>
                <textarea
                  rows={8}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                  placeholder="Здравей {{name}},&#10;&#10;Пишем ти защото..."
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 13, fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Използвай {'{{name}}'} за лично обръщение</p>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowEmail(false)} style={{ padding: '10px 20px', border: '1px solid #e5e7eb', borderRadius: 9, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Откажи</button>
                <button onClick={sendEmail} disabled={sending} style={{ padding: '10px 24px', background: sending ? '#9ca3af' : '#0ea5e9', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                  {sending ? 'Изпраща...' : `✉ Изпрати до ${activeLeads.length} абоната`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
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
                {f === 'all' ? leads.length : f === 'subscribed' ? activeLeads.length : leads.filter(l => !l.subscribed).length}
              </span>
            </button>
          ))}
        </div>
        <input
          className="search-box"
          placeholder="🔍 Търси по имейл или име..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {/* Table */}
      <div className="table-wrap">
        <div style={{ overflowX: 'auto' }}>
          <table className="leads-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Имe</th>
                <th className="hide-mobile">Телефон</th>
                <th className="hide-mobile">Наръчник</th>
                <th>Статус</th>
                <th className="hide-mobile">Дата</th>
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
                  <td className="hide-mobile">{l.phone || <span className="empty-val">—</span>}</td>
                  <td className="hide-mobile">
                    {(l as any).naruchnik_slug ? (
                      <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                        {(l as any).naruchnik_slug}
                      </span>
                    ) : <span className="empty-val">—</span>}
                  </td>
                  <td>
                    <span className={`sub-pill${l.subscribed ? ' sub' : ' unsub'}`}>
                      {l.subscribed ? 'Активен' : 'Отписан'}
                    </span>
                  </td>
                  <td className="date-cell hide-mobile">
                    {new Date(l.created_at).toLocaleDateString('bg-BG', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Назад</button>
          <span className="page-info">{page} / {totalPages} · {filtered.length} контакта</span>
          <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Напред →</button>
        </div>
      )}

      <style>{`
        .leads-root { padding: 24px 28px; }
        @media(max-width:768px){ .leads-root { padding: 16px; } }
        .leads-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; gap:12px; flex-wrap:wrap; }
        .page-title { font-size:22px; font-weight:700; color:var(--text); letter-spacing:-.02em; }
        .page-sub { font-size:13px; color:var(--muted); margin-top:2px; }
        .leads-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .btn-primary { background:var(--green); color:#fff; border:none; border-radius:8px; padding:9px 16px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:600; transition:opacity .2s; white-space:nowrap; }
        .btn-primary:hover { opacity:.88; }
        .btn-secondary { background:#fff; border:1px solid var(--border); border-radius:8px; padding:9px 14px; cursor:pointer; font-family:inherit; font-size:13px; color:var(--text); transition:all .15s; white-space:nowrap; }
        .btn-secondary:hover { border-color:var(--green); color:var(--green); }
        .source-grid { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px; }
        .source-card { background:#fff; border:1px solid var(--border); border-radius:10px; padding:10px 16px; display:flex; align-items:center; gap:10px; }
        .source-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
        .source-count { font-size:18px; font-weight:800; color:var(--text); }
        .source-total { border-color:#2d6a4f; }
        .source-total .source-count { color:#2d6a4f; }
        .leads-filters { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; gap:12px; flex-wrap:wrap; }
        .filter-row { display:flex; gap:6px; flex-wrap:wrap; }
        .filter-chip { padding:6px 12px; border:1px solid var(--border); border-radius:99px; background:#fff; cursor:pointer; font-family:inherit; font-size:12.5px; color:var(--muted); display:flex; align-items:center; gap:5px; transition:all .15s; }
        .filter-chip.active { background:var(--text); color:#fff; border-color:var(--text); }
        .chip-count { background:rgba(0,0,0,.08); border-radius:99px; padding:1px 6px; font-size:11px; }
        .search-box { padding:8px 14px; border:1px solid var(--border); border-radius:9px; font-family:inherit; font-size:13px; outline:none; min-width:220px; }
        .search-box:focus { border-color:var(--green); }
        .table-wrap { background:#fff; border:1px solid var(--border); border-radius:12px; overflow:hidden; }
        .leads-table { width:100%; border-collapse:collapse; font-size:13.5px; min-width:500px; }
        .leads-table th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid var(--border); background:#f9fafb; }
        .leads-table td { padding:11px 14px; border-bottom:1px solid #f5f5f5; vertical-align:middle; }
        .lead-row:hover { background:#fafcff; }
        .email-link { color:var(--green); text-decoration:none; font-size:13px; }
        .email-link:hover { text-decoration:underline; }
        .empty-val { color:#ccc; }
        .sub-pill { padding:3px 9px; border-radius:99px; font-size:11px; font-weight:700; }
        .sub-pill.sub { background:#d1fae5; color:#065f46; }
        .sub-pill.unsub { background:#f3f4f6; color:#6b7280; }
        .date-cell { font-size:12px; color:var(--muted); white-space:nowrap; }
        .empty-row { text-align:center; color:var(--muted); padding:48px !important; font-size:14px; }
        .pagination { display:flex; align-items:center; justify-content:center; gap:16px; margin-top:18px; }
        .page-btn { padding:7px 16px; border:1px solid var(--border); border-radius:8px; background:#fff; cursor:pointer; font-family:inherit; font-size:13px; transition:all .15s; }
        .page-btn:hover:not(:disabled) { border-color:var(--green); color:var(--green); }
        .page-btn:disabled { opacity:.4; cursor:default; }
        .page-info { font-size:13px; color:var(--muted); }
        @media(max-width:600px){ .hide-mobile { display:none; } }
      `}</style>
    </div>
  )
}
