'use client'
// app/admin/components/ContentTab.tsx — v4 + Специални секции

import { useState, useEffect, useCallback } from 'react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { toast } from '@/components/ui/Toast'

type SubTab = 'naruchnici' | 'affiliate' | 'own' | 'links' | 'special'

interface BaseItem { id: string; [key: string]: any }

type FieldType = 'text' | 'textarea' | 'url' | 'number' | 'color' | 'checkbox' | 'bullets'

interface FieldDef {
  key: string
  label: string
  type: FieldType
  placeholder?: string
}

interface TabConfig {
  label: string
  api: string
  responseKey: string        // ключ в JSON отговора
  imageField?: string
  logoField?: string         // втора снимка (само за special)
  imageFolder?: string
  fields: FieldDef[]
}

const CONFIGS: Record<SubTab, TabConfig> = {
  naruchnici: {
    label: 'Наръчници', api: '/api/naruchnici', responseKey: 'naruchnici',
    imageField: 'cover_image_url', imageFolder: 'naruchnici',
    fields: [
      { key: 'title',      label: 'Заглавие',    type: 'text',     placeholder: 'Тайните на едрите домати' },
      { key: 'subtitle',   label: 'Подзаглавие', type: 'text',     placeholder: 'Пълен наръчник за...' },
      { key: 'slug',       label: 'Slug (URL)',   type: 'text',     placeholder: 'super-domati' },
      { key: 'description',label: 'Описание',    type: 'textarea', placeholder: 'Описание...' },
      { key: 'pdf_url',    label: 'PDF URL',      type: 'url',      placeholder: 'https://...' },
      { key: 'category',   label: 'Категория',   type: 'text',     placeholder: 'domati' },
      { key: 'sort_order', label: 'Ред',         type: 'number',   placeholder: '0' },
      { key: 'active',     label: 'Активен',     type: 'checkbox' },
    ],
  },

  affiliate: {
    label: 'Афилиейт продукти', api: '/api/affiliate-products', responseKey: 'products',
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
    label: 'Собствени продукти', api: '/api/own-products', responseKey: 'products',
    imageField: 'image_url', imageFolder: 'products',
    fields: [
      { key: 'name',          label: 'Наименование',   type: 'text',     placeholder: 'Atlas Terra' },
      { key: 'slug',          label: 'Slug',           type: 'text',     placeholder: 'atlas-terra' },
      { key: 'description',   label: 'Описание',       type: 'textarea', placeholder: 'Описание...' },
      { key: 'price',         label: 'Цена (лв.)',     type: 'number',   placeholder: '14.90' },
      { key: 'compare_price', label: 'Стара цена (лв.)', type: 'number', placeholder: '18.00' },
      { key: 'unit',          label: 'Мерна единица',  type: 'text',     placeholder: 'кг' },
      { key: 'stock',         label: 'Наличност',      type: 'number',   placeholder: '100' },
      { key: 'sort_order',    label: 'Ред',            type: 'number',   placeholder: '0' },
      { key: 'active',        label: 'Активен',        type: 'checkbox' },
    ],
  },

  links: {
    label: 'Категорийни линкове', api: '/api/category-links', responseKey: 'links',
    fields: [
      { key: 'icon',       label: 'Иконка (emoji)', type: 'text',   placeholder: '🌱' },
      { key: 'label',      label: 'Надпис',         type: 'text',   placeholder: 'Торове и Стимулатори' },
      { key: 'link',       label: 'URL',            type: 'url',    placeholder: 'https://...' },
      { key: 'color',      label: 'Цвят (HEX)',     type: 'color' },
      { key: 'sort_order', label: 'Ред',            type: 'number', placeholder: '0' },
      { key: 'active',     label: 'Активен',        type: 'checkbox' },
    ],
  },

  special: {
    label: 'Специални секции', api: '/api/special-sections', responseKey: 'sections',
    imageField: 'image_url', logoField: 'logo_url', imageFolder: 'special-sections',
    fields: [
      { key: 'slug',        label: 'Slug (уникален ID)',          type: 'text',     placeholder: 'ginegar' },
      { key: 'badge_text',  label: 'Badge (малък надпис горе)',   type: 'text',     placeholder: '🏕️ ИЗРАЕЛСКА ТЕХНОЛОГИЯ' },
      { key: 'title',       label: 'Заглавие',                   type: 'text',     placeholder: 'Ginegar — Премиум Найлон за Оранжерии' },
      { key: 'subtitle',    label: 'Подзаглавие (малко, горе)',   type: 'text',     placeholder: 'Израелска технология' },
      { key: 'description', label: 'Описание (параграф)',         type: 'textarea', placeholder: 'Световен стандарт за здравина...' },
      { key: 'bullets',     label: 'Предимства (по едно на ред)', type: 'bullets',  placeholder: '9-слойна технология\nUV защита\nРавномерно осветление' },
      { key: 'button_text', label: 'Текст на бутона',            type: 'text',     placeholder: '👉 Разгледай фолиата на Ginegar' },
      { key: 'button_url',  label: 'URL на бутона',              type: 'url',      placeholder: 'https://...' },
      { key: 'sort_order',  label: 'Ред',                        type: 'number',   placeholder: '0' },
      { key: 'active',      label: 'Активна секция',             type: 'checkbox' },
    ],
  },
}

const SUB_LABELS: Record<SubTab, string> = {
  naruchnici: '📗 Наръчници',
  affiliate:  '🔗 Афилиейт',
  own:        '🛒 Собствени',
  links:      '🏷️ Линкове',
  special:    '🏕️ Специални секции',
}

// ─── Input styles ──────────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: '#fff',
}
const focusGreen = (e: React.FocusEvent<HTMLElement>) => ((e.target as HTMLElement).style.borderColor = '#2d6a4f')
const blurGray   = (e: React.FocusEvent<HTMLElement>) => ((e.target as HTMLElement).style.borderColor = '#e5e7eb')

// ─── Component ────────────────────────────────────────────────────────────────
export function ContentTab() {
  const [subTab,   setSubTab]  = useState<SubTab>('naruchnici')
  const [items,    setItems]   = useState<BaseItem[]>([])
  const [loading,  setLoading] = useState(false)
  const [editing,  setEditing] = useState<BaseItem | null>(null)
  const [saving,   setSaving]  = useState(false)

  const cfg = CONFIGS[subTab]

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(cfg.api)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(data[cfg.responseKey] || [])
    } catch (e: any) {
      toast.error('Грешка при зареждане: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [cfg.api, cfg.responseKey])

  useEffect(() => { load(); setEditing(null) }, [subTab])

  // ── New item defaults ─────────────────────────────────────────────────────
  const startNew = () => {
    const defaults: BaseItem = { id: '' }
    cfg.fields.forEach(f => {
      if (f.type === 'checkbox') defaults[f.key] = true
      else if (f.type === 'number')  defaults[f.key] = 0
      else if (f.type === 'color')   defaults[f.key] = '#16a34a'
      else if (f.type === 'bullets') defaults[f.key] = []
      else defaults[f.key] = ''
    })
    if (cfg.imageField) defaults[cfg.imageField] = ''
    if (cfg.logoField)  defaults[cfg.logoField]  = ''
    setEditing(defaults)
  }

  // ── Save (POST / PATCH) ───────────────────────────────────────────────────
  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const isNew = !editing.id
      const url   = isNew ? cfg.api : `${cfg.api}/${editing.id}`
      const res   = await fetch(url, {
        method:  isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(editing),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `HTTP ${res.status}`)
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

  // ── Delete ────────────────────────────────────────────────────────────────
  const del = async (id: string) => {
    if (!confirm('Сигурен ли си, че искаш да изтриеш този запис?')) return
    try {
      const res = await fetch(`${cfg.api}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('Изтрито успешно')
      if (editing?.id === id) setEditing(null)
      load()
    } catch (e: any) {
      toast.error('Грешка при изтриване: ' + e.message)
    }
  }

  const set = (key: string, val: any) =>
    setEditing(prev => prev ? { ...prev, [key]: val } : null)

  // ── Display name for list ─────────────────────────────────────────────────
  const itemName = (item: BaseItem) =>
    item.title || item.name || item.label || item.slug || item.id

  const itemSub = (item: BaseItem) =>
    item.slug || item.affiliate_url || item.link || item.button_url || '—'

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px' }}>

      {/* Header + sub-tabs */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: '0 0 16px' }}>
          Съдържание
        </h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(CONFIGS) as SubTab[]).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              style={{
                padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 500, transition: 'all .15s',
                border:      `1px solid ${subTab === t ? '#2d6a4f' : 'var(--border)'}`,
                background:  subTab === t ? '#2d6a4f' : '#fff',
                color:       subTab === t ? '#fff'    : 'var(--muted)',
              }}>
              {SUB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Special sections info banner */}
      {subTab === 'special' && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
          🏕️ <strong>Специални секции</strong> се показват на началната страница между препоръчаните продукти и Atlas Terra.
          Всяка секция има тъмнозелен фон, снимка вдясно и бутон. Можеш да добавяш колкото искаш.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr 440px' : '1fr', gap: 20 }}>

        {/* ── List ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {loading ? 'Зарежда...' : `${items.length} записа`}
            </span>
            <button onClick={startNew}
              style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
              + Добави нов
            </button>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
                Зарежда...
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                Няма записи. Натисни «+ Добави нов» за начало.
              </div>
            ) : items.map((item, i) => (
              <div
                key={item.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < items.length - 1 ? '1px solid #f5f5f5' : 'none', transition: 'background .1s', background: editing?.id === item.id ? '#f0fdf4' : '' }}
                onMouseEnter={e => { if (editing?.id !== item.id) e.currentTarget.style.background = '#f9fafb' }}
                onMouseLeave={e => { if (editing?.id !== item.id) e.currentTarget.style.background = '' }}
              >
                {/* Thumbnail */}
                {cfg.imageField && item[cfg.imageField] && (
                  <img
                    src={item[cfg.imageField]} alt=""
                    style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: '#f3f4f6', border: '1px solid #e5e7eb' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {itemName(item)}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{itemSub(item)}</span>
                    {item.active === false && <span style={{ color: '#ef4444', fontSize: 11, flexShrink: 0 }}>● Неактивен</span>}
                    {subTab === 'special' && item.bullets?.length > 0 && (
                      <span style={{ color: '#16a34a', fontSize: 11, flexShrink: 0 }}>✓ {item.bullets.length} предимства</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => setEditing({ ...item })}
                    style={{ background: editing?.id === item.id ? '#dcfce7' : '#f3f4f6', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151', fontWeight: 600 }}>
                    ✏️ Редактирай
                  </button>
                  <button
                    onClick={() => del(item.id)}
                    style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#991b1b' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Edit panel ── */}
        {editing && (
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20, maxHeight: '88vh', overflowY: 'auto', position: 'sticky', top: 20 }}>

            {/* Panel header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                  {editing.id ? `✏️ ${itemName(editing) || 'Редактирай'}` : '+ Нов запис'}
                </h3>
                {subTab === 'special' && (
                  <p style={{ fontSize: 11, color: '#6b7280', margin: '3px 0 0' }}>Специална секция на началната страница</p>
                )}
              </div>
              <button onClick={() => setEditing(null)}
                style={{ background: '#f5f5f5', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Main image upload */}
              {cfg.imageField && (
                <ImageUpload
                  value={editing[cfg.imageField] || ''}
                  onChange={url => set(cfg.imageField!, url)}
                  folder={cfg.imageFolder || 'uploads'}
                  label={cfg.logoField ? 'Главна снимка (вдясно в секцията)' : 'Снимка'}
                  height={160}
                />
              )}

              {/* Logo image upload — само за special */}
              {cfg.logoField && (
                <ImageUpload
                  value={editing[cfg.logoField] || ''}
                  onChange={url => set(cfg.logoField!, url)}
                  folder={cfg.imageFolder || 'uploads'}
                  label="Лого (под снимката, незадължително)"
                  height={90}
                />
              )}

              {/* Form fields */}
              {cfg.fields.map(f => (
                <div key={f.key}>

                  {f.type !== 'checkbox' && (
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                      {f.label}
                    </label>
                  )}

                  {f.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={editing[f.key] || ''}
                      onChange={e => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      style={{ ...inp, resize: 'vertical' }}
                      onFocus={focusGreen} onBlur={blurGray}
                    />

                  ) : f.type === 'bullets' ? (
                    <div>
                      <textarea
                        rows={5}
                        value={Array.isArray(editing[f.key]) ? editing[f.key].join('\n') : ''}
                        onChange={e => set(f.key, e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean))}
                        placeholder={f.placeholder}
                        style={{ ...inp, resize: 'vertical' }}
                        onFocus={focusGreen} onBlur={blurGray}
                      />
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        По едно предимство на всеки ред. Празните редове се игнорират.
                        {Array.isArray(editing[f.key]) && editing[f.key].length > 0 && (
                          <span style={{ color: '#16a34a', marginLeft: 6 }}>✓ {editing[f.key].length} предимства</span>
                        )}
                      </div>
                    </div>

                  ) : f.type === 'checkbox' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={!!editing[f.key]}
                        onChange={e => set(f.key, e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: '#2d6a4f' }}
                      />
                      {f.label}
                    </label>

                  ) : f.type === 'color' ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="color"
                        value={editing[f.key] || '#16a34a'}
                        onChange={e => set(f.key, e.target.value)}
                        style={{ width: 40, height: 36, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', padding: 2, flexShrink: 0 }}
                      />
                      <input
                        type="text"
                        value={editing[f.key] || ''}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder="#16a34a"
                        style={{ ...inp, fontFamily: 'monospace' }}
                        onFocus={focusGreen} onBlur={blurGray}
                      />
                    </div>

                  ) : (
                    <input
                      type={f.type}
                      value={editing[f.key] ?? ''}
                      onChange={e => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                      placeholder={f.placeholder}
                      step={f.type === 'number' ? '0.01' : undefined}
                      min={f.type  === 'number' ? '0'    : undefined}
                      style={inp}
                      onFocus={focusGreen} onBlur={blurGray}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditing(null)}
                style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: 9, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text)' }}>
                Отказ
              </button>
              <button onClick={save} disabled={saving}
                style={{ flex: 2, padding: '10px', background: saving ? '#6b7280' : '#1b4332', color: '#fff', border: 'none', borderRadius: 9, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, transition: 'background .2s' }}>
                {saving ? '⏳ Запазва...' : '✓ Запази'}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
