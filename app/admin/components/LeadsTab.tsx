'use client'
// app/admin/components/LeadsTab.tsx — v4 с tags, broadcast, segmentation

import { useState, useMemo, useCallback } from 'react'
import type { Lead } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'

const PAGE_SIZE = 20

interface Props { leads: Lead[] }

export function LeadsTab({ leads }: Props) {
  const [search, setSearch]           = useState('')
  const [filter, setFilter]           = useState<'all' | 'subscribed' | 'unsubscribed'>('all')
  const [page, setPage]               = useState(1)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastBody, setBroadcastBody]       = useState('')
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [selectedTag, setSelectedTag] = useState('')

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    leads.forEach(l => (l.tags || []).forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [leads])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return leads
      .filter(l => filter === 'all' ? true : filter === 'subscribed' ? l.subscribed : !l.subscribed)
      .filter(l => !selectedTag || (l.tags || []).includes(selectedTag))
      .filter(l => !q || l.email.toLowerCase().includes(q) || (l.name || '').toLowerCase().includes(q))
  }, [leads, filter, search, selectedTag])

  const subscribed = useMemo(() => leads.filter(l => l.subscribed), [leads])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const exportCSV = () => {
    const rows = [
      ['Имейл','Имена','Телефон','Наръчник','Статус','Тагове','UTM Source','Дата'],
      ...filtered.map(l => [
        l.email, l.name || '', l.phone || '',
        l.naruchnik_slug || '', l.subscribed ? 'Активен' : 'Отписан',
        (l.tags || []).join(';'), l.utm_source || '',
        new Date(l.created_at).toLocaleDateString('bg-BG'),
      ]),
    ]
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const a    = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    toast.success(`Изтеглени ${filtered.length} контакта`)
  }

  const copyEmails = () => {
    const emails = subscribed.map(l => l.email).join(', ')
    navigator.clipboard.writeText(emails)
    toast.success(`${subscribed.length} имейла копирани`)
  }

  const sendBroadcast = useCallback(async () => {
    if (!broadcastSubject.trim() || !broadcastBody.trim()) {
      toast.error('Попълни темата и съдържанието')
      return
    }
    setBroadcastSending(true)
    try {
      const res = await fetch('/api/leads/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: broadcastSubject,
          body:    broadcastBody,
          tags:    selectedTag ? [selectedTag] : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`✓ Изпратено до ${data.sent} абоната`)
      setBroadcastOpen(false)
      setBroadcastSubject('')
      setBroadcastBody('')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBroadcastSending(false)
    }
  }, [broadcastSubject, broadcastBody, selectedTag])

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Email листа</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            {subscribed.length} активни · {leads.length} общо
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={copyEmails} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            📋 Копирай имейли
          </button>
          <button onClick={exportCSV} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            ↓ CSV
          </button>
          <button onClick={() => setBroadcastOpen(true)} style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
            ✉️ Broadcast
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Активни',    value: subscribed.length,                               color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Отписани',   value: leads.filter(l => !l.subscribed).length,          color: '#ef4444', bg: '#fef2f2' },
          { label: 'Конверсия',  value: `${leads.length ? Math.round(subscribed.length/leads.length*100) : 0}%`, color: '#0ea5e9', bg: '#f0f9ff' },
          { label: 'Имейл теми', value: allTags.length,                                   color: '#8b5cf6', bg: '#faf5ff' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}22`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍 Търси по имейл или имена..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, width: 260, outline: 'none', background: '#fff' }}
          onFocus={e => e.target.style.borderColor = '#2d6a4f'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        {(['all','subscribed','unsubscribed'] as const).map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1) }}
            style={{ padding: '6px 14px', borderRadius: 99, border: `1px solid ${filter===f?'#2d6a4f':'var(--border)'}`, background: filter===f?'#2d6a4f':'#fff', color: filter===f?'#fff':'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500 }}>
            {f === 'all' ? 'Всички' : f === 'subscribed' ? 'Активни' : 'Отписани'}
          </button>
        ))}
        {allTags.length > 0 && (
          <select value={selectedTag} onChange={e => { setSelectedTag(e.target.value); setPage(1) }}
            style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', background: '#fff' }}>
            <option value="">Всички тагове</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 560 }}>
            <thead>
              <tr>
                {['Имейл','Имена','Наръчник','Тагове','Статус','Дата'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)', background: '#f9fafb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 48 }}>Няма резултати</td></tr>
              )}
              {paginated.map(l => (
                <tr key={l.id}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f9fafb'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                >
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f5f5f5' }}>
                    <a href={`mailto:${l.email}`} style={{ color: '#2d6a4f', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>{l.email}</a>
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f5f5f5', fontSize: 13, color: '#374151' }}>
                    {l.name || <span style={{ color: '#d1d5db' }}>—</span>}
                    {l.phone && <div style={{ fontSize: 11, color: '#9ca3af' }}>{l.phone}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f5f5f5', fontSize: 12, color: '#6b7280' }}>
                    {l.naruchnik_slug || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f5f5f5' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(l.tags || []).map(tag => (
                        <span key={tag} style={{ fontSize: 10, padding: '2px 7px', background: '#ede9fe', color: '#5b21b6', borderRadius: 99, fontWeight: 700 }}>{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f5f5f5' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 700, background: l.subscribed ? '#d1fae5' : '#fee2e2', color: l.subscribed ? '#065f46' : '#991b1b' }}>
                      {l.subscribed ? 'Активен' : 'Отписан'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f5f5f5', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                    {new Date(l.created_at).toLocaleDateString('bg-BG', { day: '2-digit', month: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18 }}>
          <button disabled={page===1} onClick={() => setPage(p=>p-1)} style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>← Назад</button>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{page} / {totalPages}</span>
          <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)} style={{ padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Напред →</button>
        </div>
      )}

      {/* Broadcast modal */}
      {broadcastOpen && (
        <div style={{ 
  position: 'fixed', 
  inset: 0, 
  background: 'rgba(0,0,0,.5)', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center', 
  padding: 20, 
  zIndex: 200 
}}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 560, boxShadow: '0 24px 60px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>✉️ Broadcast имейл</h2>
              <button onClick={() => setBroadcastOpen(false)} style={{ background: '#f5f5f5', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
              ⚠️ Ще бъде изпратено до <strong>{selectedTag ? filtered.filter(l=>l.subscribed).length : subscribed.length}</strong> активни абоната.
              {selectedTag && ` (таг: ${selectedTag})`} Използвай <code>{'{{name}}'}</code> за персонализация.
            </div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Тема</label>
            <input value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} placeholder="Тема на имейла..."
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontFamily: 'inherit', fontSize: 14, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor='#2d6a4f'} onBlur={e => e.target.style.borderColor='#e5e7eb'} />
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Съдържание (HTML или текст)</label>
            <textarea value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)} rows={8} placeholder={'Здравей, {{name}}!\n\nСъдържание на имейла...'}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontFamily: 'monospace', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }}
              onFocus={e => e.target.style.borderColor='#2d6a4f'} onBlur={e => e.target.style.borderColor='#e5e7eb'} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setBroadcastOpen(false)} style={{ padding: '10px 20px', border: '1px solid var(--border)', borderRadius: 10, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Отказ</button>
              <button onClick={sendBroadcast} disabled={broadcastSending}
                style={{ padding: '10px 24px', background: '#1b4332', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, opacity: broadcastSending ? .6 : 1 }}>
                {broadcastSending ? '⏳ Изпраща...' : '✉️ Изпрати'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
