'use client'
// app/admin/components/PromoBannersTab.tsx
// Управление на промо банери — временни или постоянни промо съобщения

import { useState, useEffect } from 'react'
import { toast } from '@/components/ui/Toast'

interface PromoBanner {
  id: string
  title: string
  message: string
  icon: string
  color: string
  text_color: string
  active: boolean
  starts_at: string | null
  ends_at: string | null
  sort_order: number
}

const EMPTY: PromoBanner = {
  id: '', title: '', message: '', icon: '🎁',
  color: '#15803d', text_color: '#ffffff',
  active: true, starts_at: null, ends_at: null, sort_order: 0,
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: '#fff', color: '#111',
}

const PRESET_PROMOS = [
  { label: '🔬 Анализ при 60л+', icon: '🔬', color: '#15803d', message: 'При поръчка на **60 или повече литра** получаваш **безплатен анализ на почвата** от български учени — почвен, листен и воден.' },
  { label: '🎁 +1л с промо код', icon: '🎁', color: '#b45309', message: 'При всяка поръчка на **5л туба** до [ДАТА] с промо код **[КОД]** получаваш **1 литър безплатно**.' },
  { label: '🚚 Безплатна доставка', icon: '🚚', color: '#0369a1', message: 'Безплатна доставка при поръчка над **[СУМА] лв.** — само до [ДАТА]!' },
  { label: '⚡ Flash sale', icon: '⚡', color: '#dc2626', message: '**Flash Sale** — [X]% отстъпка на всички продукти само днес! Използвай код **[КОД]**.' },
]

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 1001,
        transform: 'translate(-50%,-50%)',
        width: 'min(560px, 94vw)', maxHeight: '92vh', overflowY: 'auto',
        background: '#fff', borderRadius: 18, padding: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>✕</button>
        </div>
        {children}
      </div>
    </>
  )
}

// Preview component
function BannerPreview({ banner }: { banner: PromoBanner }) {
  const parseBold = (text: string) =>
    text.split(/\*\*(.*?)\*\*/g).map((p, i) =>
      i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>
    )

  return (
    <div style={{
      background: banner.color,
      borderRadius: 12,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      color: banner.text_color,
    }}>
      <span style={{ fontSize: 26, flexShrink: 0 }}>{banner.icon}</span>
      <span style={{ fontSize: 14, lineHeight: 1.5 }}>{parseBold(banner.message)}</span>
    </div>
  )
}

export function PromoBannersTab() {
  const [items, setItems] = useState<PromoBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<PromoBanner | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/promo-banners?all=true')
      const { banners } = await res.json()
      setItems(banners || [])
    } catch { toast.error('Грешка при зареждане') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!editing) return
    if (!editing.title.trim() || !editing.message.trim()) {
      toast.error('Заглавието и съобщението са задължителни')
      return
    }
    setSaving(true)
    try {
      const isNew = !editing.id
      const url = isNew ? '/api/promo-banners' : `/api/promo-banners/${editing.id}`
      const { id, ...body } = editing
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? body : editing),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(isNew ? '✓ Банерът е създаден' : '✓ Запазено')
      setEditing(null)
      load()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Изтрий този банер?')) return
    try {
      await fetch(`/api/promo-banners/${id}`, { method: 'DELETE' })
      toast.success('Изтрито')
      setItems(prev => prev.filter(b => b.id !== id))
    } catch { toast.error('Грешка') }
  }

  const toggleActive = async (item: PromoBanner) => {
    try {
      await fetch(`/api/promo-banners/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !item.active }),
      })
      setItems(prev => prev.map(b => b.id === item.id ? { ...b, active: !b.active } : b))
      toast.success(item.active ? 'Банерът е скрит' : '✓ Банерът е активиран')
    } catch { toast.error('Грешка') }
  }

  const set = (k: keyof PromoBanner, v: any) =>
    setEditing(prev => prev ? { ...prev, [k]: v } : prev)

  const isExpired = (banner: PromoBanner) => {
    if (!banner.ends_at) return false
    return new Date(banner.ends_at) < new Date()
  }

  const isScheduled = (banner: PromoBanner) => {
    if (!banner.starts_at) return false
    return new Date(banner.starts_at) > new Date()
  }

  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: '-.02em' }}>📣 Промо Банери</h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
            {items.length} банера · {items.filter(b => b.active && !isExpired(b)).length} активни · Показват се на началната страница
          </p>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY, sort_order: items.length + 1 })}
          style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
          + Нов банер
        </button>
      </div>

      {/* Info box */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 18px', marginBottom: 22, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
        <strong>💡 Как работи:</strong> Активните банери се показват в лента под навигацията на сайта. Можеш да зададеш начална и крайна дата — банерът ще се появи/скрие автоматично. Поддържа <code style={{ background: '#dcfce7', padding: '1px 5px', borderRadius: 4 }}>**получер текст**</code> с двойни звездички.
      </div>

      {/* Presets */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Бързи шаблони</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRESET_PROMOS.map(p => (
            <button
              key={p.label}
              onClick={() => setEditing({ ...EMPTY, title: p.label, message: p.message, icon: p.icon, color: p.color, sort_order: items.length + 1 })}
              style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'border-color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = p.color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Зарежда...</div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📣</div>
          Няма промо банери — създай първия!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(item => {
            const expired = isExpired(item)
            const scheduled = isScheduled(item)
            return (
              <div key={item.id} style={{
                background: '#fff',
                border: `1.5px solid ${item.active && !expired ? '#16a34a' : '#e5e7eb'}`,
                borderRadius: 14, padding: '16px 18px',
                opacity: expired ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Color swatch */}
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {item.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</span>
                      {expired ? (
                        <span style={{ fontSize: 10, padding: '2px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: 99, fontWeight: 700 }}>✗ Изтекъл</span>
                      ) : scheduled ? (
                        <span style={{ fontSize: 10, padding: '2px 8px', background: '#fef9c3', color: '#854d0e', borderRadius: 99, fontWeight: 700 }}>⏰ Насрочен</span>
                      ) : item.active ? (
                        <span style={{ fontSize: 10, padding: '2px 8px', background: '#dcfce7', color: '#065f46', borderRadius: 99, fontWeight: 700 }}>✓ Активен</span>
                      ) : (
                        <span style={{ fontSize: 10, padding: '2px 8px', background: '#f3f4f6', color: '#6b7280', borderRadius: 99, fontWeight: 700 }}>✗ Скрит</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.message.replace(/\*\*/g, '')}
                    </div>
                    {(item.starts_at || item.ends_at) && (
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {item.starts_at && `От: ${new Date(item.starts_at).toLocaleDateString('bg-BG')}`}
                        {item.starts_at && item.ends_at && ' → '}
                        {item.ends_at && `До: ${new Date(item.ends_at).toLocaleDateString('bg-BG')}`}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => toggleActive(item)}
                      title={item.active ? 'Скрий' : 'Активирай'}
                      style={{ background: item.active ? '#fee2e2' : '#dcfce7', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}>
                      {item.active ? '🙈' : '👁️'}
                    </button>
                    <button
                      onClick={() => setEditing({ ...item })}
                      style={{ background: '#f3f4f6', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}>
                      ✏️
                    </button>
                    <button
                      onClick={() => del(item.id)}
                      style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? '✏️ Редактирай банер' : '+ Нов промо банер'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Заглавие (само за Admin) *</label>
              <input value={editing.title} onChange={e => set('title', e.target.value)}
                placeholder="напр. Анализ при 60л+" style={inp} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                Съобщение * <span style={{ fontWeight: 400, color: '#9ca3af' }}>— използвай **текст** за получер</span>
              </label>
              <textarea rows={3} value={editing.message} onChange={e => set('message', e.target.value)}
                placeholder="При поръчка на **60 литра** получаваш **безплатен анализ**..."
                style={{ ...inp, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Икона</label>
                <input value={editing.icon} onChange={e => set('icon', e.target.value)}
                  placeholder="🎁" style={{ ...inp, fontSize: 20 }} maxLength={4} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Фон цвят</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color" value={editing.color} onChange={e => set('color', e.target.value)}
                    style={{ width: 40, height: 36, border: '1.5px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                  <input value={editing.color} onChange={e => set('color', e.target.value)}
                    style={{ ...inp, fontSize: 12 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Текст цвят</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color" value={editing.text_color} onChange={e => set('text_color', e.target.value)}
                    style={{ width: 40, height: 36, border: '1.5px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                  <input value={editing.text_color} onChange={e => set('text_color', e.target.value)}
                    style={{ ...inp, fontSize: 12 }} />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>Преглед</label>
              <BannerPreview banner={editing} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Начална дата (незадълж.)</label>
                <input type="datetime-local" value={editing.starts_at ? editing.starts_at.slice(0, 16) : ''}
                  onChange={e => set('starts_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Крайна дата (незадълж.)</label>
                <input type="datetime-local" value={editing.ends_at ? editing.ends_at.slice(0, 16) : ''}
                  onChange={e => set('ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  style={inp} />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Остави празно за без краен срок</div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>Ред (sort_order)</label>
              <input type="number" value={editing.sort_order} onChange={e => set('sort_order', Number(e.target.value))}
                style={inp} min="0" />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '10px 12px', background: '#f9fafb', borderRadius: 8 }}>
              <input type="checkbox" checked={editing.active} onChange={e => set('active', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#2d6a4f' }} />
              Активен (видим на сайта)
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => setEditing(null)}
              style={{ flex: 1, padding: '11px 0', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
              Отказ
            </button>
            <button onClick={save} disabled={saving}
              style={{ flex: 2, padding: '11px 0', background: saving ? '#9ca3af' : '#1b4332', color: '#fff', border: 'none', borderRadius: 10, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
              {saving ? '⏳ Запазва...' : '✓ Запази банера'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
