'use client'
// app/admin/components/SettingsTab.tsx v2

import { useState, useEffect } from 'react'

interface Props { ordersCount: number; leadsCount: number }

const SITE_KEYS = [
  { key: 'hero_title', label: 'Hero заглавие', type: 'text' },
  { key: 'hero_subtitle', label: 'Hero подзаглавие', type: 'textarea' },
  { key: 'hero_warning', label: 'Hero предупреждение', type: 'text' },
  { key: 'site_phone', label: 'Телефон', type: 'text' },
  { key: 'site_email', label: 'Email', type: 'text' },
  { key: 'admin_email', label: 'Admin email (за известия)', type: 'text' },
  { key: 'whatsapp_number', label: 'WhatsApp номер', type: 'text' },
  { key: 'shipping_price', label: 'Цена доставка (лв.)', type: 'number' },
  { key: 'free_shipping_above', label: 'Безплатна доставка над (лв.)', type: 'number' },
]

export function SettingsTab({ ordersCount, leadsCount }: Props) {
  const [vals, setVals] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.settings) setVals(d.settings)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: vals }),
    })
    setSaving(false)
    setToast('✓ Настройките са запазени!')
    setTimeout(() => setToast(''), 2500)
  }

  const links = [
    { label: 'Supabase Dashboard', url: 'https://app.supabase.com', icon: '⬡' },
    { label: 'Resend Dashboard', url: 'https://resend.com/emails', icon: '◉' },
    { label: 'Vercel Dashboard', url: 'https://vercel.com/dashboard', icon: '▲' },
    { label: 'Главна страница', url: '/', icon: '◫' },
  ]

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Зарежда...</div>

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#0d2b1d', color: '#4ade80', padding: '12px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,.25)' }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Настройки</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Системни настройки и информация</p>
      </div>

      {/* Site Settings */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 24, marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18 }}>Настройки на сайта</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {SITE_KEYS.map(k => (
            <div key={k.key}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>{k.label}</label>
              {k.type === 'textarea' ? (
                <textarea
                  rows={3}
                  value={vals[k.key] || ''}
                  onChange={e => setVals(p => ({ ...p, [k.key]: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontFamily: 'inherit', fontSize: 14, outline: 'none', resize: 'vertical' }}
                />
              ) : (
                <input
                  type={k.type}
                  value={vals[k.key] || ''}
                  onChange={e => setVals(p => ({ ...p, [k.key]: e.target.value }))}
                  style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontFamily: 'inherit', fontSize: 14, outline: 'none' }}
                />
              )}
            </div>
          ))}
          <button onClick={save} disabled={saving}
            style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', width: 'fit-content', marginTop: 4 }}>
            {saving ? 'Запазва...' : '✓ Запази настройките'}
          </button>
        </div>
      </div>

      {/* System Info */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 24, marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Системна информация</h2>
        {[
          { label: 'Общо поръчки', value: ordersCount },
          { label: 'Email абоната', value: leadsCount },
          { label: 'Framework', value: 'Next.js 14 App Router' },
          { label: 'База данни', value: 'Supabase (PostgreSQL)' },
          { label: 'Email provider', value: 'Resend' },
          { label: 'Hosting', value: 'Vercel' },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13.5 }}>
            <span style={{ color: '#6b7280' }}>{row.label}</span>
            <span style={{ fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 24, marginBottom: 18 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Бързи линкове</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {links.map(l => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, textDecoration: 'none', color: '#111', fontSize: 13.5, fontWeight: 500 }}>
              <span style={{ color: '#2d6a4f', fontSize: 16 }}>{l.icon}</span>
              <span>{l.label}</span>
              <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 12 }}>↗</span>
            </a>
          ))}
        </div>
      </div>

      {/* Security */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#92400e', marginBottom: 14 }}>⚠ Сигурност</h2>
        {[
          { title: 'ADMIN_SECRET', text: 'Защити /admin с ADMIN_SECRET в .env.local. Без него панелът е публичен!' },
          { title: 'RLS в Supabase', text: 'Row Level Security е активирана. Само authenticated потребители могат да четат поръчки и leads.' },
          { title: 'Service Role Key', text: 'Никога не я излагай в client-side код. Използвай само в API routes.' },
        ].map(w => (
          <div key={w.title} style={{ fontSize: 13.5, color: '#78350f', lineHeight: 1.6, marginBottom: 10 }}>
            <strong style={{ color: '#92400e' }}>{w.title}</strong> — {w.text}
          </div>
        ))}
      </div>
    </div>
  )
}
