'use client'
// app/admin/components/SettingsTab.tsx — v4

import { useState, useEffect } from 'react'
import { toast } from '@/components/ui/Toast'

interface Props { ordersCount: number; leadsCount: number }

const SECTIONS = [
  {
    id: 'hero', label: '🏠 Главна страница', keys: [
      { key: 'hero_title',    label: 'Главно заглавие',    type: 'text',     placeholder: 'Искаш едри, здрави и сочни домати?' },
      { key: 'hero_subtitle', label: 'Подзаглавие',         type: 'textarea', placeholder: 'Описание под заглавието...' },
      { key: 'hero_warning',  label: 'Предупреждение/Urgency', type: 'text',  placeholder: 'Не рискувай да изхвърлиш продукцията...' },
    ]
  },
  {
    id: 'contacts', label: '📞 Контакти', keys: [
      { key: 'site_phone',      label: 'Телефон',                    type: 'tel',    placeholder: '+359 88 888 8888' },
      { key: 'site_email',      label: 'Email за клиенти',            type: 'email',  placeholder: 'support@dennyangelow.com' },
      { key: 'admin_email',     label: 'Admin email (нови поръчки)',  type: 'email',  placeholder: 'denny@dennyangelow.com' },
      { key: 'whatsapp_number', label: 'WhatsApp (само цифри)',       type: 'text',   placeholder: '359888888888' },
    ]
  },
  {
    id: 'shipping', label: '📦 Доставка (€)', keys: [
      { key: 'shipping_econt',         label: 'Цена Еконт (€)',                type: 'number', placeholder: '5.00' },
      { key: 'shipping_speedy',        label: 'Цена Спиди (€)',                type: 'number', placeholder: '5.50' },
      { key: 'free_shipping_above',    label: 'Безплатна доставка над (€)',    type: 'number', placeholder: '60' },
    ]
  },
  {
    id: 'emails', label: '✉️ Email настройки', keys: [
      { key: 'email_from_name',  label: 'От (Имена)',         type: 'text',  placeholder: 'Denny Angelow' },
      { key: 'email_from_addr',  label: 'От (Имейл)',         type: 'email', placeholder: 'denny@dennyangelow.com' },
      { key: 'email_reply_to',   label: 'Reply-To',           type: 'email', placeholder: 'support@dennyangelow.com' },
    ]
  },
]

function validate(vals: Record<string, string>): string[] {
  const errors: string[] = []
  for (const key of ['shipping_econt', 'shipping_speedy', 'free_shipping_above']) {
    if (vals[key] && (isNaN(parseFloat(vals[key])) || parseFloat(vals[key]) < 0)) {
      errors.push(`${key}: трябва да е положително число`)
    }
  }
  return errors
}

export function SettingsTab({ ordersCount, leadsCount }: Props) {
  const [vals, setVals]     = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty]   = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.settings) setVals(d.settings)
      setLoading(false)
    }).catch(() => { toast.error('Грешка при зареждане'); setLoading(false) })
  }, [])

  const set = (key: string, val: string) => { setVals(p => ({ ...p, [key]: val })); setDirty(true) }

  const save = async () => {
    const errs = validate(vals)
    if (errs.length > 0) { errs.forEach(e => toast.error(e)); return }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: vals }),
      })
      if (!res.ok) throw new Error()
      toast.success('Настройките са запазени!')
      setDirty(false)
    } catch { toast.error('Грешка при запазване') }
    finally { setSaving(false) }
  }

  const triggerSequence = async () => {
    const res = await fetch('/api/leads/sequence')
    const d = await res.json()
    if (res.ok) toast.success(`Sequence изпълнен: ${d.sent} имейла изпратени`)
    else toast.error(d.error || 'Грешка')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontSize: 14 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', borderRadius: '50%', animation: 'spin .7s linear infinite', marginRight: 12 }}/>
      Зарежда настройките...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Настройки</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Глобални параметри на системата</p>
        </div>
        <button onClick={save} disabled={saving || !dirty}
          style={{ background: dirty ? '#1b4332' : '#d1d5db', color: dirty ? '#fff' : '#6b7280', border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: dirty ? 'pointer' : 'default', transition: 'all .2s', whiteSpace: 'nowrap' }}>
          {saving ? '⏳ Запазва...' : '✓ Запази промените'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Main settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SECTIONS.map(section => (
            <div key={section.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 18px' }}>{section.label}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {section.keys.map(k => (
                  <div key={k.key}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>{k.label}</label>
                    {k.type === 'textarea' ? (
                      <textarea rows={3} value={vals[k.key]||''} onChange={e=>set(k.key,e.target.value)} placeholder={k.placeholder}
                        style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #f0f0f0', borderRadius:9, fontFamily:'inherit', fontSize:14, outline:'none', transition:'all .2s', background:'#f9fafb', color:'var(--text)', boxSizing:'border-box', resize:'vertical' }}
                        onFocus={e=>e.target.style.borderColor='#2d6a4f'} onBlur={e=>e.target.style.borderColor='#f0f0f0'}/>
                    ) : (
                      <input type={k.type} value={vals[k.key]||''} onChange={e=>set(k.key,e.target.value)} placeholder={k.placeholder}
                        step={k.type==='number'?'0.01':undefined} min={k.type==='number'?'0':undefined}
                        style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #f0f0f0', borderRadius:9, fontFamily:'inherit', fontSize:14, outline:'none', transition:'all .2s', background:'#f9fafb', color:'var(--text)', boxSizing:'border-box' }}
                        onFocus={e=>e.target.style.borderColor='#2d6a4f'} onBlur={e=>e.target.style.borderColor='#f0f0f0'}/>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* System status */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px' }}>📊 Статус</h2>
            {[
              { label: 'Поръчки',    value: ordersCount, color: '#16a34a' },
              { label: 'Абонати',    value: leadsCount,  color: '#0ea5e9' },
              { label: 'Framework',  value: 'Next.js 14' },
              { label: 'База данни', value: 'Supabase' },
              { label: 'Email',      value: 'Resend' },
              { label: 'Hosting',    value: 'Vercel' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                <span style={{ fontWeight: 700, color: (row as any).color || 'var(--text)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Email sequences */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>⚙️ Email Sequences</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.5 }}>
              Sequence processor се изпълнява автоматично всеки час (Vercel Cron). Можеш да го стартираш ръчно за тест.
            </p>
            <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#166534', marginBottom: 14 }}>
              📅 Стъпки: Welcome → +2д → +5д → +10д<br/>
              🛒 Abandoned order: след 24ч без обработка
            </div>
            <button onClick={triggerSequence} style={{ width: '100%', padding: '10px', background: '#1b4332', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
              ▶ Стартирай ръчно
            </button>
          </div>

          {/* Quick links */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 22 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>🔗 Бързи линкове</h2>
            {[
              { label: 'Supabase Dashboard', url: 'https://app.supabase.com',      icon: '⬡', color: '#3ecf8e' },
              { label: 'Resend Dashboard',   url: 'https://resend.com/emails',     icon: '✉', color: '#0ea5e9' },
              { label: 'Vercel Dashboard',   url: 'https://vercel.com/dashboard',  icon: '▲', color: '#111' },
              { label: 'Главна страница',    url: '/',                             icon: '◫', color: '#6b7280' },
            ].map(l => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, textDecoration: 'none', color: 'var(--text)', fontSize: 13.5, fontWeight: 500, marginBottom: 8, transition: 'all .15s' }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor='#2d6a4f')}
                onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}>
                <span style={{ color: l.color, fontSize: 16 }}>{l.icon}</span>
                <span style={{ flex: 1 }}>{l.label}</span>
                <span style={{ color: '#9ca3af', fontSize: 12 }}>↗</span>
              </a>
            ))}
          </div>

          {/* Security */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>⚠️ Сигурност</h2>
            {[
              ['ADMIN_SECRET', 'Задай в Vercel → Settings → Env Vars. Без него /admin е публичен!'],
              ['RLS в Supabase', 'Row Level Security трябва да е активирана на всички таблици.'],
              ['Service Role Key', 'Само в server-side (API routes). Никога в client код.'],
              ['CRON_SECRET', 'Защита на /api/leads/sequence от unauthorized достъп.'],
            ].map(([k, v]) => (
              <div key={k} style={{ marginBottom: 10, fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
                <strong style={{ color: '#92400e', display: 'block', fontSize: 12 }}>{k}</strong>
                {v}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
