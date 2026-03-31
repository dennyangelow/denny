'use client'
// app/admin/components/MarketingTab.tsx — v4 redesign

import { useState, useEffect, useCallback, type ReactNode, type CSSProperties } from 'react'
import { toast, ToastContainer } from '@/components/ui/Toast'

// ─── Типове ───────────────────────────────────────────────────────────────────

export interface UpsellOffer {
  id: string
  type: 'cart_upsell' | 'cross_sell' | 'post_purchase'
  active: boolean
  title: string
  description: string
  emoji: string
  badge_text?: string
  badge_color?: string
  trigger_type: 'always' | 'product_in_cart' | 'cart_above' | 'cart_below'
  trigger_value?: string
  offer_product_id?: string
  discount_pct?: number
  sort_order: number
}

export interface MarketingSettings {
  upsell_enabled: boolean
  cross_sell_enabled: boolean
  post_purchase_enabled: boolean
  progress_bar_enabled: boolean
  progress_goal_amount: number
  progress_goal_label: string
  post_purchase_delay: number
  offers: UpsellOffer[]
}

const DEFAULT_SETTINGS: MarketingSettings = {
  upsell_enabled: true,
  cross_sell_enabled: true,
  post_purchase_enabled: true,
  progress_bar_enabled: true,
  progress_goal_amount: 60,
  progress_goal_label: 'Безплатна доставка',
  post_purchase_delay: 2,
  offers: [],
}

const TYPE_META: Record<UpsellOffer['type'], { label: string; icon: string; color: string; bg: string; desc: string }> = {
  cart_upsell:   { label: 'Cart Upsell',   icon: '⬆️', color: '#7c3aed', bg: '#f5f3ff', desc: 'Показва се вътре в количката' },
  cross_sell:    { label: 'Cross-sell',    icon: '🔀', color: '#0369a1', bg: '#eff6ff', desc: 'Допълващ продукт в количката' },
  post_purchase: { label: 'Post-purchase', icon: '🎁', color: '#dc2626', bg: '#fff1f2', desc: 'Оферта след потвърждение' },
}

const TRIGGER_META: Record<UpsellOffer['trigger_type'], string> = {
  always:          'Винаги',
  product_in_cart: 'Продукт в количката',
  cart_above:      'Количката НАД сума',
  cart_below:      'Количката ПОД сума',
}

function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const EMPTY_OFFER = (type: UpsellOffer['type'] = 'cart_upsell', sortOrder = 0): UpsellOffer => ({
  id: genId(), type, active: true, title: '', description: '', emoji: '🌿',
  badge_text: '', badge_color: '#16a34a', trigger_type: 'always',
  trigger_value: '', offer_product_id: '', discount_pct: 0, sort_order: sortOrder,
})

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{children}</div>
      {hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function Field({ value, onChange, placeholder, type = 'text', style = {}, rows }: {
  value: string | number; onChange: (v: string) => void
  placeholder?: string; type?: string; style?: CSSProperties; rows?: number
}) {
  const base: CSSProperties = {
    width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 12,
    fontFamily: 'inherit', fontSize: 13.5, color: '#0f172a', background: '#fff',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s, box-shadow .15s', ...style,
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = '#16a34a'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,163,74,.1)'
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = '#e2e8f0'
    e.currentTarget.style.boxShadow = 'none'
  }
  if (rows) return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...base, resize: 'vertical' }} onFocus={onFocus} onBlur={onBlur} />
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} onFocus={onFocus} onBlur={onBlur} />
}

function Toggle({ checked, onChange, label, sublabel }: { checked: boolean; onChange: (v: boolean) => void; label: string; sublabel?: string }) {
  return (
    <div onClick={() => onChange(!checked)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, cursor: 'pointer', transition: 'background .15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <div>
        <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 600 }}>{label}</div>
        {sublabel && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sublabel}</div>}
      </div>
      <div style={{ width: 46, height: 26, borderRadius: 99, background: checked ? '#16a34a' : '#e2e8f0', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
      </div>
    </div>
  )
}

function Chip({ color, bg, children }: { color: string; bg: string; children: ReactNode }) {
  return <span style={{ fontSize: 10, fontWeight: 800, color, background: bg, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' as const, border: `1px solid ${color}25` }}>{children}</span>
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ padding: '8px 0' }}>
      <style>{`@keyframes sk{0%{background-position:-200% center}100%{background-position:200% center}}.sk{background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:sk 1.5s infinite;border-radius:8px}`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 18, padding: '20px 22px' }}>
            <div className="sk" style={{ width: 34, height: 34, borderRadius: 10, marginBottom: 14 }} />
            <div className="sk" style={{ height: 10, width: '55%', marginBottom: 8 }} />
            <div className="sk" style={{ height: 26, width: '40%' }} />
          </div>
        ))}
      </div>
      {[1,2].map(i => (
        <div key={i} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 20, padding: '24px 28px', marginBottom: 16 }}>
          <div className="sk" style={{ height: 15, width: '22%', marginBottom: 10 }} />
          <div className="sk" style={{ height: 11, width: '50%', marginBottom: 22 }} />
          {[1,2,3].map(j => (
            <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', marginBottom: 2 }}>
              <div><div className="sk" style={{ height: 13, width: 130, marginBottom: 7 }} /><div className="sk" style={{ height: 10, width: 80 }} /></div>
              <div className="sk" style={{ width: 46, height: 26, borderRadius: 99 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Грешка при зареждане</h3>
      <p style={{ margin: '0 0 24px', fontSize: 13.5, color: '#64748b', maxWidth: 400, lineHeight: 1.6, display: 'inline-block' }}>{message}</p><br />
      <button onClick={onRetry} style={{ padding: '10px 24px', background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(22,163,74,.3)' }}>
        🔄 Опитай отново
      </button>
      <div style={{ marginTop: 20, padding: '14px 18px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, maxWidth: 520, margin: '20px auto 0', textAlign: 'left' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>💡 Изпълни в Supabase SQL Editor:</div>
        <code style={{ fontSize: 11, color: '#78350f', lineHeight: 1.8, display: 'block' }}>
          CREATE TABLE IF NOT EXISTS marketing_settings (id INTEGER PRIMARY KEY DEFAULT 1, config JSONB DEFAULT {'{}'}::jsonb, updated_at TIMESTAMPTZ DEFAULT NOW());<br />
          INSERT INTO marketing_settings (id, config) VALUES (1, {'{}'}::jsonb) ON CONFLICT (id) DO NOTHING;
        </code>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, active, total, color, bg, onClick }: { icon: string; label: string; active: number; total: number; color: string; bg: string; onClick: () => void }) {
  return (
    <div onClick={onClick}
      style={{ background: bg, border: `1.5px solid ${color}20`, borderRadius: 18, padding: '20px 22px', cursor: 'pointer', transition: 'all .18s', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = `0 8px 28px ${color}25` }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(0)'; el.style.boxShadow = 'none' }}>
      <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 10.5, fontWeight: 800, color, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {total === 0 ? '—' : active}
        {total > 0 && <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.45 }}>/{total}</span>}
      </div>
      <div style={{ fontSize: 11.5, color, opacity: 0.6, marginTop: 5, fontWeight: 500 }}>
        {total === 0 ? 'Без оферти' : `${active} активни`}
      </div>
      <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 20, opacity: 0.12, color }}>→</div>
    </div>
  )
}

// ─── Progress Preview ─────────────────────────────────────────────────────────

function ProgressPreview({ goal, current, label }: { goal: number; current: number; label: string }) {
  const pct = Math.min(100, (current / goal) * 100)
  return (
    <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
        <span style={{ fontWeight: 700, color: '#166534' }}>🚚 {label}</span>
        <span style={{ color: '#6b7280', fontSize: 12 }}>Остават {(goal - current).toFixed(0)} лв.</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,.6)', borderRadius: 99, height: 10, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#16a34a,#4ade80)', borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 6, textAlign: 'right' as const }}>{current} / {goal} лв.</div>
    </div>
  )
}

// ─── OfferCard ────────────────────────────────────────────────────────────────

function OfferCard({ offer, index, total, onUpdate, onDelete, onMove }: {
  offer: UpsellOffer; index: number; total: number
  onUpdate: (o: UpsellOffer) => void; onDelete: () => void; onMove: (dir: 1 | -1) => void
}) {
  const [open, setOpen] = useState(false)
  const meta = TYPE_META[offer.type]
  const isFirst = index === 0
  const isLast  = index === total - 1

  return (
    <div style={{ border: `1.5px solid ${offer.active ? meta.color + '25' : '#f1f5f9'}`, borderRadius: 16, background: offer.active ? '#fff' : '#fafafa', overflow: 'hidden', transition: 'all .2s', marginBottom: 8, boxShadow: offer.active ? `0 2px 12px ${meta.color}08` : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, border: `1px solid ${meta.color}15` }}>
          {offer.emoji || meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: offer.active ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {offer.title || <em style={{ color: '#cbd5e1', fontStyle: 'normal' }}>Без заглавие</em>}
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' as const }}>
            <Chip color={meta.color} bg={meta.bg}>{meta.icon} {meta.label}</Chip>
            <Chip color="#64748b" bg="#f8fafc">{TRIGGER_META[offer.trigger_type]}{offer.trigger_value ? `: ${offer.trigger_value}` : ''}</Chip>
            {offer.discount_pct ? <Chip color="#dc2626" bg="#fff1f2">-{offer.discount_pct}%</Chip> : null}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onMove(-1) }} disabled={isFirst}
            style={{ width: 28, height: 28, border: 'none', background: '#f8fafc', borderRadius: 8, cursor: isFirst ? 'not-allowed' : 'pointer', opacity: isFirst ? 0.3 : 0.7, fontSize: 12 }}>↑</button>
          <button onClick={e => { e.stopPropagation(); onMove(1) }} disabled={isLast}
            style={{ width: 28, height: 28, border: 'none', background: '#f8fafc', borderRadius: 8, cursor: isLast ? 'not-allowed' : 'pointer', opacity: isLast ? 0.3 : 0.7, fontSize: 12 }}>↓</button>
          <div onClick={e => { e.stopPropagation(); onUpdate({ ...offer, active: !offer.active }) }}
            style={{ width: 42, height: 24, borderRadius: 99, background: offer.active ? '#16a34a' : '#e2e8f0', position: 'relative', cursor: 'pointer', transition: 'background .2s', marginLeft: 2 }}>
            <div style={{ position: 'absolute', top: 2, left: offer.active ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
          </div>
          <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
            style={{ width: 28, height: 28, border: 'none', background: open ? meta.color + '15' : '#f8fafc', borderRadius: 8, cursor: 'pointer', fontSize: 11, color: open ? meta.color : '#64748b', transition: 'all .15s', marginLeft: 2 }}>
            {open ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 18px 22px', borderTop: `1px solid ${meta.color}15` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginTop: 16 }}>
            <div>
              <Label>Тип оферта</Label>
              <select value={offer.type} onChange={e => onUpdate({ ...offer, type: e.target.value as UpsellOffer['type'] })}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 12, fontFamily: 'inherit', fontSize: 13, background: '#fff', color: '#0f172a', outline: 'none' }}>
                {(Object.keys(TYPE_META) as UpsellOffer['type'][]).map(t => <option key={t} value={t}>{TYPE_META[t].icon} {TYPE_META[t].label}</option>)}
              </select>
            </div>
            <div><Label>Emoji</Label><Field value={offer.emoji} onChange={v => onUpdate({ ...offer, emoji: v })} placeholder="🌿" /></div>
          </div>
          <div style={{ marginTop: 12 }}><Label>Заглавие *</Label><Field value={offer.title} onChange={v => onUpdate({ ...offer, title: v })} placeholder="Добави 20л и спести 15%" /></div>
          <div style={{ marginTop: 12 }}><Label>Описание</Label><Field value={offer.description} onChange={v => onUpdate({ ...offer, description: v })} placeholder="Кратко убедително съобщение..." rows={2} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><Label hint='Напр. "Само днес"'>Badge текст</Label><Field value={offer.badge_text || ''} onChange={v => onUpdate({ ...offer, badge_text: v })} placeholder="Само днес" /></div>
            <div>
              <Label>Badge цвят</Label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={offer.badge_color || '#16a34a'} onChange={e => onUpdate({ ...offer, badge_color: e.target.value })}
                  style={{ width: 40, height: 40, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: 3, cursor: 'pointer', flexShrink: 0 }} />
                <Field value={offer.badge_color || '#16a34a'} onChange={v => onUpdate({ ...offer, badge_color: v })} style={{ flex: 1 }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <Label>Тригер</Label>
              <select value={offer.trigger_type} onChange={e => onUpdate({ ...offer, trigger_type: e.target.value as UpsellOffer['trigger_type'] })}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 12, fontFamily: 'inherit', fontSize: 13, background: '#fff', color: '#0f172a', outline: 'none' }}>
                {(Object.keys(TRIGGER_META) as UpsellOffer['trigger_type'][]).map(t => <option key={t} value={t}>{TRIGGER_META[t]}</option>)}
              </select>
            </div>
            {offer.trigger_type !== 'always' && (
              <div>
                <Label hint={offer.trigger_type === 'product_in_cart' ? 'product_id' : 'сума в лв.'}>Стойност</Label>
                <Field value={offer.trigger_value || ''} onChange={v => onUpdate({ ...offer, trigger_value: v })} placeholder={offer.trigger_type === 'product_in_cart' ? 'uuid...' : '60'} />
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><Label hint="ID от Products таб">Оферен продукт ID</Label><Field value={offer.offer_product_id || ''} onChange={v => onUpdate({ ...offer, offer_product_id: v })} placeholder="uuid..." /></div>
            <div><Label hint="0 = без отстъпка">Отстъпка %</Label><Field type="number" value={offer.discount_pct || 0} onChange={v => onUpdate({ ...offer, discount_pct: Math.max(0, Math.min(100, Number(v))) })} placeholder="0" /></div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onDelete}
              style={{ padding: '8px 18px', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#ffe4e6' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff1f2' }}>
              🗑 Изтрий
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MarketingTab() {
  const [settings, setSettings]     = useState<MarketingSettings>(DEFAULT_SETTINGS)
  const [saving, setSaving]         = useState(false)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [section, setSection]       = useState<'general' | 'offers' | 'preview'>('general')
  const [savedSnapshot, setSavedSnapshot] = useState<string>('')

  const fetchSettings = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/marketing', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const data = await res.json()
      const merged = { ...DEFAULT_SETTINGS, ...data }
      if (!Array.isArray(merged.offers)) merged.offers = []
      setSettings(merged)
      setSavedSnapshot(JSON.stringify(merged))
    } catch (err: any) {
      setError(err.message || 'Неизвестна грешка')
      setSavedSnapshot(JSON.stringify(DEFAULT_SETTINGS))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])
  useEffect(() => { setHasChanges(JSON.stringify(settings) !== savedSnapshot) }, [settings, savedSnapshot])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/marketing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }
      setSavedSnapshot(JSON.stringify(settings))
      setHasChanges(false); setError(null)
      toast.success('✅ Маркетинг настройките са запазени!')
    } catch (err: any) {
      toast.error(`❌ Грешка: ${err.message}`)
    } finally { setSaving(false) }
  }

  const updateOffer = useCallback((id: string, u: UpsellOffer) => setSettings(s => ({ ...s, offers: s.offers.map(o => o.id === id ? u : o) })), [])
  const deleteOffer = useCallback((id: string) => setSettings(s => ({ ...s, offers: s.offers.filter(o => o.id !== id) })), [])
  const addOffer    = useCallback((type: UpsellOffer['type']) => setSettings(s => ({ ...s, offers: [...s.offers, EMPTY_OFFER(type, s.offers.length)] })), [])
  const moveOffer   = useCallback((index: number, dir: 1 | -1) => setSettings(s => {
    const arr = [...s.offers]; const t = index + dir
    if (t < 0 || t >= arr.length) return s
    ;[arr[index], arr[t]] = [arr[t], arr[index]]
    return { ...s, offers: arr }
  }), [])

  const g = {
    cart_upsell:   settings.offers.filter(o => o.type === 'cart_upsell'),
    cross_sell:    settings.offers.filter(o => o.type === 'cross_sell'),
    post_purchase: settings.offers.filter(o => o.type === 'post_purchase'),
  }
  const totalActive = settings.offers.filter(o => o.active).length

  return (
    <>
      <ToastContainer />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');

        .mkt { font-family: 'Outfit','DM Sans',sans-serif; padding: 32px 36px; max-width: 960px; }
        @media(max-width:768px) { .mkt { padding: 20px 16px; } }

        .mkt-card { background:#fff; border:1px solid #f1f5f9; border-radius:20px; padding:24px 28px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,.04),0 4px 16px rgba(0,0,0,.03); transition:box-shadow .2s; }
        .mkt-card:hover { box-shadow:0 2px 8px rgba(0,0,0,.06),0 8px 24px rgba(0,0,0,.05); }

        .mkt-title { font-size:15px; font-weight:800; color:#0f172a; margin:0 0 3px; letter-spacing:-.01em; }
        .mkt-sub   { font-size:12.5px; color:#94a3b8; margin:0 0 20px; line-height:1.5; }
        .mkt-divider { height:1px; background:#f1f5f9; margin:6px 0; }

        .mkt-tabs { display:flex; gap:4px; background:#f8fafc; border-radius:14px; padding:4px; margin-bottom:24px; width:fit-content; border:1px solid #f1f5f9; }
        .mkt-tab  { padding:9px 22px; border:none; border-radius:10px; font-family:inherit; font-size:13px; font-weight:700; cursor:pointer; transition:all .18s; background:transparent; color:#94a3b8; }
        .mkt-tab:hover:not(.on) { color:#64748b; background:rgba(255,255,255,.5); }
        .mkt-tab.on { background:#fff; color:#0f172a; box-shadow:0 1px 6px rgba(0,0,0,.1),0 0 0 1px rgba(0,0,0,.04); }

        .mkt-stat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
        @media(max-width:580px) { .mkt-stat-grid { grid-template-columns:1fr; } }

        .mkt-add-btn { padding:9px 18px; border:none; border-radius:10px; font-family:inherit; font-weight:700; font-size:12.5px; cursor:pointer; transition:all .15s; flex-shrink:0; }
        .mkt-add-btn:hover { filter:brightness(1.08); transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,.15); }

        .mkt-empty { text-align:center; padding:32px 0; border:2px dashed #e2e8f0; border-radius:16px; color:#cbd5e1; }

        .save-bar { position:sticky; bottom:0; background:rgba(255,255,255,.96); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border-top:1px solid #f1f5f9; padding:16px 0; display:flex; justify-content:space-between; align-items:center; margin-top:24px; z-index:10; gap:12px; }
        .save-btn { padding:12px 32px; border:none; border-radius:12px; font-family:inherit; font-size:14px; font-weight:800; cursor:pointer; transition:all .2s; letter-spacing:-.01em; }
        .save-btn:disabled { cursor:not-allowed; }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .mkt-fade { animation:fadeIn .25s ease; }

        @media(max-width:640px) { .mkt-card { padding:18px 16px; } .save-bar { flex-direction:column; } }
      `}</style>

      <div className="mkt">

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 4px 16px rgba(22,163,74,.35)', flexShrink: 0 }}>📣</div>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a', letterSpacing: '-.025em' }}>Маркетинг & Upsell</h2>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>Оферти, cross-sell и post-purchase настройки</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {totalActive > 0 && (
                <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0', borderRadius: 12, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', animation: 'pulse 2s infinite' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>{totalActive} активни</span>
                </div>
              )}
              {error && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '6px 14px', fontSize: 12, color: '#c2410c', fontWeight: 600 }}>⚠️ Defaults режим</div>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="mkt-tabs">
            <button className={`mkt-tab${section === 'general' ? ' on' : ''}`} onClick={() => setSection('general')}>⚙️ Общи</button>
            <button className={`mkt-tab${section === 'offers' ? ' on' : ''}`} onClick={() => setSection('offers')}>
              🎯 Оферти
              {settings.offers.length > 0 && (
                <span style={{ background: '#16a34a', color: '#fff', borderRadius: 99, fontSize: 10, padding: '1px 7px', marginLeft: 7, fontWeight: 900 }}>
                  {totalActive}/{settings.offers.length}
                </span>
              )}
            </button>
            <button className={`mkt-tab${section === 'preview' ? ' on' : ''}`} onClick={() => setSection('preview')}>👁 Преглед</button>
          </div>
        </div>

        {/* Loading */}
        {loading && <Skeleton />}

        {/* Error state */}
        {!loading && error && <ErrorState message={error} onRetry={fetchSettings} />}

        {/* Content */}
        {!loading && (
          <div className="mkt-fade">

            {/* ── Общи ── */}
            {section === 'general' && (
              <>
                <div className="mkt-stat-grid">
                  <StatCard icon="⬆️" label="Cart Upsell"  active={g.cart_upsell.filter(o=>o.active).length}  total={g.cart_upsell.length}  color="#7c3aed" bg="#f5f3ff" onClick={() => setSection('offers')} />
                  <StatCard icon="🔀" label="Cross-sell"    active={g.cross_sell.filter(o=>o.active).length}    total={g.cross_sell.length}    color="#0369a1" bg="#eff6ff" onClick={() => setSection('offers')} />
                  <StatCard icon="🎁" label="Post-purchase" active={g.post_purchase.filter(o=>o.active).length} total={g.post_purchase.length} color="#dc2626" bg="#fff1f2" onClick={() => setSection('offers')} />
                </div>

                <div className="mkt-card">
                  <p className="mkt-title">🔘 Включване / изключване</p>
                  <p className="mkt-sub">Глобално управление — спира показването без да изтрива офертите</p>
                  <Toggle checked={settings.upsell_enabled}        onChange={v => setSettings(s => ({ ...s, upsell_enabled: v }))}        label="Cart Upsell"   sublabel="Предложения вътре в количката" />
                  <div className="mkt-divider" />
                  <Toggle checked={settings.cross_sell_enabled}    onChange={v => setSettings(s => ({ ...s, cross_sell_enabled: v }))}    label="Cross-sell"    sublabel="Допълващи продукти в количката" />
                  <div className="mkt-divider" />
                  <Toggle checked={settings.post_purchase_enabled} onChange={v => setSettings(s => ({ ...s, post_purchase_enabled: v }))} label="Post-purchase" sublabel="Оферта след потвърждение на поръчка" />
                </div>

                <div className="mkt-card">
                  <p className="mkt-title">📊 Progress Bar в количката</p>
                  <p className="mkt-sub">Показва колко остава до достигане на целта (напр. безплатна доставка)</p>
                  <Toggle checked={settings.progress_bar_enabled} onChange={v => setSettings(s => ({ ...s, progress_bar_enabled: v }))} label="Включи progress bar" />
                  {settings.progress_bar_enabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
                      <div><Label hint="Сума в лв.">Цел (лв.)</Label><Field type="number" value={settings.progress_goal_amount} onChange={v => setSettings(s => ({ ...s, progress_goal_amount: Number(v) }))} placeholder="60" /></div>
                      <div><Label hint='Напр. "Безплатна доставка"'>Текст на целта</Label><Field value={settings.progress_goal_label} onChange={v => setSettings(s => ({ ...s, progress_goal_label: v }))} placeholder="Безплатна доставка" /></div>
                    </div>
                  )}
                </div>

                <div className="mkt-card">
                  <p className="mkt-title">🎁 Post-purchase забавяне</p>
                  <p className="mkt-sub">Колко секунди след потвърждение да се появи офертата</p>
                  <div style={{ maxWidth: 200 }}>
                    <Label hint="0 = веднага">Забавяне (секунди)</Label>
                    <Field type="number" value={settings.post_purchase_delay} onChange={v => setSettings(s => ({ ...s, post_purchase_delay: Math.max(0, Number(v)) }))} placeholder="2" />
                  </div>
                </div>
              </>
            )}

            {/* ── Оферти ── */}
            {section === 'offers' && (
              <>
                {(['cart_upsell', 'cross_sell', 'post_purchase'] as UpsellOffer['type'][]).map(type => {
                  const meta = TYPE_META[type]
                  const typeOffers = settings.offers.filter(o => o.type === type)
                  return (
                    <div className="mkt-card" key={type}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, border: `1px solid ${meta.color}20` }}>{meta.icon}</div>
                            <p className="mkt-title" style={{ color: meta.color, marginBottom: 0 }}>{meta.label}</p>
                          </div>
                          <p className="mkt-sub" style={{ marginBottom: 0, paddingLeft: 39 }}>{meta.desc}</p>
                        </div>
                        <button className="mkt-add-btn" onClick={() => addOffer(type)} style={{ background: meta.color, color: '#fff' }}>+ Добави</button>
                      </div>

                      {typeOffers.length === 0 ? (
                        <div className="mkt-empty">
                          <div style={{ fontSize: 28, marginBottom: 8 }}>{meta.icon}</div>
                          <div style={{ fontSize: 13 }}>Няма оферти. Натисни &ldquo;+ Добави&rdquo;.</div>
                        </div>
                      ) : (
                        typeOffers.map(offer => {
                          const gi = settings.offers.findIndex(o => o.id === offer.id)
                          return (
                            <OfferCard key={offer.id} offer={offer} index={gi} total={settings.offers.length}
                              onUpdate={u => updateOffer(offer.id, u)} onDelete={() => deleteOffer(offer.id)} onMove={dir => moveOffer(gi, dir)} />
                          )
                        })
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {/* ── Преглед ── */}
            {section === 'preview' && (
              <div className="mkt-card">
                <p className="mkt-title">👁 Визуален преглед</p>
                <p className="mkt-sub">Така изглеждат офертите на клиентите</p>

                {settings.progress_bar_enabled && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>📊 Progress Bar (пример при 38 лв.)</div>
                    <ProgressPreview goal={settings.progress_goal_amount} current={38} label={settings.progress_goal_label} />
                  </div>
                )}

                {settings.offers.filter(o => o.active).length === 0 && !settings.progress_bar_enabled ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#cbd5e1' }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
                    <div style={{ fontSize: 14 }}>Няма активни оферти. Добави в таб &ldquo;Оферти&rdquo;.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {settings.offers.filter(o => o.active).map(offer => {
                      const meta = TYPE_META[offer.type]
                      return (
                        <div key={offer.id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: meta.bg, border: `1.5px solid ${meta.color}20`, borderRadius: 14, padding: '13px 16px' }}>
                          <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, boxShadow: `0 2px 8px ${meta.color}15` }}>{offer.emoji}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>{offer.title || '(без заглавие)'}</div>
                            {offer.description && <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4, marginTop: 2 }}>{offer.description}</div>}
                          </div>
                          <Chip color={meta.color} bg="#fff">{meta.icon} {meta.label}</Chip>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Save bar ── */}
            <div className="save-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: hasChanges ? '#f59e0b' : '#94a3b8' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: hasChanges ? '#f59e0b' : '#94a3b8', flexShrink: 0, transition: 'background .3s' }} />
                {hasChanges ? 'Има незапазени промени' : 'Всичко е запазено'}
              </div>
              <button onClick={handleSave} disabled={saving || !hasChanges} className="save-btn"
                style={{
                  background: saving ? '#94a3b8' : hasChanges ? 'linear-gradient(135deg,#16a34a,#15803d)' : '#f1f5f9',
                  color: hasChanges && !saving ? '#fff' : '#94a3b8',
                  boxShadow: hasChanges && !saving ? '0 4px 16px rgba(22,163,74,.35)' : 'none',
                }}>
                {saving ? '⏳ Запазване...' : '💾 Запази настройките'}
              </button>
            </div>

          </div>
        )}

      </div>
    </>
  )
}
