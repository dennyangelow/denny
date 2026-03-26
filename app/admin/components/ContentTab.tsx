'use client'
// app/admin/components/ContentTab.tsx — v3 с ImageUpload

import { useState, useEffect, useCallback, useRef } from 'react'
import { ImageUpload } from '@/components/ui/ImageUpload'

interface AffProd {
  id: string; name: string; subtitle: string; description: string
  bullets: string[]; image_url: string; affiliate_url: string
  partner: string; slug: string; emoji: string; active: boolean; sort_order: number
}
interface CatLink {
  id: string; label: string; href: string; emoji: string; partner: string | null
  slug: string; active: boolean; sort_order: number
}
interface OwnProd {
  id: string; slug: string; name: string; description: string; price: number
  compare_price: number; unit: string; stock: number; image_url: string
  active: boolean; sort_order: number
}
interface Naruchnik {
  id: string; slug: string; title: string; subtitle: string; description: string
  cover_image_url: string; pdf_url: string; category: string
  active: boolean; sort_order: number; downloads: number
}

type SubTab = 'affiliate' | 'own' | 'links' | 'naruchnici'

const EMPTY_AFF: Omit<AffProd, 'id'> = { name: '', subtitle: '', description: '', bullets: [''], image_url: '', affiliate_url: '', partner: 'agroapteki', slug: '', emoji: '🌿', active: true, sort_order: 99 }
const EMPTY_OWN: Omit<OwnProd, 'id'> = { slug: '', name: '', description: '', price: 0, compare_price: 0, unit: 'бр.', stock: 999, image_url: '', active: true, sort_order: 99 }
const EMPTY_LINK: Omit<CatLink, 'id'> = { label: '', href: '', emoji: '🌱', partner: null, slug: '', active: true, sort_order: 99 }
const EMPTY_NAR: Omit<Naruchnik, 'id' | 'downloads'> = { slug: '', title: '', subtitle: '', description: '', cover_image_url: '', pdf_url: '', category: 'domati', active: true, sort_order: 99 }

export function ContentTab() {
  const [sub, setSub] = useState<SubTab>('affiliate')
  const [aff, setAff] = useState<AffProd[]>([])
  const [own, setOwn] = useState<OwnProd[]>([])
  const [links, setLinks] = useState<CatLink[]>([])
  const [nars, setNars] = useState<Naruchnik[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [affForm, setAffForm] = useState<Omit<AffProd, 'id'>>(EMPTY_AFF)
  const [ownForm, setOwnForm] = useState<Omit<OwnProd, 'id'>>(EMPTY_OWN)
  const [linkForm, setLinkForm] = useState<Omit<CatLink, 'id'>>(EMPTY_LINK)
  const [narForm, setNarForm] = useState<Omit<Naruchnik, 'id' | 'downloads'>>(EMPTY_NAR)
  const [toast, setToast] = useState('')
  const loadedRef = useRef(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    if (loadedRef.current) return
    loadedRef.current = true
    setLoading(true)
    try {
      const [a, o, l, n] = await Promise.all([
        fetch('/api/affiliate-products').then(r => r.json()).catch(() => ({})),
        fetch('/api/own-products').then(r => r.json()).catch(() => ({})),
        fetch('/api/category-links').then(r => r.json()).catch(() => ({})),
        fetch('/api/naruchnici').then(r => r.json()).catch(() => ({})),
      ])
      setAff(a.products || [])
      setOwn(o.products || [])
      setLinks(l.links || [])
      setNars(n.naruchnici || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── AFF ──
  const saveAff = async () => {
    setSaving('aff')
    try {
      if (editing === 'new') {
        const d = await fetch('/api/affiliate-products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(affForm) }).then(r => r.json())
        if (d.product) setAff(prev => [...prev, d.product])
      } else {
        const d = await fetch(`/api/affiliate-products/${editing}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(affForm) }).then(r => r.json())
        if (d.product) setAff(prev => prev.map(p => p.id === editing ? d.product : p))
      }
      setEditing(null); showToast('✓ Запазено!')
    } catch { showToast('❌ Грешка при запазване') }
    finally { setSaving(null) }
  }
  const deleteAff = async (id: string) => { if (!confirm('Изтриване?')) return; await fetch(`/api/affiliate-products/${id}`, { method: 'DELETE' }); setAff(prev => prev.filter(p => p.id !== id)); showToast('Изтрито') }
  const toggleAff = async (p: AffProd) => { const d = await fetch(`/api/affiliate-products/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !p.active }) }).then(r => r.json()); if (d.product) setAff(prev => prev.map(x => x.id === p.id ? d.product : x)) }

  // ── OWN ──
  const saveOwn = async () => {
    setSaving('own')
    try {
      if (editing === 'new') {
        const d = await fetch('/api/own-products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ownForm) }).then(r => r.json())
        if (d.product) setOwn(prev => [...prev, d.product])
      } else {
        const d = await fetch(`/api/own-products/${editing}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ownForm) }).then(r => r.json())
        if (d.product) setOwn(prev => prev.map(p => p.id === editing ? d.product : p))
      }
      setEditing(null); showToast('✓ Запазено!')
    } catch { showToast('❌ Грешка') }
    finally { setSaving(null) }
  }
  const deleteOwn = async (id: string) => { if (!confirm('Изтриване?')) return; await fetch(`/api/own-products/${id}`, { method: 'DELETE' }); setOwn(prev => prev.filter(p => p.id !== id)); showToast('Изтрито') }

  // ── LINKS ──
  const saveLink = async () => {
    setSaving('link')
    try {
      if (editing === 'new') {
        const d = await fetch('/api/category-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(linkForm) }).then(r => r.json())
        if (d.link) setLinks(prev => [...prev, d.link])
      } else {
        const d = await fetch(`/api/category-links/${editing}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(linkForm) }).then(r => r.json())
        if (d.link) setLinks(prev => prev.map(l => l.id === editing ? d.link : l))
      }
      setEditing(null); showToast('✓ Запазено!')
    } catch { showToast('❌ Грешка') }
    finally { setSaving(null) }
  }
  const deleteLink = async (id: string) => { if (!confirm('Изтриване?')) return; await fetch(`/api/category-links/${id}`, { method: 'DELETE' }); setLinks(prev => prev.filter(l => l.id !== id)); showToast('Изтрито') }

  // ── NARUCHNICI ──
  const saveNar = async () => {
    setSaving('nar')
    try {
      if (editing === 'new') {
        const d = await fetch('/api/naruchnici', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(narForm) }).then(r => r.json())
        if (d.naruchnik) setNars(prev => [...prev, d.naruchnik])
      } else {
        const d = await fetch(`/api/naruchnici/${editing}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(narForm) }).then(r => r.json())
        if (d.naruchnik) setNars(prev => prev.map(n => n.id === editing ? d.naruchnik : n))
      }
      setEditing(null); showToast('✓ Запазено!')
    } catch { showToast('❌ Грешка') }
    finally { setSaving(null) }
  }
  const deleteNar = async (id: string) => { if (!confirm('Изтриване?')) return; await fetch(`/api/naruchnici/${id}`, { method: 'DELETE' }); setNars(prev => prev.filter(n => n.id !== id)); showToast('Изтрито') }
  const toggleNar = async (n: Naruchnik) => { const d = await fetch(`/api/naruchnici/${n.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !n.active }) }).then(r => r.json()); if (d.naruchnik) setNars(prev => prev.map(x => x.id === n.id ? d.naruchnik : x)) }

  const startEditAff = (p?: AffProd) => { setEditing(p ? p.id : 'new'); setAffForm(p ? { ...p } : { ...EMPTY_AFF }) }
  const startEditOwn = (p?: OwnProd) => { setEditing(p ? p.id : 'new'); setOwnForm(p ? { ...p } : { ...EMPTY_OWN }) }
  const startEditLink = (l?: CatLink) => { setEditing(l ? l.id : 'new'); setLinkForm(l ? { ...l } : { ...EMPTY_LINK }) }
  const startEditNar = (n?: Naruchnik) => { setEditing(n ? n.id : 'new'); setNarForm(n ? { ...n } : { ...EMPTY_NAR }) }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#6b7280', fontSize: 15 }}>Зарежда съдържание...</div>

  const TABS: [SubTab, string][] = [
    ['affiliate', `Афилиейт (${aff.length})`],
    ['own', `Собствени (${own.length})`],
    ['links', `Линкове (${links.length})`],
    ['naruchnici', `Наръчници (${nars.length})`],
  ]

  return (
    <div style={{ padding: '28px 32px' }}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 20, background: toast.startsWith('❌') ? '#991b1b' : '#0d2b1d', color: toast.startsWith('❌') ? '#fee2e2' : '#4ade80', padding: '12px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,.25)' }}>{toast}</div>}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em' }}>Управление на съдържанието</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Продукти, афилиейт, линкове и наръчници</p>
        </div>
        {editing === null && (
          <button onClick={() => {
            if (sub === 'affiliate') startEditAff()
            else if (sub === 'own') startEditOwn()
            else if (sub === 'links') startEditLink()
            else startEditNar()
          }} style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 600, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
            + Добави
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f4f4f4', borderRadius: 12, padding: 4, width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => { setSub(id); setEditing(null) }}
            style={{ padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', background: sub === id ? '#fff' : 'transparent', color: sub === id ? '#0d2b1d' : '#6b7280', boxShadow: sub === id ? '0 1px 6px rgba(0,0,0,.1)' : 'none', transition: 'all .15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── AFFILIATE ── */}
      {sub === 'affiliate' && (<>
        {editing !== null ? (
          <AffForm form={affForm} setForm={setAffForm} onSave={saveAff} onCancel={() => setEditing(null)} saving={saving === 'aff'} isNew={editing === 'new'} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
            {aff.map(p => (
              <div key={p.id} style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', opacity: p.active ? 1 : 0.55 }}>
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 160, objectFit: 'contain', padding: '12px 24px', background: '#f9fafb' }} />
                  : <div style={{ width: '100%', height: 80, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>{p.emoji}</div>
                }
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{p.emoji}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{p.name}</span>
                    <span style={{ background: p.active ? '#d1fae5' : '#f3f4f6', color: p.active ? '#065f46' : '#6b7280', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{p.active ? 'Активен' : 'Скрит'}</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>{p.subtitle}</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => startEditAff(p)} style={{ flex: 1, background: '#f4f4f4', border: 'none', borderRadius: 8, padding: '8px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>✏️ Редактирай</button>
                    <button onClick={() => toggleAff(p)} style={{ background: p.active ? '#fef3c7' : '#d1fae5', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', color: p.active ? '#92400e' : '#065f46' }}>{p.active ? 'Скрий' : 'Покажи'}</button>
                    <button onClick={() => deleteAff(p.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', color: '#991b1b' }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
            {aff.length === 0 && <div style={{ color: '#6b7280', padding: 40, textAlign: 'center', background: '#f9fafb', borderRadius: 12, border: '1px dashed #e5e7eb' }}>Няма афилиейт продукти</div>}
          </div>
        )}
      </>)}

      {/* ── OWN ── */}
      {sub === 'own' && (<>
        {editing !== null ? (
          <OwnForm form={ownForm} setForm={setOwnForm} onSave={saveOwn} onCancel={() => setEditing(null)} saving={saving === 'own'} isNew={editing === 'new'} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
            {own.map(p => (
              <div key={p.id} style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', opacity: p.active ? 1 : 0.55 }}>
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 160, objectFit: 'contain', padding: '12px 24px', background: '#f9fafb' }} />
                  : <div style={{ width: '100%', height: 80, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>📦</div>
                }
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{p.name}</span>
                    <span style={{ background: p.active ? '#d1fae5' : '#f3f4f6', color: p.active ? '#065f46' : '#6b7280', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{p.active ? 'Активен' : 'Скрит'}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>
                    <strong>{Number(p.price).toFixed(2)} лв.</strong> / {p.unit}
                    {p.compare_price > 0 && <span style={{ textDecoration: 'line-through', color: '#9ca3af', marginLeft: 8 }}>{Number(p.compare_price).toFixed(2)}</span>}
                    <span style={{ marginLeft: 8, color: '#6b7280', fontSize: 12 }}>· Наличност: {p.stock}</span>
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => startEditOwn(p)} style={{ flex: 1, background: '#f4f4f4', border: 'none', borderRadius: 8, padding: '8px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>✏️ Редактирай</button>
                    <button onClick={() => deleteOwn(p.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', color: '#991b1b' }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
            {own.length === 0 && <div style={{ color: '#6b7280', padding: 40, textAlign: 'center', background: '#f9fafb', borderRadius: 12, border: '1px dashed #e5e7eb' }}>Няма собствени продукти</div>}
          </div>
        )}
      </>)}

      {/* ── LINKS ── */}
      {sub === 'links' && (<>
        {editing !== null ? (
          <LinkForm form={linkForm} setForm={setLinkForm} onSave={saveLink} onCancel={() => setEditing(null)} saving={saving === 'link'} isNew={editing === 'new'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {links.map(l => (
              <div key={l.id} style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: l.active ? 1 : 0.5 }}>
                <span style={{ fontSize: 22 }}>{l.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{l.label}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' }}>{l.href}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => startEditLink(l)} style={{ background: '#f4f4f4', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>✏️</button>
                  <button onClick={() => deleteLink(l.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: '#991b1b', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>🗑</button>
                </div>
              </div>
            ))}
            {links.length === 0 && <div style={{ color: '#6b7280', padding: 40, textAlign: 'center', background: '#f9fafb', borderRadius: 12, border: '1px dashed #e5e7eb' }}>Няма категорийни линкове</div>}
          </div>
        )}
      </>)}

      {/* ── NARUCHNICI ── */}
      {sub === 'naruchnici' && (<>
        {editing !== null ? (
          <NarForm form={narForm} setForm={setNarForm} onSave={saveNar} onCancel={() => setEditing(null)} saving={saving === 'nar'} isNew={editing === 'new'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {nars.map(n => (
              <div key={n.id} style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 16, padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', opacity: n.active ? 1 : 0.55 }}>
                {n.cover_image_url
                  ? <img src={n.cover_image_url} alt={n.title} style={{ width: 72, height: 96, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  : <div style={{ width: 72, height: 96, background: '#f0fdf4', borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📗</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{n.title}</span>
                    <span style={{ background: n.active ? '#d1fae5' : '#f3f4f6', color: n.active ? '#065f46' : '#6b7280', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n.active ? 'Активен' : 'Скрит'}</span>
                    <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n.category}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{n.subtitle}</p>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9ca3af', flexWrap: 'wrap' }}>
                    <span>📥 {n.downloads || 0} сваляния</span>
                    <a href={`/naruchnik/${n.slug}`} target="_blank" style={{ color: '#2d6a4f', textDecoration: 'none', fontWeight: 600 }}>↗ Преглед на страницата</a>
                    <span style={{ fontFamily: 'monospace' }}>/naruchnik/{n.slug}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => startEditNar(n)} style={{ background: '#f4f4f4', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>✏️ Редактирай</button>
                  <button onClick={() => toggleNar(n)} style={{ background: n.active ? '#fef3c7' : '#d1fae5', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', color: n.active ? '#92400e' : '#065f46' }}>{n.active ? 'Скрий' : 'Покажи'}</button>
                  <button onClick={() => deleteNar(n.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: '#991b1b', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>🗑 Изтрий</button>
                </div>
              </div>
            ))}
            {nars.length === 0 && <div style={{ color: '#6b7280', padding: 40, textAlign: 'center', background: '#f9fafb', borderRadius: 12, border: '1px dashed #e5e7eb' }}>Няма наръчници. Кликни „+ Добави" за да качиш първия.</div>}
          </div>
        )}
      </>)}

      <style>{`
        .cf { display: flex; flex-direction: column; gap: 14px; }
        .cf label { font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 4px; display: block; }
        .cf input, .cf textarea, .cf select {
          width: 100%; padding: 11px 14px; border: 1.5px solid #e5e7eb;
          border-radius: 9px; font-family: inherit; font-size: 14px; outline: none;
          transition: border-color .2s; color: #111; background: #fff;
        }
        .cf input:focus, .cf textarea:focus, .cf select:focus { border-color: #2d6a4f; }
        .cf textarea { resize: vertical; }
        .form-card { background: #fff; border: 1.5px solid #e5e7eb; border-radius: 18px; padding: 28px; max-width: 720px; }
        .form-card h3 { font-size: 18px; font-weight: 700; margin-bottom: 20px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media(max-width:600px) { .form-row { grid-template-columns: 1fr; } }
        .btn-save { background: #1b4332; color: #fff; border: none; border-radius: 10px; padding: 12px 24px; font-weight: 700; font-size: 14px; font-family: inherit; cursor: pointer; }
        .btn-save:hover { background: #2d6a4f; }
        .btn-save:disabled { opacity: .6; cursor: wait; }
        .btn-cancel { background: #f4f4f4; color: #374151; border: none; border-radius: 10px; padding: 12px 24px; font: 600 14px inherit; cursor: pointer; }
      `}</style>
    </div>
  )
}

// ── Form компоненти ──

function AffForm({ form, setForm, onSave, onCancel, saving, isNew }: { form: Omit<AffProd, 'id'>; setForm: (f: Omit<AffProd, 'id'>) => void; onSave: () => void; onCancel: () => void; saving: boolean; isNew: boolean }) {
  const setBullet = (i: number, v: string) => { const b = [...form.bullets]; b[i] = v; setForm({ ...form, bullets: b }) }
  return (
    <div className="form-card">
      <h3>{isNew ? '+ Нов афилиейт продукт' : '✏️ Редактиране'}</h3>
      <div className="cf">
        <div className="form-row">
          <div><label>Emoji</label><input value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} /></div>
          <div><label>Slug</label><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="kristalon" /></div>
        </div>
        <div><label>Название</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div><label>Подзаглавие</label><input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} /></div>
        <div><label>Описание</label><textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div>
          <label>Предимства</label>
          {form.bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input value={b} onChange={e => setBullet(i, e.target.value)} placeholder={`Предимство ${i + 1}`} />
              <button type="button" onClick={() => setForm({ ...form, bullets: form.bullets.filter((_, j) => j !== i) })} style={{ background: '#fee2e2', border: 'none', borderRadius: 8, padding: '0 10px', cursor: 'pointer', color: '#991b1b', flexShrink: 0 }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setForm({ ...form, bullets: [...form.bullets, ''] })} style={{ background: '#f0fdf4', border: '1px dashed #86efac', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', color: '#166534', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', marginTop: 4 }}>+ Добави предимство</button>
        </div>

        {/* 🆕 ImageUpload вместо само URL */}
        <ImageUpload
          label="Снимка на продукта"
          value={form.image_url}
          onChange={url => setForm({ ...form, image_url: url })}
          folder="affiliate"
          height={160}
        />

        <div><label>Афилиейт URL</label><input value={form.affiliate_url} onChange={e => setForm({ ...form, affiliate_url: e.target.value })} placeholder="https://agroapteki.com/...?tracking=..." /></div>
        <div className="form-row">
          <div><label>Партньор</label><input value={form.partner} onChange={e => setForm({ ...form, partner: e.target.value })} /></div>
          <div><label>Ред (сортиране)</label><input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: +e.target.value })} /></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 'auto' }} />
          <span style={{ fontSize: 14 }}>Активен (видим на сайта)</span>
        </label>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn-cancel" onClick={onCancel}>← Назад</button>
          <button className="btn-save" onClick={onSave} disabled={saving}>{saving ? 'Запазва...' : '✓ Запази'}</button>
        </div>
      </div>
    </div>
  )
}

function OwnForm({ form, setForm, onSave, onCancel, saving, isNew }: { form: Omit<OwnProd, 'id'>; setForm: (f: Omit<OwnProd, 'id'>) => void; onSave: () => void; onCancel: () => void; saving: boolean; isNew: boolean }) {
  return (
    <div className="form-card">
      <h3>{isNew ? '+ Нов продукт' : '✏️ Редактиране'}</h3>
      <div className="cf">
        <div className="form-row">
          <div><label>Slug</label><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></div>
          <div><label>Единица</label><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="кг" /></div>
        </div>
        <div><label>Название</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div><label>Описание</label><textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="form-row">
          <div><label>Цена (лв.)</label><input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} /></div>
          <div><label>Стара цена (лв.)</label><input type="number" step="0.01" value={form.compare_price} onChange={e => setForm({ ...form, compare_price: +e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div><label>Наличност</label><input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: +e.target.value })} /></div>
          <div><label>Ред (сортиране)</label><input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: +e.target.value })} /></div>
        </div>

        {/* 🆕 ImageUpload */}
        <ImageUpload
          label="Снимка на продукта"
          value={form.image_url}
          onChange={url => setForm({ ...form, image_url: url })}
          folder="products"
          height={180}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 'auto' }} />
          <span style={{ fontSize: 14 }}>Активен</span>
        </label>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn-cancel" onClick={onCancel}>← Назад</button>
          <button className="btn-save" onClick={onSave} disabled={saving}>{saving ? 'Запазва...' : '✓ Запази'}</button>
        </div>
      </div>
    </div>
  )
}

function LinkForm({ form, setForm, onSave, onCancel, saving, isNew }: { form: Omit<CatLink, 'id'>; setForm: (f: Omit<CatLink, 'id'>) => void; onSave: () => void; onCancel: () => void; saving: boolean; isNew: boolean }) {
  return (
    <div className="form-card">
      <h3>{isNew ? '+ Нов линк' : '✏️ Редактиране'}</h3>
      <div className="cf">
        <div className="form-row">
          <div><label>Emoji</label><input value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} /></div>
          <div><label>Slug</label><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></div>
        </div>
        <div><label>Етикет</label><input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="🌱 Торове и Био Стимулатори" /></div>
        <div><label>URL</label><input value={form.href} onChange={e => setForm({ ...form, href: e.target.value })} placeholder="https://agroapteki.com/..." /></div>
        <div className="form-row">
          <div><label>Партньор</label><input value={form.partner || ''} onChange={e => setForm({ ...form, partner: e.target.value || null })} /></div>
          <div><label>Ред</label><input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: +e.target.value })} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn-cancel" onClick={onCancel}>← Назад</button>
          <button className="btn-save" onClick={onSave} disabled={saving}>{saving ? 'Запазва...' : '✓ Запази'}</button>
        </div>
      </div>
    </div>
  )
}

function NarForm({ form, setForm, onSave, onCancel, saving, isNew }: { form: Omit<Naruchnik, 'id' | 'downloads'>; setForm: (f: Omit<Naruchnik, 'id' | 'downloads'>) => void; onSave: () => void; onCancel: () => void; saving: boolean; isNew: boolean }) {
  return (
    <div className="form-card">
      <h3>{isNew ? '+ Нов наръчник' : '✏️ Редактиране на наръчник'}</h3>
      <div className="cf">
        <div className="form-row">
          <div><label>Slug (URL)</label><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="super-domati" /></div>
          <div>
            <label>Категория</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="domati">🍅 Домати</option>
              <option value="krastavici">🥒 Краставици</option>
              <option value="chushki">🫑 Чушки</option>
              <option value="kartofi">🥔 Картофи</option>
              <option value="other">🌿 Друго</option>
            </select>
          </div>
        </div>
        <div><label>Заглавие</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Тайните на Едрите Домати" /></div>
        <div><label>Подзаглавие</label><input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} placeholder="Безплатен наръчник за домашни градинари" /></div>
        <div><label>Описание</label><textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>

        {/* 🆕 ImageUpload за корицата */}
        <ImageUpload
          label="📖 Корица (снимка)"
          value={form.cover_image_url}
          onChange={url => setForm({ ...form, cover_image_url: url })}
          folder="naruchnici"
          height={160}
        />

        <div>
          <label>📄 PDF URL (Google Drive, Dropbox, Cloudflare R2...)</label>
          <input value={form.pdf_url} onChange={e => setForm({ ...form, pdf_url: e.target.value })} placeholder="https://drive.google.com/uc?export=download&id=..." />
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
            💡 За Google Drive: File → Share → Копирай ID от URL → <code>https://drive.google.com/uc?export=download&id=FILE_ID</code>
          </p>
        </div>

        <div className="form-row">
          <div><label>Ред (сортиране)</label><input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: +e.target.value })} /></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 'auto' }} />
          <span style={{ fontSize: 14 }}>Активен (видим)</span>
        </label>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#166534' }}>
          📎 Страницата ще е на: <strong>/naruchnik/{form.slug || 'slug'}</strong>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn-cancel" onClick={onCancel}>← Назад</button>
          <button className="btn-save" onClick={onSave} disabled={saving}>{saving ? 'Запазва...' : '✓ Запази'}</button>
        </div>
      </div>
    </div>
  )
}
