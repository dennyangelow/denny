'use client'
// app/admin/components/ContentTab.tsx — v3 с ImageUpload

import { useState, useEffect, useCallback } from 'react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { toast } from '@/components/ui/Toast'

type SubTab = 'naruchnici' | 'affiliate' | 'own' | 'links'

interface BaseItem { id: string; [key: string]: any }

export function ContentTab() {
  const [subTab, setSubTab] = useState<SubTab>('naruchnici')
  const [items, setItems]   = useState<BaseItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<BaseItem | null>(null)
  const [saving, setSaving]   = useState(false)

  const config: Record<SubTab, { label: string; api: string; fields: { key: string; label: string; type: string; placeholder?: string }[]; imageField?: string; imageFolder?: string }> = {
    naruchnici: {
      label: 'Наръчници', api: '/api/naruchnici',
      imageField: 'cover_image_url', imageFolder: 'naruchnici',
      fields: [
        { key: 'title',           label: 'Заглавие',      type: 'text',     placeholder: 'Тайните на едрите домати' },
        { key: 'subtitle',        label: 'Подзаглавие',   type: 'text',     placeholder: 'Пълен наръчник за...' },
        { key: 'slug',            label: 'Slug (URL)',     type: 'text',     placeholder: 'super-domati' },
        { key: 'description',     label: 'Описание',      type: 'textarea', placeholder: 'Описание...' },
        { key: 'pdf_url',         label: 'PDF URL',       type: 'url',      placeholder: 'https://...' },
        { key: 'category',        label: 'Категория',     type: 'text',     placeholder: 'domati' },
        { key: 'sort_order',      label: 'Ред (число)',   type: 'number',   placeholder: '0' },
        { key: 'active',          label: 'Активен',       type: 'checkbox' },
      ],
    },
    affiliate: {
      label: 'Афилиейт продукти', api: '/api/affiliate-products',
      imageField: 'image_url', imageFolder: 'affiliate',
      fields: [
        { key: 'name',          label: 'Наименование',  type: 'text',     placeholder: 'Кристалон Зелен' },
        { key: 'slug',          label: 'Slug',          type: 'text',     placeholder: 'kristalon' },
        { key: 'badge_text',    label: 'Бадж',          type: 'text',     placeholder: 'Най-използван' },
        { key: 'subtitle',      label: 'Подзаглавие',   type: 'text',     placeholder: 'NPK тор' },
        { key: 'description',   label: 'Описание',      type: 'textarea', placeholder: 'Описание...' },
        { key: 'affiliate_url', label: 'Affiliate URL', type: 'url',      placeholder: 'https://...' },
        { key: 'partner',       label: 'Партньор',      type: 'text',     placeholder: 'agroapteki' },
        { key: 'color',         label: 'Цвят (HEX)',    type: 'color' },
        { key: 'tag_text',      label: 'Таг',           type: 'text',     placeholder: '⭐ Фаворит' },
        { key: 'sort_order',    label: 'Ред',           type: 'number',   placeholder: '0' },
        { key: 'active',        label: 'Активен',       type: 'checkbox' },
      ],
    },
    own: {
      label: 'Собствени продукти', api: '/api/own-products',
      imageField: 'image_url', imageFolder: 'products',
      fields: [
        { key: 'name',          label: 'Наименование',     type: 'text',     placeholder: 'Atlas Terra' },
        { key: 'slug',          label: 'Slug',             type: 'text',     placeholder: 'atlas-terra' },
        { key: 'description',   label: 'Описание',         type: 'textarea', placeholder: 'Описание...' },
        { key: 'price',         label: 'Цена (€)',         type: 'number',   placeholder: '14.90' },
        { key: 'compare_price', label: 'Стара цена (€)',   type: 'number',   placeholder: '18.00' },
        { key: 'unit',          label: 'Мерна единица',    type: 'text',     placeholder: 'кг' },
        { key: 'stock',         label: 'Наличност',        type: 'number',   placeholder: '100' },
        { key: 'sort_order',    label: 'Ред',              type: 'number',   placeholder: '0' },
        { key: 'active',        label: 'Активен',          type: 'checkbox' },
      ],
    },
    links: {
      label: 'Категорийни линкове', api: '/api/category-links',
      fields: [
        { key: 'icon',       label: 'Иконка (emoji)',  type: 'text',    placeholder: '🌱' },
        { key: 'label',      label: 'Надпис',          type: 'text',    placeholder: 'Торове и Стимулатори' },
        { key: 'link',       label: 'URL',             type: 'url',     placeholder: 'https://...' },
        { key: 'color',      label: 'Цвят (HEX)',      type: 'color' },
        { key: 'sort_order', label: 'Ред',             type: 'number',  placeholder: '0' },
        { key: 'active',     label: 'Активен',         type: 'checkbox' },
      ],
    },
  }

  const cfg = config[subTab]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(cfg.api)
      const data = await res.json()
      const key  = subTab === 'naruchnici' ? 'naruchnici' : subTab === 'links' ? 'links' : 'products'
      setItems(data[key] || [])
    } catch { toast.error('Грешка при зареждане') }
    finally { setLoading(false) }
  }, [cfg.api, subTab])

  useEffect(() => { load(); setEditing(null) }, [subTab])

  const startNew = () => {
    const defaults: BaseItem = { id: '' }
    cfg.fields.forEach(f => {
      defaults[f.key] = f.type === 'checkbox' ? true : f.type === 'number' ? 0 : f.type === 'color' ? '#16a34a' : ''
    })
    if (cfg.imageField) defaults[cfg.imageField] = ''
    setEditing(defaults)
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const isNew  = !editing.id
      const method = isNew ? 'POST' : 'PATCH'
      const url    = isNew ? cfg.api : `${cfg.api}/${editing.id}`
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Грешка')
      }
      toast.success(isNew ? 'Създадено успешно!' : 'Запазено успешно!')
      setEditing(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const del = async (id: string) => {
    if (!confirm('Сигурен ли си, че искаш да изтриеш?')) return
    try {
      const res = await fetch(`${cfg.api}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Изтрито')
      load()
    } catch { toast.error('Грешка при изтриване') }
  }

  const set = (key: string, val: any) => setEditing(prev => prev ? { ...prev, [key]: val } : null)

  const subTabs: SubTab[] = ['naruchnici', 'affiliate', 'own', 'links']
  const subLabels: Record<SubTab, string> = { naruchnici: '📗 Наръчници', affiliate: '🔗 Афилиейт', own: '🛒 Собствени', links: '🏷️ Линкове' }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: '0 0 16px' }}>Съдържание</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {subTabs.map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${subTab===t?'#2d6a4f':'var(--border)'}`, background: subTab===t?'#2d6a4f':'#fff', color: subTab===t?'#fff':'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, transition: 'all .15s' }}>
              {subLabels[t]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr 420px' : '1fr', gap: 20 }}>
        {/* List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{items.length} записа</span>
            <button onClick={startNew} style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
              + Добави нов
            </button>
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Зарежда...</div>
            ) : items.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Няма записи. Добави първия!</div>
            ) : (
              items.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < items.length-1 ? '1px solid #f5f5f5' : 'none', transition: 'background .1s' }}
                  onMouseEnter={e=>(e.currentTarget.style.background='#f9fafb')}
                  onMouseLeave={e=>(e.currentTarget.style.background='')}>
                  {(cfg.imageField && item[cfg.imageField]) && (
                    <img src={item[cfg.imageField]} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: '#f3f4f6' }} onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title || item.name || item.label || item.id}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                      {item.slug || item.affiliate_url || item.link || '—'}
                      {item.active === false && <span style={{ marginLeft: 8, color: '#ef4444', fontSize: 11 }}>● Неактивен</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setEditing({ ...item })} style={{ background: '#f3f4f6', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151', fontWeight: 600 }}>✏️ Редактирай</button>
                    <button onClick={() => del(item.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#991b1b' }}>✕</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Edit panel */}
        {editing && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20, maxHeight: '85vh', overflowY: 'auto', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                {editing.id ? 'Редактирай' : 'Нов запис'}
              </h3>
              <button onClick={() => setEditing(null)} style={{ background: '#f5f5f5', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Image upload */}
              {cfg.imageField && (
                <ImageUpload
                  value={editing[cfg.imageField] || ''}
                  onChange={url => set(cfg.imageField!, url)}
                  folder={cfg.imageFolder || 'products'}
                  label="Снимка"
                  height={140}
                />
              )}

              {/* Form fields */}
              {cfg.fields.map(f => (
                <div key={f.key}>
                  {f.type !== 'checkbox' && (
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  )}
                  {f.type === 'textarea' ? (
                    <textarea rows={3} value={editing[f.key] || ''} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder}
                      style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e5e7eb', borderRadius:8, fontFamily:'inherit', fontSize:13, outline:'none', resize:'vertical', boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor='#2d6a4f'} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                  ) : f.type === 'checkbox' ? (
                    <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'#374151', fontWeight:600 }}>
                      <input type="checkbox" checked={!!editing[f.key]} onChange={e=>set(f.key,e.target.checked)} style={{ width:16, height:16 }}/>
                      {f.label}
                    </label>
                  ) : f.type === 'color' ? (
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <input type="color" value={editing[f.key]||'#16a34a'} onChange={e=>set(f.key,e.target.value)} style={{ width:40, height:36, border:'1px solid #e5e7eb', borderRadius:6, cursor:'pointer', padding:2 }}/>
                      <input type="text" value={editing[f.key]||''} onChange={e=>set(f.key,e.target.value)} placeholder="#16a34a"
                        style={{ flex:1, padding:'8px 12px', border:'1.5px solid #e5e7eb', borderRadius:8, fontFamily:'monospace', fontSize:13, outline:'none', boxSizing:'border-box' }}
                        onFocus={e=>e.target.style.borderColor='#2d6a4f'} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                    </div>
                  ) : (
                    <input type={f.type} value={editing[f.key] ?? ''} onChange={e=>set(f.key, f.type==='number' ? Number(e.target.value) : e.target.value)} placeholder={f.placeholder}
                      step={f.type==='number'?'0.01':undefined} min={f.type==='number'?'0':undefined}
                      style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #e5e7eb', borderRadius:8, fontFamily:'inherit', fontSize:13, outline:'none', boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor='#2d6a4f'} onBlur={e=>e.target.style.borderColor='#e5e7eb'}/>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => setEditing(null)} style={{ flex:1, padding:'10px', border:'1px solid var(--border)', borderRadius:9, background:'#fff', cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>Отказ</button>
              <button onClick={save} disabled={saving} style={{ flex:2, padding:'10px', background:'#1b4332', color:'#fff', border:'none', borderRadius:9, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:700, opacity:saving?.6:1 }}>
                {saving ? '⏳ Запазва...' : '✓ Запази'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}