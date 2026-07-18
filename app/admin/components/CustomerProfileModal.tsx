'use client'
// app/admin/components/CustomerProfileModal.tsx — v3 "работен център"
// ✅ Ново спрямо v2:
//   - custom_fields: свободни таг:стойност полета (пишеш каквото поле ти трябва)
//   - next_contact_date: напомняне "звънни на дата Х" + banner при просрочие/днес
//   - pinned notes: закачваш важна бележка да стои винаги отгоре

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Order } from '@/lib/supabase'
import { STATUS_LABELS } from '@/lib/constants'
import { useCurrency } from './CurrencyContext'
import { toast } from '@/components/ui/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────
interface CustomerProfile {
  customer_id:       string
  name:              string | null
  phone_normalized:  string
  crop:              string | null
  area_size:         number | null
  area_unit:         string | null
  tags:              string[]
  is_vip:            boolean
  custom_fields:     Record<string, string>
  next_contact_date: string | null
  total_orders:      number
  total_spent:       number
  first_order_at:    string | null
  last_order_at:     string | null
}

interface CustomerOrderItem {
  id: string; product_name: string; quantity: number; unit_price: number; total_price: number
}

interface CustomerOrderRow {
  id: string; order_number: string; status: string; payment_status: string
  payment_method: string; courier: string | null; total: number; shipping: number
  subtotal: number; customer_notes: string | null; tracking_number: string | null
  created_at: string; order_items: CustomerOrderItem[]
}

interface CustomerNote {
  id: string; customer_id: string; note: string
  call_outcome: string | null; author: string | null; pinned: boolean; created_at: string
}

type TimelineItem =
  | { kind: 'order'; date: string; data: CustomerOrderRow }
  | { kind: 'note';  date: string; data: CustomerNote }

const OUTCOME_META: Record<string, { label: string; icon: string; color: string }> = {
  answered:       { label: 'Вдигна', icon: '✅', color: '#16a34a' },
  no_answer:      { label: 'Не вдигна', icon: '📵', color: '#9ca3af' },
  callback:       { label: 'Обратно обаждане', icon: '↩️', color: '#d97706' },
  not_interested: { label: 'Не се интересува', icon: '🚫', color: '#dc2626' },
}

// dd.mm.yyyy → диапазон спрямо днес, за банера за напомняне
function daysFromToday(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function addDaysISO(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

interface Props {
  phone:      string
  fallbackName?: string
  onClose:    () => void
  onOpenOrder?: (order: Order) => void
}

export function CustomerProfileModal({ phone, fallbackName, onClose, onOpenOrder }: Props) {
  const { fmt: formatPrice } = useCurrency()
  const [loading, setLoading]     = useState(true)
  const [profile, setProfile]     = useState<CustomerProfile | null>(null)
  const [orders, setOrders]       = useState<CustomerOrderRow[]>([])
  const [notes, setNotes]         = useState<CustomerNote[]>([])
  const [showAllHistory, setShowAllHistory] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)

  // ── CRM полета (editable) ──
  const [crop, setCrop]           = useState('')
  const [areaSize, setAreaSize]   = useState('')
  const [areaUnit, setAreaUnit]   = useState('дка')
  const [tagsInput, setTagsInput] = useState('')
  const [isVip, setIsVip]         = useState(false)
  const [nextContact, setNextContact] = useState('')
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([])
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileDirty, setProfileDirty]   = useState(false)

  // ── Нова бележка ──
  const [newNote, setNewNote]         = useState('')
  const [callOutcome, setCallOutcome] = useState('')
  const [pinOnAdd, setPinOnAdd]       = useState(false)
  const [savingNote, setSavingNote]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(phone)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка')
      setProfile(data.profile)
      setOrders(data.orders || [])
      setNotes(data.notes || [])
      setCrop(data.profile.crop || '')
      setAreaSize(data.profile.area_size != null ? String(data.profile.area_size) : '')
      setAreaUnit(data.profile.area_unit || 'дка')
      setTagsInput((data.profile.tags || []).join(', '))
      setIsVip(!!data.profile.is_vip)
      setNextContact(data.profile.next_contact_date || '')
      const cf = data.profile.custom_fields || {}
      setCustomFields(Object.entries(cf).map(([key, value]) => ({ key, value: String(value) })))
      setProfileDirty(false)
    } catch (e: any) {
      toast.error(e.message || 'Грешка при зареждане')
    } finally {
      setLoading(false)
    }
  }, [phone])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const markDirty = () => setProfileDirty(true)

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      const cfObject: Record<string, string> = {}
      customFields.forEach(({ key, value }) => {
        const k = key.trim()
        if (k) cfObject[k] = value
      })
      const res = await fetch(`/api/customers/${encodeURIComponent(phone)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crop: crop || null,
          area_size: areaSize ? Number(areaSize) : null,
          area_unit: areaUnit || null,
          tags,
          is_vip: isVip,
          custom_fields: cfObject,
          next_contact_date: nextContact || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Запазено')
      setProfileDirty(false)
      await load()
    } catch { toast.error('Грешка при запис') }
    finally { setSavingProfile(false) }
  }

  const addNote = async () => {
    if (!newNote.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(phone)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote.trim(), call_outcome: callOutcome || null, pinned: pinOnAdd }),
      })
      if (!res.ok) throw new Error()
      setNewNote(''); setCallOutcome(''); setPinOnAdd(false)
      toast.success('Бележката е записана')
      await load()
    } catch { toast.error('Грешка при запис') }
    finally { setSavingNote(false) }
  }

  const togglePin = async (noteId: string, pinned: boolean) => {
    // optimistic update
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, pinned } : n))
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(phone)}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinned }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Грешка — опитай пак')
      await load()
    }
  }

  const openOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`)
      const data = await res.json()
      if (!res.ok) throw new Error()
      onOpenOrder?.(data)
      onClose()
    } catch { toast.error('Грешка при отваряне на поръчката') }
  }

  const addCustomFieldRow  = () => setCustomFields(prev => [...prev, { key: '', value: '' }])
  const updateCustomField  = (i: number, field: 'key' | 'value', v: string) => {
    setCustomFields(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: v } : row))
    markDirty()
  }
  const removeCustomField  = (i: number) => { setCustomFields(prev => prev.filter((_, idx) => idx !== i)); markDirty() }

  // ── Обединена хронология (без закачените бележки — те стоят отделно) ──
  const pinnedNotes = useMemo(() => notes.filter(n => n.pinned), [notes])
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...orders.map(o => ({ kind: 'order' as const, date: o.created_at, data: o })),
      ...notes.filter(n => !n.pinned).map(n => ({ kind: 'note' as const, date: n.created_at, data: n })),
    ]
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return items
  }, [orders, notes])

  const visibleTimeline = showAllHistory ? timeline : timeline.slice(0, 6)
  const displayName = profile?.name || fallbackName || 'Клиент'

  const reminderDays  = profile?.next_contact_date ? daysFromToday(profile.next_contact_date) : null
  const reminderState = reminderDays == null ? null : reminderDays < 0 ? 'overdue' : reminderDays === 0 ? 'today' : 'future'

  return (
    <>
      <style>{`
        .cm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:210;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);animation:cmFadeIn .2s ease}
        .cm-box{background:#fff;border-radius:20px;width:100%;max-width:660px;max-height:94vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,.28);animation:cmSlideUp .25s cubic-bezier(.34,1.56,.64,1)}
        @keyframes cmFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes cmSlideUp{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @media(max-width:480px){.cm-box{border-radius:0!important;max-height:100vh!important}}
        .cm-close{width:30px;height:30px;border:none;background:#f5f5f5;border-radius:8px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;color:#6b7280;flex-shrink:0}
        .cm-close:hover{background:#fee2e2;color:#dc2626}
        .cm-mini-input{padding:7px 10px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:inherit;font-size:13px;color:#111;outline:none;background:#fff}
        .cm-mini-input:focus{border-color:#2d6a4f}
        .cm-section-label{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between}
        .cm-chip-btn{border:1px dashed #d1d5db;background:none;border-radius:7px;padding:4px 9px;font-size:11px;cursor:pointer;color:#6b7280;font-family:inherit;font-weight:600}
        .cm-chip-btn:hover{border-color:#2d6a4f;color:#1b4332}
        .cm-pin-btn{border:none;background:none;cursor:pointer;font-size:13px;opacity:.4;flex-shrink:0}
        .cm-pin-btn:hover{opacity:1}
        .cm-pin-btn.active{opacity:1}
      `}</style>

      <div className="cm-backdrop" ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose() }}>
        <div className="cm-box">

          {/* ── HEADER ── */}
          <div style={{ padding: '18px 22px', position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderRadius: '20px 20px 0 0', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>👤 Клиентски профил</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{displayName}</span>
                  <span style={{ fontSize: 13, color: '#6b7280', fontFamily: 'monospace' }}>{phone}</span>
                  {profile?.is_vip && (
                    <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>⭐ VIP</span>
                  )}
                </div>
                {!loading && !!profile && (
                  <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#374151' }}>📦 <strong>{profile.total_orders}</strong> поръчки</span>
                    <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>💶 {formatPrice(profile.total_spent)}</span>
                    {profile.last_order_at && (
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>последна: {new Date(profile.last_order_at).toLocaleDateString('bg-BG')}</span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button className="cm-close" onClick={() => { window.location.href = `tel:${phone}` }} title="Обади се" style={{ background: '#f0fdf4', color: '#16a34a' }}>📞</button>
                <button className="cm-close" onClick={onClose}>✕</button>
              </div>
            </div>
          </div>

          <div style={{ padding: '16px 22px 22px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '44px 20px', color: '#9ca3af' }}>⏳ Зареждане...</div>
            ) : (
              <>
                {/* ══════════ НАПОМНЯНЕ banner (само ако е днес/просрочено) ══════════ */}
                {(reminderState === 'today' || reminderState === 'overdue') && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
                    background: reminderState === 'overdue' ? '#fef2f2' : '#fffbeb',
                    border: `1px solid ${reminderState === 'overdue' ? '#fecaca' : '#fde68a'}`,
                    borderRadius: 10, padding: '9px 13px',
                  }}>
                    <span style={{ fontSize: 15 }}>{reminderState === 'overdue' ? '⚠️' : '📞'}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: reminderState === 'overdue' ? '#991b1b' : '#92400e' }}>
                      {reminderState === 'overdue'
                        ? `Просрочено обаждане — трябваше да звъннеш преди ${Math.abs(reminderDays!)} ${Math.abs(reminderDays!) === 1 ? 'ден' : 'дни'}`
                        : 'Днес трябва да звъннеш на този клиент'}
                    </span>
                  </div>
                )}

                {/* ══════════ CRM ПОЛЕТА — компактен ред ══════════ */}
                <div style={{ marginBottom: 14, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                  <div className="cm-section-label">🌱 Отглежда / профил</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input className="cm-mini-input" style={{ flex: '2 1 160px' }} value={crop}
                      onChange={e => { setCrop(e.target.value); markDirty() }} placeholder="какво отглежда (домати, лоза...)" />
                    <input className="cm-mini-input" style={{ width: 80 }} type="number" value={areaSize}
                      onChange={e => { setAreaSize(e.target.value); markDirty() }} placeholder="площ" />
                    <select className="cm-mini-input" value={areaUnit} onChange={e => { setAreaUnit(e.target.value); markDirty() }}>
                      <option value="дка">дка</option>
                      <option value="хектара">хектара</option>
                      <option value="м²">м²</option>
                    </select>
                    <input className="cm-mini-input" style={{ flex: '2 1 160px' }} value={tagsInput}
                      onChange={e => { setTagsInput(e.target.value); markDirty() }} placeholder="тагове (през запетая)" />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                      <input type="checkbox" checked={isVip} onChange={e => { setIsVip(e.target.checked); markDirty() }} style={{ cursor: 'pointer' }} />
                      ⭐ VIP
                    </label>
                  </div>
                </div>

                {/* ══════════ ГЪВКАВИ ПОЛЕТА — свободни таг:стойност ══════════ */}
                <div style={{ marginBottom: 14, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                  <div className="cm-section-label">
                    <span>🗂️ Друга информация</span>
                    <button className="cm-chip-btn" onClick={addCustomFieldRow}>+ добави поле</button>
                  </div>
                  {customFields.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#b0b4bb', fontStyle: 'italic' }}>
                      Няма добавени полета — напр. "напоителна система: капково", "предпочита: сутрин"...
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {customFields.map((row, i) => (
                        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input className="cm-mini-input" style={{ flex: '1 1 130px' }} value={row.key}
                            placeholder="поле (напр. напояване)" onChange={e => updateCustomField(i, 'key', e.target.value)} />
                          <span style={{ color: '#d1d5db' }}>:</span>
                          <input className="cm-mini-input" style={{ flex: '2 1 180px' }} value={row.value}
                            placeholder="стойност" onChange={e => updateCustomField(i, 'value', e.target.value)} />
                          <button onClick={() => removeCustomField(i)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 15, flexShrink: 0 }}
                            onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                            onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ══════════ НАПОМНЯНЕ — следващо обаждане ══════════ */}
                <div style={{ marginBottom: 14, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                  <div className="cm-section-label">📅 Следващо обаждане</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input className="cm-mini-input" type="date" value={nextContact}
                      onChange={e => { setNextContact(e.target.value); markDirty() }} />
                    <button className="cm-chip-btn" onClick={() => { setNextContact(addDaysISO(1)); markDirty() }}>утре</button>
                    <button className="cm-chip-btn" onClick={() => { setNextContact(addDaysISO(3)); markDirty() }}>+3 дни</button>
                    <button className="cm-chip-btn" onClick={() => { setNextContact(addDaysISO(7)); markDirty() }}>+седмица</button>
                    <button className="cm-chip-btn" onClick={() => { setNextContact(addDaysISO(30)); markDirty() }}>+месец</button>
                    {nextContact && (
                      <button className="cm-chip-btn" onClick={() => { setNextContact(''); markDirty() }} style={{ color: '#dc2626', borderColor: '#fecaca' }}>изчисти</button>
                    )}
                  </div>
                </div>

                {/* ── Общ бутон за запис на всички CRM полета отгоре ── */}
                {profileDirty && (
                  <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={saveProfile} disabled={savingProfile}
                      style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, opacity: savingProfile ? .6 : 1 }}>
                      {savingProfile ? '⏳ Записва...' : '💾 Запази профила'}
                    </button>
                  </div>
                )}

                {/* ══════════ ЗАКАЧЕНИ БЕЛЕЖКИ ══════════ */}
                {pinnedNotes.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="cm-section-label">📌 Важно</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {pinnedNotes.map(n => (
                        <div key={n.id} style={{ display: 'flex', gap: 8, border: '1px solid #fde68a', background: '#fffbeb', borderRadius: 10, padding: '9px 12px' }}>
                          <button className="cm-pin-btn active" onClick={() => togglePin(n.id, false)} title="Откачи">📌</button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: '#78350f' }}>{n.note}</div>
                            <div style={{ fontSize: 10.5, color: '#b45309', marginTop: 2 }}>{new Date(n.created_at).toLocaleDateString('bg-BG')}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ══════════ БЪРЗА БЕЛЕЖКА ══════════ */}
                <div style={{ marginBottom: 20 }}>
                  <div className="cm-section-label">📝 Добави бележка от обаждане</div>
                  <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                    placeholder="Какво си говорихте? (напр. отглежда 5 дка домати, интересува се от AMINO...)"
                    rows={2}
                    style={{ width: '100%', padding: '9px 11px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontFamily: 'inherit', fontSize: 14, color: '#111', outline: 'none', resize: 'vertical' as const, marginBottom: 8 }}
                    onFocus={e => e.target.style.borderColor = '#2d6a4f'}
                    onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select value={callOutcome} onChange={e => setCallOutcome(e.target.value)} className="cm-mini-input">
                      <option value="">— резултат от обаждане —</option>
                      {Object.entries(OUTCOME_META).map(([key, m]) => (
                        <option key={key} value={key}>{m.icon} {m.label}</option>
                      ))}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
                      <input type="checkbox" checked={pinOnAdd} onChange={e => setPinOnAdd(e.target.checked)} style={{ cursor: 'pointer' }} />
                      📌 закачи отгоре
                    </label>
                    <button onClick={addNote} disabled={savingNote || !newNote.trim()}
                      style={{ marginLeft: 'auto', background: '#1b4332', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, opacity: (savingNote || !newNote.trim()) ? .5 : 1 }}>
                      {savingNote ? '⏳' : '💾 Добави'}
                    </button>
                  </div>
                </div>

                {/* ══════════ ОБЕДИНЕНА ХРОНОЛОГИЯ: поръчки + бележки ══════════ */}
                <div>
                  <div className="cm-section-label">🕓 Хронология</div>
                  {timeline.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 20px', color: '#9ca3af', fontSize: 13 }}>Все още няма история</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {visibleTimeline.map(item => {
                        if (item.kind === 'order') {
                          const o = item.data
                          const s = STATUS_LABELS[o.status] || { label: o.status, color: '#6b7280', bg: '#f3f4f6' }
                          return (
                            <div key={`o-${o.id}`} onClick={() => openOrder(o.id)}
                              style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                              <span style={{ fontSize: 15, flexShrink: 0 }}>📦</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{o.order_number}</span>
                                  <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>
                                </div>
                                <div style={{ fontSize: 11.5, color: '#374151', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                  {(o.order_items || []).map(i => i.product_name.replace(/^\[(POST-PURCHASE|UPSELL|CROSS)\]\s*/, '')).join(' · ')}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#16a34a' }}>{formatPrice(o.total)}</div>
                                <div style={{ fontSize: 10, color: '#9ca3af' }}>{new Date(o.created_at).toLocaleDateString('bg-BG', { day: '2-digit', month: 'short' })}</div>
                              </div>
                            </div>
                          )
                        }
                        const n = item.data
                        const m = n.call_outcome ? OUTCOME_META[n.call_outcome] : null
                        return (
                          <div key={`n-${n.id}`} style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: '9px 12px', background: '#fafafa', display: 'flex', gap: 8 }}>
                            <button className="cm-pin-btn" onClick={() => togglePin(n.id, true)} title="Закачи отгоре">📌</button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 10.5, color: '#9ca3af' }}>{new Date(n.created_at).toLocaleString('bg-BG')}</span>
                                {m && (
                                  <span style={{ fontSize: 9.5, fontWeight: 700, color: m.color, background: '#fff', border: `1px solid ${m.color}33`, borderRadius: 99, padding: '1px 6px' }}>
                                    {m.icon} {m.label}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 13, color: '#111', whiteSpace: 'pre-wrap' as const }}>{n.note}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {timeline.length > 6 && (
                    <button onClick={() => setShowAllHistory(v => !v)}
                      style={{ marginTop: 10, width: '100%', background: 'none', border: '1px dashed #d1d5db', borderRadius: 9, padding: '8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
                      {showAllHistory ? '↑ Покажи по-малко' : `↓ Покажи всички (${timeline.length})`}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
