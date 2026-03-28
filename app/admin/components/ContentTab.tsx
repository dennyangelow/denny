'use client'
// app/admin/components/ContentTab.tsx — v3 FULL CMS

import { useState, useEffect, useCallback } from 'react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { toast } from '@/components/ui/Toast'

type Section = 'atlas' | 'affiliate' | 'ginegar' | 'testimonials' | 'faq' | 'category'

// ── Shared helpers ───────────────────────────────────────
const inputStyle = (focus = false) => ({
  width: '100%', padding: '9px 12px', border: `1.5px solid ${focus ? '#2d6a4f' : '#e5e7eb'}`,
  borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none',
  background: '#fff', color: '#111', boxSizing: 'border-box' as const,
})

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>{children}</label>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><Label>{label}</Label>{children}</div>
}

// ── Atlas Terra Product Editor ───────────────────────────
function AtlasProductEditor() {
  const [products, setProducts] = useState<any[]>([])
  const [variants, setVariants] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [pr, vr] = await Promise.all([
      fetch('/api/own-products').then(r => r.json()),
      fetch('/api/own-products/variants').then(r => r.json()),
    ])
    setProducts(pr.products || [])
    setVariants(vr.variants || [])
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await fetch(`/api/own-products/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selected.name, subtitle: selected.subtitle,
          description: selected.description, badge: selected.badge,
          emoji: selected.emoji, usage_notes: selected.usage_notes,
          image_url: selected.image_url, active: selected.active,
          features: typeof selected.features === 'string'
            ? JSON.parse(selected.features)
            : selected.features,
        }),
      })
      toast.success('Продуктът е запазен!')
      load()
    } catch { toast.error('Грешка при запазване') }
    finally { setSaving(false) }
  }

  const saveVariant = async (v: any) => {
    const method = v.id ? 'PATCH' : 'POST'
    const url    = v.id ? `/api/own-products/variants/${v.id}` : '/api/own-products/variants'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v),
    })
    toast.success('Variant запазен!')
    load()
  }

  const deleteVariant = async (id: string) => {
    if (!confirm('Изтрий variant?')) return
    await fetch(`/api/own-products/variants/${id}`, { method: 'DELETE' })
    toast.success('Изтрит')
    load()
  }

  const productVariants = selected
    ? variants.filter(v => v.product_id === selected.id)
    : []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
      {/* Product list */}
      <div>
        {products.map(p => (
          <button key={p.id} onClick={() => setSelected({ ...p })}
            style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: `1.5px solid ${selected?.id === p.id ? '#2d6a4f' : '#e5e7eb'}`, borderRadius: 10, cursor: 'pointer', background: selected?.id === p.id ? '#f0fdf4' : '#fff', marginBottom: 8, fontFamily: 'inherit' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{p.emoji} {p.name}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{p.active ? '✅ Активен' : '❌ Неактивен'}</div>
          </button>
        ))}
      </div>

      {selected ? (
        <div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{selected.name}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selected.active}
                    onChange={e => setSelected((p: any) => ({ ...p, active: e.target.checked }))} />
                  Активен
                </label>
                <button onClick={save} disabled={saving}
                  style={{ background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {saving ? '⏳' : '💾 Запази'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Emoji">
                <input style={inputStyle()} value={selected.emoji || ''}
                  onChange={e => setSelected((p: any) => ({ ...p, emoji: e.target.value }))} />
              </Field>
              <Field label="Badge">
                <input style={inputStyle()} value={selected.badge || ''}
                  onChange={e => setSelected((p: any) => ({ ...p, badge: e.target.value }))} />
              </Field>
              <Field label="Подзаглавие" >
                <input style={inputStyle()} value={selected.subtitle || ''}
                  onChange={e => setSelected((p: any) => ({ ...p, subtitle: e.target.value }))} />
              </Field>
            </div>

            <Field label="Описание">
              <textarea rows={4} style={{ ...inputStyle(), resize: 'vertical' }}
                value={selected.description || ''}
                onChange={e => setSelected((p: any) => ({ ...p, description: e.target.value }))} />
            </Field>

            <Field label="Начин на употреба">
              <textarea rows={2} style={{ ...inputStyle(), resize: 'vertical' }}
                value={selected.usage_notes || ''}
                onChange={e => setSelected((p: any) => ({ ...p, usage_notes: e.target.value }))} />
            </Field>

            <Field label="Предимства (едно на ред)">
              <textarea rows={6} style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                value={
                  Array.isArray(selected.features)
                    ? selected.features.join('\n')
                    : typeof selected.features === 'string'
                      ? JSON.parse(selected.features || '[]').join('\n')
                      : ''
                }
                onChange={e => setSelected((p: any) => ({
                  ...p,
                  features: e.target.value.split('\n').filter(Boolean),
                }))}
              />
            </Field>

            <ImageUpload
              label="Снимка на продукта"
              value={selected.image_url || ''}
              onChange={url => setSelected((p: any) => ({ ...p, image_url: url }))}
              folder="products"
            />
          </div>

          {/* Variants */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>📦 Варианти (5л / 20л)</h3>
              <button onClick={() => saveVariant({ product_id: selected.id, label: 'Нов вариант', size_liters: 5, price: 0, active: true, sort_order: productVariants.length + 1 })}
                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#065f46', fontFamily: 'inherit' }}>
                + Добави вариант
              </button>
            </div>
            {productVariants.map(v => (
              <VariantRow key={v.id} variant={v} onSave={saveVariant} onDelete={deleteVariant} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14, height: 200 }}>
          Избери продукт за редактиране →
        </div>
      )}
    </div>
  )
}

function VariantRow({ variant, onSave, onDelete }: { variant: any; onSave: (v: any) => void; onDelete: (id: string) => void }) {
  const [v, setV] = useState(variant)
  const ppl = v.size_liters > 0 ? (v.price / v.size_liters).toFixed(2) : '0.00'

  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
        <Field label="Етикет">
          <input style={inputStyle()} value={v.label}
            onChange={e => setV((p: any) => ({ ...p, label: e.target.value }))} />
        </Field>
        <Field label="Литри">
          <input type="number" style={inputStyle()} value={v.size_liters}
            onChange={e => setV((p: any) => ({ ...p, size_liters: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label="Цена (€)">
          <input type="number" step="0.01" style={inputStyle()} value={v.price}
            onChange={e => setV((p: any) => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
        </Field>
        <Field label={`€/л → ${ppl} €`}>
          <input type="number" step="0.01" style={{ ...inputStyle(), background: '#f9fafb', color: '#16a34a', fontWeight: 700 }}
            value={ppl} readOnly />
        </Field>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onSave(v)}
            style={{ background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 12, fontFamily: 'inherit' }}>💾</button>
          <button onClick={() => onDelete(v.id)}
            style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
        </div>
      </div>
    </div>
  )
}

// ── Generic List Editor ──────────────────────────────────
function ListEditor<T extends { id?: string; active?: boolean; sort_order?: number }>({
  apiUrl, title, fields, defaultItem, renderPreview,
}: {
  apiUrl: string
  title: string
  fields: { key: string; label: string; type?: string; rows?: number }[]
  defaultItem: Partial<T>
  renderPreview?: (item: T) => React.ReactNode
}) {
  const [items, setItems] = useState<T[]>([])
  const [selected, setSelected] = useState<T | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(apiUrl)
    const d = await r.json()
    setItems(Object.values(d)[0] as T[] || [])
  }, [apiUrl])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const method = (selected as any).id ? 'PATCH' : 'POST'
      const url    = (selected as any).id ? `${apiUrl}/${(selected as any).id}` : apiUrl
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected),
      })
      toast.success('Запазено!')
      load()
      setSelected(null)
    } catch { toast.error('Грешка') }
    finally { setSaving(false) }
  }

  const del = async () => {
    if (!(selected as any)?.id || !confirm('Изтрий?')) return
    await fetch(`${apiUrl}/${(selected as any).id}`, { method: 'DELETE' })
    toast.success('Изтрито')
    setItems(prev => prev.filter(i => (i as any).id !== (selected as any).id))
    setSelected(null)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
      <div>
        <button onClick={() => setSelected({ ...defaultItem } as T)}
          style={{ width: '100%', padding: '9px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#065f46', fontFamily: 'inherit', marginBottom: 10 }}>
          + Добави нов
        </button>
        {items.map((item: any) => (
          <button key={item.id} onClick={() => setSelected({ ...item })}
            style={{ width: '100%', textAlign: 'left', padding: '9px 12px', border: `1.5px solid ${selected && (selected as any).id === item.id ? '#2d6a4f' : '#e5e7eb'}`, borderRadius: 10, cursor: 'pointer', background: selected && (selected as any).id === item.id ? '#f0fdf4' : '#fff', marginBottom: 8, fontFamily: 'inherit' }}>
            {renderPreview ? renderPreview(item) : (
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name || item.question || item.text || item.label || 'Без заглавие'}
              </div>
            )}
            <div style={{ fontSize: 11, color: item.active !== false ? '#16a34a' : '#ef4444' }}>
              {item.active !== false ? '✅ Активен' : '❌ Неактивен'}
            </div>
          </button>
        ))}
      </div>

      {selected ? (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{(selected as any).id ? 'Редактирай' : 'Нов запис'}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {(selected as any).id && (
                <button onClick={del} style={{ background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>🗑️ Изтрий</button>
              )}
              <button onClick={() => setSelected(null)} style={{ background: '#f5f5f5', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>✕</button>
              <button onClick={save} disabled={saving} style={{ background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>
                {saving ? '⏳' : '💾 Запази'}
              </button>
            </div>
          </div>

          {fields.map(f => (
            <Field key={f.key} label={f.label}>
              {f.key === 'image_url' ? (
                <ImageUpload value={(selected as any)[f.key] || ''} onChange={url => setSelected((p: any) => ({ ...p, [f.key]: url }))} folder="content" />
              ) : f.key === 'active' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={(selected as any)[f.key] !== false}
                    onChange={e => setSelected((p: any) => ({ ...p, [f.key]: e.target.checked }))} />
                  Видим на сайта
                </label>
              ) : f.key === 'features' ? (
                <textarea rows={f.rows || 5} style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                  placeholder="Едно предимство на ред"
                  value={
                    Array.isArray((selected as any)[f.key])
                      ? (selected as any)[f.key].join('\n')
                      : typeof (selected as any)[f.key] === 'string'
                        ? JSON.parse((selected as any)[f.key] || '[]').join('\n')
                        : ''
                  }
                  onChange={e => setSelected((p: any) => ({ ...p, [f.key]: e.target.value.split('\n').filter(Boolean) }))}
                />
              ) : f.rows ? (
                <textarea rows={f.rows} style={{ ...inputStyle(), resize: 'vertical' }}
                  value={(selected as any)[f.key] || ''}
                  onChange={e => setSelected((p: any) => ({ ...p, [f.key]: e.target.value }))} />
              ) : (
                <input type={f.type || 'text'} style={inputStyle()}
                  value={(selected as any)[f.key] || ''}
                  onChange={e => setSelected((p: any) => ({ ...p, [f.key]: e.target.value }))} />
              )}
            </Field>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14, height: 200 }}>
          Избери запис или добави нов →
        </div>
      )}
    </div>
  )
}

// ── MAIN ContentTab ──────────────────────────────────────
export function ContentTab() {
  const [section, setSection] = useState<Section>('atlas')

  const tabs: { id: Section; label: string; icon: string }[] = [
    { id: 'atlas',        label: 'Atlas Terra',    icon: '🌱' },
    { id: 'affiliate',    label: 'Афилиейт',       icon: '🔗' },
    { id: 'ginegar',      label: 'Ginegar',         icon: '🏕️' },
    { id: 'testimonials', label: 'Отзиви',          icon: '⭐' },
    { id: 'faq',          label: 'FAQ',             icon: '❓' },
    { id: 'category',     label: 'Категории',       icon: '📂' },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Съдържание</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>Управлявай всичко на сайта от тук</p>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSection(t.id)}
            style={{ padding: '8px 16px', borderRadius: 99, border: `1.5px solid ${section === t.id ? '#2d6a4f' : '#e5e7eb'}`, background: section === t.id ? '#2d6a4f' : '#fff', color: section === t.id ? '#fff' : '#374151', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {section === 'atlas' && <AtlasProductEditor />}

      {section === 'affiliate' && (
        <ListEditor
          apiUrl="/api/affiliate-products"
          title="Афилиейт продукти"
          defaultItem={{ name: '', subtitle: '', description: '', affiliate_url: '', partner: 'agroapteki', section: 'affiliate', color: '#16a34a', active: true, sort_order: 99 }}
          fields={[
            { key: 'name', label: 'Наименование' },
            { key: 'subtitle', label: 'Подзаглавие' },
            { key: 'badge_text', label: 'Badge (напр. Нов)' },
            { key: 'tag_text', label: 'Tag (напр. ⭐ Фаворит)' },
            { key: 'description', label: 'Описание', rows: 3 },
            { key: 'features', label: 'Предимства (едно на ред)', rows: 5 },
            { key: 'image_url', label: 'Снимка' },
            { key: 'affiliate_url', label: 'Линк (agroapteki.com)' },
            { key: 'partner', label: 'Партньор' },
            { key: 'color', label: 'Цвят (hex)' },
            { key: 'sort_order', label: 'Наредба', type: 'number' },
            { key: 'active', label: 'Статус' },
          ]}
        />
      )}

      {section === 'ginegar' && (
        <ListEditor
          apiUrl="/api/ginegar"
          title="Ginegar продукти"
          defaultItem={{ name: '', subtitle: '', description: '', affiliate_url: '', badge: '', color: '#7c3aed', active: true, sort_order: 99 }}
          fields={[
            { key: 'name', label: 'Наименование' },
            { key: 'subtitle', label: 'Подзаглавие' },
            { key: 'badge', label: 'Badge' },
            { key: 'description', label: 'Описание', rows: 3 },
            { key: 'features', label: 'Предимства (едно на ред)', rows: 5 },
            { key: 'image_url', label: 'Снимка' },
            { key: 'affiliate_url', label: 'Линк' },
            { key: 'color', label: 'Цвят (hex)' },
            { key: 'sort_order', label: 'Наредба', type: 'number' },
            { key: 'active', label: 'Статус' },
          ]}
        />
      )}

      {section === 'testimonials' && (
        <ListEditor
          apiUrl="/api/testimonials"
          title="Отзиви"
          defaultItem={{ name: '', location: '', stars: 5, avatar: '👨‍🌾', text: '', active: true, sort_order: 99 }}
          fields={[
            { key: 'name', label: 'Имена' },
            { key: 'location', label: 'Град' },
            { key: 'avatar', label: 'Emoji аватар' },
            { key: 'stars', label: 'Оценка (1-5)', type: 'number' },
            { key: 'text', label: 'Текст на отзива', rows: 3 },
            { key: 'sort_order', label: 'Наредба', type: 'number' },
            { key: 'active', label: 'Статус' },
          ]}
        />
      )}

      {section === 'faq' && (
        <ListEditor
          apiUrl="/api/faq"
          title="FAQ"
          defaultItem={{ question: '', answer: '', category: 'atlas', active: true, sort_order: 99 }}
          fields={[
            { key: 'question', label: 'Въпрос', rows: 2 },
            { key: 'answer', label: 'Отговор', rows: 4 },
            { key: 'category', label: 'Категория (atlas / affiliate / delivery)' },
            { key: 'sort_order', label: 'Наредба', type: 'number' },
            { key: 'active', label: 'Статус' },
          ]}
        />
      )}

      {section === 'category' && (
        <ListEditor
          apiUrl="/api/category-links"
          title="Категорийни линкове"
          defaultItem={{ icon: '🌱', label: '', link: '', color: '#16a34a', active: true, sort_order: 99 }}
          fields={[
            { key: 'icon', label: 'Emoji икона' },
            { key: 'label', label: 'Наименование' },
            { key: 'link', label: 'URL' },
            { key: 'color', label: 'Цвят (hex)' },
            { key: 'sort_order', label: 'Наредба', type: 'number' },
            { key: 'active', label: 'Статус' },
          ]}
        />
      )}
    </div>
  )
}