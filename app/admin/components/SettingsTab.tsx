'use client'
// app/admin/components/SettingsTab.tsx — v3 финална

import { useState, useEffect } from 'react'
import { toast } from '@/components/ui/Toast'

interface Props { ordersCount: number; leadsCount: number }

const SECTIONS = [
  {
    id: 'hero', label: '🏠 Главна страница', keys: [
      { key: 'hero_title',    label: 'Главно заглавие',   type: 'text',     placeholder: 'Искаш едри, здрави и сочни домати?' },
      { key: 'hero_subtitle', label: 'Подзаглавие',        type: 'textarea', placeholder: 'Описание под заглавието...' },
      { key: 'hero_warning',  label: 'Предупреждение',     type: 'text',     placeholder: 'Не рискувай да изхвърлиш продукцията...' },
    ]
  },
  {
    id: 'contacts', label: '📞 Контакти & Известия', keys: [
      { key: 'site_phone',      label: 'Телефон за клиенти',       type: 'tel',    placeholder: '+359 88 888 8888' },
      { key: 'site_email',      label: 'Email за клиенти',         type: 'email',  placeholder: 'support@dennyangelow.com' },
      { key: 'admin_email',     label: 'Admin email (нови поръчки)', type: 'email', placeholder: 'denny@dennyangelow.com' },
      { key: 'whatsapp_number', label: 'WhatsApp номер (само цифри)', type: 'text', placeholder: '359888888888' },
    ]
  },
  {
    id: 'shipping', label: '📦 Доставка & Цени', keys: [
      { key: 'shipping_price',      label: 'Цена доставка (лв.)',           type: 'number', placeholder: '5.99' },
      { key: 'free_shipping_above', label: 'Безплатна доставка над (лв.)',  type: 'number', placeholder: '60' },
    ]
  },
]

const LINKS = [
  { label: 'Supabase Dashboard', url: 'https://app.supabase.com', icon: '⬡', color: '#3ecf8e' },
  { label: 'Resend Dashboard',   url: 'https://resend.com/emails', icon: '✉', color: '#0ea5e9' },
  { label: 'Vercel Dashboard',   url: 'https://vercel.com/dashboard', icon: '▲', color: '#111' },
  { label: 'Главна страница',    url: '/', icon: '◫', color: '#6b7280' },
]

function validateVals(vals: Record<string, string>): string[] {
  const errors: string[] = []
  const sp = parseFloat(vals.shipping_price || '0')
  if (vals.shipping_price && (isNaN(sp) || sp < 0)) errors.push('Цената за доставка трябва да е положително число')
  const fs = parseFloat(vals.free_shipping_above || '0')
  if (vals.free_shipping_above && (isNaN(fs) || fs < 0)) errors.push('Прагът за безплатна доставка трябва да е положително число')
  return errors
}

export function SettingsTab({ ordersCount, leadsCount }: Props) {
  const [vals, setVals]       = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [dirty, setDirty]     = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => { if (d.settings) setVals(d.settings); setLoading(false) })
      .catch(() => { toast.error('Грешка при зареждане на настройките'); setLoading(false) })
  }, [])

  const set = (key: string, val: string) => {
    setVals(p => ({ ...p, [key]: val }))
    setDirty(true)
  }

  const save = async () => {
    const errs = validateVals(vals)
    if (errs.length > 0) { errs.forEach(e => toast.error(e)); return }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: vals }),
      })
      if (!res.ok) throw new Error()
      toast.success('Настройките са запазени успешно!')
      setDirty(false)
    } catch { toast.error('Грешка при запазване на настройките') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontSize: 14 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', borderRadius: '50%', animation: 'spin .7s linear infinite', marginRight: 12 }} />
      Зарежда настройките...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div className="st-root">
      {/* Header */}
      <div className="st-header">
        <div>
          <h1 className="st-title">Настройки</h1>
          <p className="st-sub">Управление на глобалните параметри на сайта</p>
        </div>
        <button onClick={save} disabled={saving || !dirty} className={`st-save-btn${dirty ? ' dirty' : ''}`}>
          {saving ? '⏳ Запазва...' : '✓ Запази промените'}
        </button>
      </div>

      <div className="st-grid">
        <div className="st-main">
          {SECTIONS.map(section => (
            <div key={section.id} className="st-card">
              <h2 className="st-section-title">{section.label}</h2>
              <div className="st-fields">
                {section.keys.map(k => (
                  <div key={k.key} className="st-field">
                    <label className="st-label">{k.label}</label>
                    {k.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        value={vals[k.key] || ''}
                        onChange={e => set(k.key, e.target.value)}
                        placeholder={k.placeholder}
                        className="st-input"
                        style={{ resize: 'vertical' }}
                      />
                    ) : (
                      <input
                        type={k.type}
                        value={vals[k.key] || ''}
                        onChange={e => set(k.key, e.target.value)}
                        placeholder={k.placeholder}
                        className="st-input"
                        step={k.type === 'number' ? '0.01' : undefined}
                        min={k.type === 'number' ? '0' : undefined}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="st-sidebar">
          {/* Статус */}
          <div className="st-card">
            <h2 className="st-section-title">📊 Статус на системата</h2>
            {[
              { label: 'Общо поръчки',   value: ordersCount, color: '#16a34a' },
              { label: 'Email абоната',  value: leadsCount,  color: '#0ea5e9' },
              { label: 'Framework',      value: 'Next.js 14' },
              { label: 'База данни',     value: 'Supabase' },
              { label: 'Email',          value: 'Resend' },
              { label: 'Hosting',        value: 'Vercel' },
            ].map(row => (
              <div key={row.label} className="st-stat-row">
                <span className="st-stat-label">{row.label}</span>
                <span className="st-stat-val" style={row.color ? { color: row.color } : {}}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Бързи линкове */}
          <div className="st-card">
            <h2 className="st-section-title">🔗 Бързи линкове</h2>
            <div className="st-links">
              {LINKS.map(l => (
                <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="st-link">
                  <span style={{ color: l.color, fontSize: 16, flexShrink: 0 }}>{l.icon}</span>
                  <span style={{ flex: 1 }}>{l.label}</span>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>↗</span>
                </a>
              ))}
            </div>
          </div>

          {/* Сигурност */}
          <div className="st-danger">
            <h2 className="st-danger-title">⚠️ Сигурност</h2>
            <div className="st-danger-items">
              <div className="st-danger-item">
                <strong>ADMIN_SECRET</strong>
                <span>Задай в Vercel Environment Variables. Без него /admin е публичен!</span>
              </div>
              <div className="st-danger-item">
                <strong>RLS в Supabase</strong>
                <span>Row Level Security трябва да е активирана на всички таблици.</span>
              </div>
              <div className="st-danger-item">
                <strong>Service Role Key</strong>
                <span>Никога не я излагай в client-side код. Само в API routes.</span>
              </div>
            </div>
            <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="st-vercel-btn">
              Отвори Vercel →
            </a>
          </div>
        </aside>
      </div>

      <style>{`
        .st-root { padding: 24px 28px; }
        @media(max-width:768px){ .st-root { padding: 16px; } }
        .st-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; gap:16px; flex-wrap:wrap; }
        .st-title { font-size:22px; font-weight:700; color:var(--text); letter-spacing:-.02em; }
        .st-sub { font-size:13px; color:var(--muted); margin-top:2px; }
        .st-save-btn { background:#d1d5db; color:#6b7280; border:none; border-radius:10px; padding:10px 22px; font-weight:700; font-size:14px; font-family:inherit; cursor:default; transition:all .2s; white-space:nowrap; }
        .st-save-btn.dirty { background:#1b4332; color:#fff; cursor:pointer; }
        .st-save-btn.dirty:hover { background:#2d6a4f; transform:translateY(-1px); }
        .st-save-btn:disabled { opacity:.6; }

        .st-grid { display:grid; grid-template-columns:1fr 340px; gap:20px; align-items:start; }
        @media(max-width:1024px){ .st-grid { grid-template-columns:1fr; } }

        .st-main { display:flex; flex-direction:column; gap:18px; }
        .st-card { background:#fff; border:1px solid var(--border); border-radius:14px; padding:22px; }
        .st-section-title { font-size:15px; font-weight:700; color:var(--text); margin-bottom:18px; }
        .st-fields { display:flex; flex-direction:column; gap:14px; }
        .st-field { display:flex; flex-direction:column; gap:5px; }
        .st-label { font-size:12px; font-weight:700; color:#374151; }
        .st-input { width:100%; padding:10px 14px; border:1.5px solid #f0f0f0; border-radius:9px; font-family:inherit; font-size:14px; outline:none; transition:all .2s; background:#f9fafb; color:var(--text); box-sizing:border-box; }
        .st-input:focus { border-color:#2d6a4f; background:#fff; }
        .st-input:hover { border-color:#d1d5db; }

        .st-sidebar { display:flex; flex-direction:column; gap:16px; }
        .st-stat-row { display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid #f5f5f5; font-size:13px; }
        .st-stat-row:last-child { border-bottom:none; }
        .st-stat-label { color:var(--muted); }
        .st-stat-val { font-weight:700; color:var(--text); }
        .st-links { display:flex; flex-direction:column; gap:8px; }
        .st-link { display:flex; align-items:center; gap:10px; padding:10px 12px; background:#f8fafc; border:1px solid var(--border); border-radius:9px; text-decoration:none; color:var(--text); font-size:13.5px; font-weight:500; transition:all .15s; }
        .st-link:hover { border-color:#2d6a4f; background:#f0fdf4; }

        .st-danger { background:#fffbeb; border:1px solid #fde68a; border-radius:14px; padding:20px; }
        .st-danger-title { font-size:14px; font-weight:700; color:#92400e; margin-bottom:14px; }
        .st-danger-items { display:flex; flex-direction:column; gap:10px; margin-bottom:16px; }
        .st-danger-item { font-size:13px; color:#78350f; line-height:1.6; }
        .st-danger-item strong { color:#92400e; display:block; font-weight:700; font-size:12px; }
        .st-vercel-btn { display:inline-block; background:#111; color:#fff; text-decoration:none; padding:8px 18px; border-radius:8px; font-size:13px; font-weight:700; transition:background .15s; }
        .st-vercel-btn:hover { background:#333; }
      `}</style>
    </div>
  )
}
