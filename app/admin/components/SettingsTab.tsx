'use client'
// app/admin/components/SettingsTab.tsx — v6

import { useState, useEffect, useRef, useMemo } from 'react'
import { toast } from '@/components/ui/Toast'

interface Props { ordersCount: number; leadsCount: number }

// ─── Секции с настройки ────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: 'hero', label: '🏠 Главна страница',
    keys: [
      { key: 'urgency_bar_text', label: 'Urgency лента (горе)',         type: 'textarea', placeholder: '🎁 **2 безплатни наръчника** — Домати & Краставици · 🚚 **Безплатна доставка** над 60 лв. · 💵 Само наложен платеж', hint: 'Поддържа **bold** форматиране' },
      { key: 'hero_title',       label: 'Главно заглавие',              type: 'text',     placeholder: 'Искаш едри, здрави и сочни домати?' },
      { key: 'hero_subtitle',    label: 'Подзаглавие (под заглавието)', type: 'textarea', placeholder: 'Без болести, без гниене...', hint: 'Поддържа **bold** форматиране' },
      { key: 'hero_warning',     label: 'Warning кутия (под subtitle)', type: 'text',     placeholder: 'Не рискувай да изхвърлиш продукцията...', hint: 'Показва се в червена кутия с ⚠️' },
      { key: 'cta_title',        label: 'CTA заглавие (долу)',          type: 'text',     placeholder: 'Изтегли И Двата Наръчника Напълно Безплатно' },
      { key: 'cta_subtitle',     label: 'CTA подзаглавие (долу)',       type: 'textarea', placeholder: 'Над 6 000 фермери вече ги изтеглиха...', hint: 'Поддържа **bold** форматиране' },
      { key: 'footer_about_text',label: 'Текст в Footer',              type: 'textarea', placeholder: 'Помагам на фермери да отглеждат...' },
    ],
  },
  {
    id: 'contacts', label: '📞 Контакти',
    keys: [
      { key: 'site_phone',      label: 'Телефон',                    type: 'tel',   placeholder: '+359 876238623' },
      { key: 'site_email',      label: 'Email за клиенти',           type: 'email', placeholder: 'support@dennyangelow.com' },
      { key: 'admin_email',     label: 'Admin email (нови поръчки)', type: 'email', placeholder: 'denny@dennyangelow.com' },
      { key: 'whatsapp_number', label: 'WhatsApp (само цифри)',      type: 'text',  placeholder: '359876238623', hint: 'Без +, без интервали — само цифри' },
    ],
  },
  {
    id: 'shipping', label: '📦 Доставка',
    keys: [
      { key: 'shipping_econt',      label: 'Цена Еконт (лв.)',           type: 'number', placeholder: '5.00' },
      { key: 'shipping_speedy',     label: 'Цена Спиди (лв.)',           type: 'number', placeholder: '5.50' },
      { key: 'free_shipping_above', label: 'Безплатна доставка над (лв.)', type: 'number', placeholder: '60', hint: 'shipping_price в CartSystem = min(econt, speedy)' },
    ],
  },
  {
    id: 'currency', label: '💶 Валута',
    keys: [
      { key: 'currency',        label: 'Валута (код)',      type: 'text', placeholder: 'BGN', hint: 'Напр. BGN, EUR, USD' },
      { key: 'currency_symbol', label: 'Символ за показване', type: 'text', placeholder: 'лв.', hint: 'Показва се след сумата — лв., €, $' },
    ],
  },
  {
    id: 'social', label: '📊 Social proof',
    keys: [
      { key: 'social_proof_items', label: 'Броячи в Hero (JSON)', type: 'textarea', placeholder: '[{"number":"6 000+","label":"изтеглени"},{"number":"85K","label":"последователи"}]', hint: 'JSON масив с number и label' },
      { key: 'trust_strip_items',  label: 'Trust strip (JSON)',   type: 'textarea', placeholder: '[{"icon":"🌱","text":"Органични продукти"}]',                                         hint: 'JSON масив с icon и text' },
    ],
  },
  {
    id: 'emails', label: '✉️ Email настройки',
    keys: [
      { key: 'email_from_name', label: 'От (Имена)',  type: 'text',  placeholder: 'Denny Angelow' },
      { key: 'email_from_addr', label: 'От (Имейл)',  type: 'email', placeholder: 'denny@dennyangelow.com' },
      { key: 'email_reply_to',  label: 'Reply-To',    type: 'email', placeholder: 'support@dennyangelow.com' },
    ],
  },
] as const

type SectionKey = typeof SECTIONS[number]['keys'][number]['key']

function validate(vals: Record<string, string>): string[] {
  const errs: string[] = []
  ;['shipping_econt', 'shipping_speedy', 'free_shipping_above'].forEach(k => {
    if (vals[k] && (isNaN(parseFloat(vals[k])) || parseFloat(vals[k]) < 0)) {
      errs.push(`${k}: трябва да е положително число`)
    }
  })
  ;['social_proof_items', 'trust_strip_items'].forEach(k => {
    if (vals[k]) {
      try { JSON.parse(vals[k]) } catch { errs.push(`${k}: невалиден JSON`) }
    }
  })
  return errs
}

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SettingsTab({ ordersCount, leadsCount }: Props) {
  const [vals,      setVals]      = useState<Record<string, string>>({})
  const [savedVals, setSavedVals] = useState<Record<string, string>>({})
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [autoSaving,setAutoSaving]= useState(false)
  const [search,    setSearch]    = useState('')
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set(SECTIONS.map(s => s.id)))
  const isFirstLoad = useRef(true)

  const dirty = useMemo(
    () => Object.keys(vals).some(k => vals[k] !== savedVals[k]),
    [vals, savedVals],
  )

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.settings) { setVals(d.settings); setSavedVals(d.settings) }
        setLoading(false)
      })
      .catch(() => { toast.error('Грешка при зареждане на настройките'); setLoading(false) })
  }, [])

  // ── Auto-save (debounced 2s) ──────────────────────────────────────────────
  const debouncedVals = useDebounce(vals, 2000)
  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return }
    if (!dirty) return
    const errs = validate(debouncedVals)
    if (errs.length > 0) return
    setAutoSaving(true)
    fetch('/api/settings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ updates: debouncedVals }),
    })
      .then(res => { if (res.ok) { setSavedVals({ ...debouncedVals }); toast.success('Автоматично запазено ✓') } })
      .catch(() => {})
      .finally(() => setAutoSaving(false))
  }, [debouncedVals])

  // ── Unload warning ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const set = (key: string, val: string) => setVals(p => ({ ...p, [key]: val }))

  // ── Manual save ───────────────────────────────────────────────────────────
  const save = async () => {
    const errs = validate(vals)
    if (errs.length > 0) { errs.forEach(e => toast.error(e)); return }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ updates: vals }),
      })
      if (!res.ok) throw new Error()
      setSavedVals({ ...vals })
      toast.success('Настройките са запазени!')
    } catch {
      toast.error('Грешка при запазване')
    } finally {
      setSaving(false)
    }
  }

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(vals, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `settings-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    toast.success('Настройките са изтеглени')
  }

  const importSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target?.result as string)
        if (typeof imported !== 'object') throw new Error()
        setVals(prev => ({ ...prev, ...imported }))
        toast.success('Импортирано — провери и запази')
      } catch { toast.error('Невалиден JSON файл') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const triggerSequence = async () => {
    const res = await fetch('/api/leads/sequence')
    const d   = await res.json()
    if (res.ok) toast.success(`Sequence: ${d.sent} имейла изпратени`)
    else        toast.error(d.error || 'Грешка')
  }

  const toggleSection = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── Search filter ─────────────────────────────────────────────────────────
  const filteredSections = useMemo(() => {
    if (!search.trim()) return SECTIONS
    const q = search.toLowerCase()
    return SECTIONS
      .map(s => ({ ...s, keys: s.keys.filter(k => k.label.toLowerCase().includes(q) || k.key.toLowerCase().includes(q)) }))
      .filter(s => s.keys.length > 0)
  }, [search])

  // ─────────────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid #f0f0f0', borderRadius: 9,
    fontFamily: 'inherit', fontSize: 14, outline: 'none',
    background: '#f9fafb', color: 'var(--text)',
    boxSizing: 'border-box', transition: 'border-color .2s',
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontSize: 14 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', borderRadius: '50%', animation: 'spin .7s linear infinite', marginRight: 12 }} />
      Зарежда настройките...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px' }}>
      <style>{`
        .settings-input:focus  { border-color: #2d6a4f !important; background: #fff !important }
        .settings-textarea:focus { border-color: #2d6a4f !important; background: #fff !important }
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .5 } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Настройки</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            Глобални параметри
            {autoSaving && <span style={{ fontSize: 11, color: '#16a34a', animation: 'pulse 1s infinite' }}>⏳ Запазва...</span>}
            {!autoSaving && !dirty && <span style={{ fontSize: 11, color: '#9ca3af' }}>✓ Запазено</span>}
            {!autoSaving && dirty  && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>● Незапазени промени</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={exportSettings}
            style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text)' }}>
            ↓ Експорт JSON
          </button>
          <label style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text)' }}>
            ↑ Импорт JSON
            <input type="file" accept=".json" onChange={importSettings} style={{ display: 'none' }} />
          </label>
          <button onClick={save} disabled={saving || !dirty}
            style={{ background: dirty ? '#1b4332' : '#d1d5db', color: dirty ? '#fff' : '#6b7280', border: 'none', borderRadius: 9, padding: '9px 20px', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: dirty ? 'pointer' : 'default', transition: 'all .2s' }}>
            {saving ? '⏳ Запазва...' : '✓ Запази'}
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input
            placeholder="Търси настройка..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 36, background: '#fff' }}
            className="settings-input"
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>
              ✕
            </button>
          )}
        </div>
        {search && (
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
            {filteredSections.reduce((s, sec) => s + sec.keys.length, 0)} намерени резултата
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* ── Settings sections ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredSections.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              Няма настройки за „{search}"
            </div>
          ) : filteredSections.map(section => {
            const isExpanded   = expanded.has(section.id)
            const sectionDirty = section.keys.some(k => vals[k.key] !== savedVals[k.key])

            return (
              <div key={section.id} style={{ background: '#fff', border: `1px solid ${sectionDirty ? '#fde68a' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color .2s' }}>

                <button onClick={() => toggleSection(section.id)}
                  style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{section.label}</h2>
                    {sectionDirty && <span style={{ fontSize: 10, background: '#fde68a', color: '#92400e', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>Редактирано</span>}
                  </div>
                  <span style={{ color: '#9ca3af', fontSize: 12, transition: 'transform .2s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                </button>

                {isExpanded && (
                  <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid #f5f5f5' }}>
                    <div style={{ height: 14 }} />
                    {section.keys.map(k => {
                      const isChanged = vals[k.key] !== savedVals[k.key]
                      return (
                        <div key={k.key}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: isChanged ? '#92400e' : '#374151', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                            {k.label}
                            {isChanged && <span style={{ fontSize: 10, color: '#f59e0b' }}>●</span>}
                          </label>
                          {k.type === 'textarea' ? (
                            <textarea
                              rows={3}
                              value={vals[k.key] || ''}
                              onChange={e => set(k.key, e.target.value)}
                              placeholder={k.placeholder}
                              className="settings-textarea"
                              style={{ ...inputStyle, resize: 'vertical' }}
                            />
                          ) : (
                            <input
                              type={k.type}
                              value={vals[k.key] || ''}
                              onChange={e => set(k.key, e.target.value)}
                              placeholder={k.placeholder}
                              className="settings-input"
                              step={k.type === 'number' ? '0.01' : undefined}
                              min={k.type  === 'number' ? '0'    : undefined}
                              style={inputStyle}
                            />
                          )}
                          {'hint' in k && k.hint && (
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{k.hint}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Status */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px' }}>📊 Статус</h2>
            {[
              { label: 'Поръчки',    value: ordersCount, color: '#16a34a' },
              { label: 'Абонати',    value: leadsCount,  color: '#0ea5e9' },
              { label: 'Framework',  value: 'Next.js 14' },
              { label: 'База данни', value: 'Supabase' },
              { label: 'Email',      value: 'Resend' },
              { label: 'Hosting',    value: 'Vercel' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                <span style={{ fontWeight: 700, color: (row as any).color || 'var(--text)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Email sequences */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>⚙️ Email Sequences</h2>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>
              Изпълнява се автоматично всеки час (Vercel Cron).
            </p>
            <div style={{ background: '#f0fdf4', borderRadius: 9, padding: '10px 12px', fontSize: 12, color: '#166534', marginBottom: 12, lineHeight: 1.6 }}>
              📅 Welcome → +2д → +5д → +10д<br />
              🛒 Abandoned: след 24ч без обработка
            </div>
            <button onClick={triggerSequence}
              style={{ width: '100%', padding: '10px', background: '#1b4332', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
              ▶ Стартирай ръчно
            </button>
          </div>

          {/* Quick links */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>🔗 Бързи линкове</h2>
            {[
              { label: 'Supabase Dashboard', url: 'https://app.supabase.com',     icon: '⬡', color: '#3ecf8e' },
              { label: 'Resend Dashboard',   url: 'https://resend.com/emails',    icon: '✉', color: '#0ea5e9' },
              { label: 'Vercel Dashboard',   url: 'https://vercel.com/dashboard', icon: '▲', color: '#111' },
              { label: 'Главна страница',    url: '/',                            icon: '◫', color: '#6b7280' },
            ].map(l => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, textDecoration: 'none', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6, transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#2d6a4f'; e.currentTarget.style.background = '#f0fdf4' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#f8fafc' }}>
                <span style={{ color: l.color, fontSize: 16 }}>{l.icon}</span>
                <span style={{ flex: 1 }}>{l.label}</span>
                <span style={{ color: '#9ca3af', fontSize: 11 }}>↗</span>
              </a>
            ))}
          </div>

          {/* Security */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 18 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 10 }}>⚠️ Сигурност</h2>
            {[
              ['ADMIN_SECRET',   'Задай в Vercel → Env Vars. Без него /admin е публичен!'],
              ['RLS в Supabase', 'Row Level Security трябва да е активирана.'],
              ['CRON_SECRET',    'Защита на /api/leads/sequence.'],
            ].map(([k, v]) => (
              <div key={k} style={{ marginBottom: 8, fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>
                <strong style={{ color: '#92400e', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>{k}</strong>
                {v}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
