'use client'
// app/admin/components/ContentTab.tsx — v4 + Специални секции + Промо Банери

import { useState, useEffect, useCallback } from 'react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { toast } from '@/components/ui/Toast'
import { PromoBannersTab } from './PromoBannersTab'
import { OwnProductsTab } from './OwnProductsTab'

type SubTab = 'naruchnici' | 'affiliate' | 'own' | 'links' | 'special' | 'promos'

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
  pdfField?: string          // PDF upload поле
  imageFolder?: string
  fields: FieldDef[]
}

const CONFIGS: Record<Exclude<SubTab, 'promos'>, TabConfig> = {
  naruchnici: {
    label: 'Наръчници', api: '/api/naruchnici', responseKey: 'naruchnici',
    imageField: 'cover_image_url', imageFolder: 'naruchnici',
    pdfField: 'pdf_url',
    fields: [
      { key: 'title',      label: 'Заглавие',    type: 'text',     placeholder: 'Тайните на едрите домати' },
      { key: 'subtitle',   label: 'Подзаглавие', type: 'text',     placeholder: 'Пълен наръчник за...' },
      { key: 'slug',       label: 'Slug (URL)',   type: 'text',     placeholder: 'super-domati' },
      { key: 'description',label: 'Описание',    type: 'textarea', placeholder: 'Описание...' },
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
      { key: 'subtitle',      label: 'Подзаглавие',    type: 'text',     placeholder: 'Биостимулант...' },
      { key: 'badge',         label: 'Badge',          type: 'text',     placeholder: 'Хит' },
      { key: 'emoji',         label: 'Emoji',          type: 'text',     placeholder: '🌿' },
      { key: 'description',   label: 'Описание',       type: 'textarea', placeholder: 'Описание...' },
      { key: 'features',      label: 'Предимства (по едно на ред)', type: 'bullets', placeholder: 'Повишава добива\nПодобрява почвата' },
      { key: 'category',      label: 'Категория',      type: 'text',     placeholder: 'atlas' },
      { key: 'price',         label: 'Цена (€)',       type: 'number',   placeholder: '14.90' },
      { key: 'compare_price', label: 'Стара цена (€)', type: 'number',   placeholder: '18.00' },
      { key: 'unit',          label: 'Мерна единица',  type: 'text',     placeholder: 'л.' },
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
  promos:     '📣 Промо Банери',
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

// ─── PdfUpload component ───────────────────────────────────────────────────────
function PdfUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Моля избери PDF файл.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Файлът е прекалено голям. Максимум 20 MB.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'naruchnici/pdf')

      const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `HTTP ${res.status}`)
      }
      const { url } = await res.json()
      onChange(url)
    } catch (e: any) {
      setError('Грешка при качване: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const fileName = value ? value.split('/').pop()?.split('?')[0] : null

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
        📄 PDF Файл на наръчника
      </label>

      {/* Drop zone */}
      <label
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: '20px 16px', border: '2px dashed #d1fae5', borderRadius: 12,
          background: uploading ? '#f0fdf4' : '#fafffe', cursor: uploading ? 'default' : 'pointer',
          transition: 'all .2s', textAlign: 'center',
        }}
        onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLElement).style.borderColor = '#16a34a' }}
        onMouseLeave={e => { if (!uploading) (e.currentTarget as HTMLElement).style.borderColor = '#d1fae5' }}
      >
        <input
          type="file" accept="application/pdf"
          style={{ display: 'none' }}
          disabled={uploading}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {uploading ? (
          <>
            <div style={{ width: 24, height: 24, border: '3px solid #d1fae5', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <span style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>Качва се...</span>
          </>
        ) : value ? (
          <>
            <div style={{ fontSize: 28 }}>✅</div>
            <span style={{ fontSize: 12, color: '#15803d', fontWeight: 700 }}>PDF качен успешно</span>
            <span style={{ fontSize: 11, color: '#6b7280', wordBreak: 'break-all', maxWidth: 300 }}>{fileName}</span>
            <span style={{ fontSize: 11, color: '#16a34a', textDecoration: 'underline' }}>Натисни за да смениш файла</span>
          </>
        ) : (
          <>
            <div style={{ fontSize: 28 }}>📄</div>
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>Натисни или провлачи PDF тук</span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>Максимум 20 MB · само .pdf файлове</span>
          </>
        )}
      </label>

      {/* Error */}
      {error && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#dc2626', background: '#fee2e2', borderRadius: 7, padding: '6px 10px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Preview link */}
      {value && !uploading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <a href={value} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}>
            🔗 Отвори PDF в нов таб
          </a>
          <button
            onClick={() => onChange('')}
            style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            Изтрий
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ContentTab() {
  const [subTab,   setSubTab]  = useState<SubTab>('naruchnici')
  const [items,    setItems]   = useState<BaseItem[]>([])
  const [loading,  setLoading] = useState(false)
  const [editing,  setEditing] = useState<BaseItem | null>(null)
  const [saving,   setSaving]  = useState(false)

  const cfg = CONFIGS[subTab as Exclude<SubTab, 'promos'>]

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (subTab === 'promos') return
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
  }, [subTab, cfg?.api, cfg?.responseKey])

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
    if (cfg.pdfField)   defaults[cfg.pdfField]   = ''
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
          {(Object.keys({ ...CONFIGS, promos: true }) as SubTab[]).map(t => (
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

      {/* Promos tab — самостоятелен render */}
      {subTab === 'promos' && (
        <div>
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#9a3412', lineHeight: 1.6 }}>
            📣 <strong>Промо банерите</strong> се показват под собствените продукти (Atlas Terra) на началната страница.
            Можеш да ги активираш/деактивираш и да задаваш срок на валидност.
          </div>
          <PromoBannersTab />
        </div>
      )}

      {/* Own products — dedicated full component with variants */}
      {subTab === 'own' && <OwnProductsTab />}

      {/* Special sections info banner */}
      {subTab === 'special' && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
          🏕️ <strong>Специални секции</strong> се показват на началната страница между препоръчаните продукти и Atlas Terra.
          Всяка секция има тъмнозелен фон, снимка вдясно и бутон. Можеш да добавяш колкото искаш.
        </div>
      )}

      {subTab !== 'promos' && subTab !== 'own' && (
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

              {/* PDF upload — само за наръчници */}
              {cfg.pdfField && (
                <PdfUpload
                  value={editing[cfg.pdfField] || ''}
                  onChange={url => set(cfg.pdfField!, url)}
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
      )}
    </div>
  )
}
