'use client'
// app/admin/components/OwnProductsTab.tsx — v5
// ✅ НОВИ ПРОМЕНИ v5:
//   - StatsEditor — 3 ключови числа (орг. вещество / хуминови к-ни / pH)
//   - CompositionEditor — химичен състав с прогрес-бар %
//   - composition_ph — отделно поле за pH стойност
//   - OwnProduct type разширен
// ✅ ЗАПАЗЕНИ ПРОМЕНИ v4:
//   - Редактор за FAQ (въпрос/отговор) — пряко в БД, без hard-code
//   - Редактор за "Как работи" (howItWorks) — icon/title/text
//   - Редактор за "Дози по култура" (crops) — name/leaf/soil/seed
//   - Редактор за Testimonial — name/location/text
//   - Редактор за "Защо Atlas Terra" (whyItems) — icon/title/text
//   - Редактор за eco_badges — label/color (green/blue/brown/gold)
//   - Редактор за certifications — масив от стрингове
//   - Редактор за usage_notes (вече textarea с preview)
//   - SEO полета: seo_title, seo_description, seo_keywords
//   - image_alt поле
//   - Всички секции се четат от БД → без нужда от hard-coded съдържание

import { useState, useEffect, useCallback, useRef } from 'react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { toast } from '@/components/ui/Toast'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ProductVariant {
  id: string
  product_id: string
  label: string
  size_liters: number
  price: number
  compare_price: number
  price_per_liter: number
  stock: number
  sort_order: number
  active: boolean
}

interface StatItem {
  label: string
  value: string
  sub?: string
}

interface CompItem {
  name: string
  value: string
  pct?: number
  note?: string
}

interface FaqItem {
  q: string
  a: string
}

interface HowItem {
  icon: string
  title: string
  text: string
}

interface CropRow {
  name: string
  leaf: string
  soil: string
  seed?: string
}

interface WhyItem {
  icon: string
  title: string
  text: string
}

interface EcoBadge {
  label: string
  color: 'green' | 'blue' | 'brown' | 'gold'
}

interface Testimonial {
  name: string
  location: string
  text: string
  rating?: number
}

interface OwnProduct {
  id: string
  name: string
  slug: string
  subtitle?: string
  description?: string
  badge?: string
  emoji?: string
  image_url?: string
  image_alt?: string
  price?: number
  compare_price?: number
  unit?: string
  stock: number
  sort_order?: number
  active: boolean
  features?: string[]
  category?: string
  usage_notes?: string
  // SEO
  seo_title?: string
  seo_description?: string
  seo_keywords?: string
  // Rich content (от БД)
  faq?: FaqItem[]
  how_it_works?: HowItem[]
  crops?: CropRow[]
  testimonial?: Testimonial
  why_items?: WhyItem[]
  eco_badges?: EcoBadge[]
  certifications?: string[]
  // Нови v5
  stats?: StatItem[]
  composition?: CompItem[]
  composition_ph?: string
  product_variants?: ProductVariant[]
}

// ─── Style constants ───────────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  fontFamily: 'inherit', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', background: '#fff', color: '#111827',
}
const focusGreen = (e: React.FocusEvent<HTMLElement>) => ((e.target as HTMLElement).style.borderColor = '#2d6a4f')
const blurGray   = (e: React.FocusEvent<HTMLElement>) => ((e.target as HTMLElement).style.borderColor = '#e5e7eb')

const SectionHeader = ({ title, count }: { title: string; count?: number }) => (
  <div style={{
    fontSize: 11, fontWeight: 800, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    padding: '14px 0 8px', borderTop: '1px solid #f3f4f6',
    marginTop: 4, display: 'flex', gap: 8, alignItems: 'center',
  }}>
    {title}
    {count !== undefined && (
      <span style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: 99, padding: '1px 7px', fontSize: 10 }}>
        {count}
      </span>
    )}
  </div>
)

const Label = ({ children }: { children: React.ReactNode }) => (
  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
    {children}
  </label>
)

// ─── Variant Stock Row ─────────────────────────────────────────────────────────
function VariantStockRow({
  variant,
  onStockChange,
}: {
  variant: ProductVariant
  onStockChange: (id: string, stock: number) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [localStock, setLocalStock] = useState(variant.stock)
  const isOut = localStock === 0

  const toggle = async () => {
    setSaving(true)
    const newStock = isOut ? 10 : 0
    try {
      await onStockChange(variant.id, newStock)
      setLocalStock(newStock)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px', borderRadius: 8,
      background: isOut ? '#fff7ed' : '#f0fdf4',
      border: `1px solid ${isOut ? '#fed7aa' : '#bbf7d0'}`,
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', flex: 1 }}>
        {variant.label}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
        background: isOut ? '#fee2e2' : '#dcfce7',
        color: isOut ? '#991b1b' : '#166534',
      }}>
        {isOut ? '⛔ Изчерпан' : `✓ ${localStock} бр.`}
      </span>
      <button
        onClick={toggle}
        disabled={saving}
        style={{
          padding: '4px 10px', border: 'none', borderRadius: 6,
          cursor: saving ? 'default' : 'pointer',
          fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
          background: isOut ? '#16a34a' : '#f97316',
          color: '#fff', opacity: saving ? 0.7 : 1,
          transition: 'all .15s',
        }}
      >
        {saving ? '...' : (isOut ? '+ В наличност' : '⛔ Изчерпан')}
      </button>
    </div>
  )
}

// ─── StatsEditor ───────────────────────────────────────────────────────────────
function StatsEditor({ items, onChange }: { items: StatItem[]; onChange: (v: StatItem[]) => void }) {
  const add = () => onChange([...items, { label: '', value: '', sub: '' }])
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof StatItem, val: string) => {
    const next = [...items]; next[i] = { ...next[i], [field]: val }; onChange(next)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, lineHeight: 1.6 }}>
        💡 Показват се като 3 карти с ключови числа под заглавието (напр. «84.4% · Орг. вещество · Най-висок клас»). Препоръчват се точно 3.
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280' }}>Stat {i + 1}</span>
            <button onClick={() => remove(i)} style={{ background: '#fee2e2', border: 'none', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <Label>Стойност (голяма)</Label>
              <input value={item.value} onChange={e => update(i, 'value', e.target.value)} placeholder="84.4%" style={inp} onFocus={focusGreen} onBlur={blurGray} />
            </div>
            <div>
              <Label>Етикет</Label>
              <input value={item.label} onChange={e => update(i, 'label', e.target.value)} placeholder="Орг. вещество" style={inp} onFocus={focusGreen} onBlur={blurGray} />
            </div>
          </div>
          <div>
            <Label>Под-текст (малък)</Label>
            <input value={item.sub || ''} onChange={e => update(i, 'sub', e.target.value)} placeholder="Най-висок клас" style={inp} onFocus={focusGreen} onBlur={blurGray} />
          </div>
        </div>
      ))}
      <button onClick={add} style={{ padding: '7px 14px', background: '#f0fdf4', border: '1.5px dashed #bbf7d0', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#16a34a', fontWeight: 700, fontFamily: 'inherit' }}>
        + Добави stat (макс. 3)
      </button>
    </div>
  )
}

// ─── CompositionEditor ─────────────────────────────────────────────────────────
function CompositionEditor({ items, onChange }: { items: CompItem[]; onChange: (v: CompItem[]) => void }) {
  const add = () => onChange([...items, { name: '', value: '', pct: undefined, note: '' }])
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof CompItem, val: any) => {
    const next = [...items]; next[i] = { ...next[i], [field]: val }; onChange(next)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, lineHeight: 1.6 }}>
        💡 Данни от официалния сайт atlasagro.eu. «%» е за визуалния прогрес-бар (0-100, пропорционален — не реалният процент). «Бележка» е незадължителна.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 0.7fr 1.5fr 28px', gap: 6 }}>
        {['Елемент', 'Стойност', 'Бар %', 'Бележка', ''].map((h, i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
        ))}
      </div>
      {items.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 0.7fr 1.5fr 28px', gap: 6, alignItems: 'center' }}>
          <input value={row.name}  onChange={e => update(i, 'name', e.target.value)}  placeholder="Орг. вещество" style={{ ...inp, padding: '7px 10px' }} onFocus={focusGreen} onBlur={blurGray} />
          <input value={row.value} onChange={e => update(i, 'value', e.target.value)} placeholder="84.4%" style={{ ...inp, padding: '7px 10px' }} onFocus={focusGreen} onBlur={blurGray} />
          <input type="number" min={0} max={100} value={row.pct ?? ''} onChange={e => update(i, 'pct', e.target.value ? parseInt(e.target.value) : undefined)} placeholder="84" style={{ ...inp, padding: '7px 8px' }} onFocus={focusGreen} onBlur={blurGray} />
          <input value={row.note || ''} onChange={e => update(i, 'note', e.target.value)} placeholder="Незадължителна бележка" style={{ ...inp, padding: '7px 10px' }} onFocus={focusGreen} onBlur={blurGray} />
          <button onClick={() => remove(i)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '7px 8px', cursor: 'pointer', color: '#dc2626', fontSize: 12 }}>✕</button>
        </div>
      ))}
      <button onClick={add} style={{ padding: '7px 14px', background: '#f0fdf4', border: '1.5px dashed #bbf7d0', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#16a34a', fontWeight: 700, fontFamily: 'inherit' }}>
        + Добави елемент
      </button>
    </div>
  )
}

// ─── FaqEditor ─────────────────────────────────────────────────────────────────
function FaqEditor({ items, onChange }: { items: FaqItem[]; onChange: (v: FaqItem[]) => void }) {
  const add = () => onChange([...items, { q: '', a: '' }])
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i: number, field: 'q' | 'a', val: string) => {
    const next = [...items]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280' }}>Въпрос {i + 1}</span>
            <button onClick={() => remove(i)} style={{ background: '#fee2e2', border: 'none', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>✕</button>
          </div>
          <input
            value={item.q} onChange={e => update(i, 'q', e.target.value)}
            placeholder="Въпрос..." style={{ ...inp, marginBottom: 6 }}
            onFocus={focusGreen} onBlur={blurGray}
          />
          <textarea
            value={item.a} onChange={e => update(i, 'a', e.target.value)}
            placeholder="Отговор..." rows={2}
            style={{ ...inp, resize: 'vertical' }}
            onFocus={focusGreen} onBlur={blurGray}
          />
        </div>
      ))}
      <button onClick={add} style={{ padding: '7px 14px', background: '#f0fdf4', border: '1.5px dashed #bbf7d0', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#16a34a', fontWeight: 700, fontFamily: 'inherit' }}>
        + Добави въпрос
      </button>
    </div>
  )
}

// ─── HowItWorks Editor ─────────────────────────────────────────────────────────
function HowEditor({ items, onChange }: { items: HowItem[]; onChange: (v: HowItem[]) => void }) {
  const add = () => onChange([...items, { icon: '🌱', title: '', text: '' }])
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof HowItem, val: string) => {
    const next = [...items]; next[i] = { ...next[i], [field]: val }; onChange(next)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280' }}>Стъпка {i + 1}</span>
            <button onClick={() => remove(i)} style={{ background: '#fee2e2', border: 'none', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <Label>Emoji</Label>
              <input value={item.icon} onChange={e => update(i, 'icon', e.target.value)} style={inp} onFocus={focusGreen} onBlur={blurGray} />
            </div>
            <div>
              <Label>Заглавие</Label>
              <input value={item.title} onChange={e => update(i, 'title', e.target.value)} placeholder="Активира почвата" style={inp} onFocus={focusGreen} onBlur={blurGray} />
            </div>
          </div>
          <textarea
            value={item.text} onChange={e => update(i, 'text', e.target.value)}
            placeholder="Описание на стъпката..." rows={2}
            style={{ ...inp, resize: 'vertical' }}
            onFocus={focusGreen} onBlur={blurGray}
          />
        </div>
      ))}
      <button onClick={add} style={{ padding: '7px 14px', background: '#f0fdf4', border: '1.5px dashed #bbf7d0', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#16a34a', fontWeight: 700, fontFamily: 'inherit' }}>
        + Добави стъпка
      </button>
    </div>
  )
}

// ─── Crops Editor ──────────────────────────────────────────────────────────────
function CropsEditor({ items, onChange }: { items: CropRow[]; onChange: (v: CropRow[]) => void }) {
  const add = () => onChange([...items, { name: '', leaf: '', soil: '', seed: '' }])
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof CropRow, val: string) => {
    const next = [...items]; next[i] = { ...next[i], [field]: val }; onChange(next)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1.2fr 1.2fr 28px', gap: 6 }}>
        {['Култура', 'Листно', 'Почвено', 'Семена', ''].map((h, i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
        ))}
      </div>
      {items.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1.2fr 1.2fr 28px', gap: 6, alignItems: 'center' }}>
          <input value={row.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Домати" style={{ ...inp, padding: '7px 10px' }} onFocus={focusGreen} onBlur={blurGray} />
          <input value={row.leaf} onChange={e => update(i, 'leaf', e.target.value)} placeholder="300 мл/дка" style={{ ...inp, padding: '7px 10px' }} onFocus={focusGreen} onBlur={blurGray} />
          <input value={row.soil} onChange={e => update(i, 'soil', e.target.value)} placeholder="400 мл/дка" style={{ ...inp, padding: '7px 10px' }} onFocus={focusGreen} onBlur={blurGray} />
          <input value={row.seed || ''} onChange={e => update(i, 'seed', e.target.value)} placeholder="25 мл/100 кг" style={{ ...inp, padding: '7px 10px' }} onFocus={focusGreen} onBlur={blurGray} />
          <button onClick={() => remove(i)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '7px 8px', cursor: 'pointer', color: '#dc2626', fontSize: 12 }}>✕</button>
        </div>
      ))}
      <button onClick={add} style={{ padding: '7px 14px', background: '#f0fdf4', border: '1.5px dashed #bbf7d0', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#16a34a', fontWeight: 700, fontFamily: 'inherit' }}>
        + Добави култура
      </button>
    </div>
  )
}

// ─── WhyItems Editor ───────────────────────────────────────────────────────────
function WhyEditor({ items, onChange }: { items: WhyItem[]; onChange: (v: WhyItem[]) => void }) {
  const add = () => onChange([...items, { icon: '✅', title: '', text: '' }])
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof WhyItem, val: string) => {
    const next = [...items]; next[i] = { ...next[i], [field]: val }; onChange(next)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => (
        <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280' }}>Причина {i + 1}</span>
            <button onClick={() => remove(i)} style={{ background: '#fee2e2', border: 'none', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', fontSize: 11, color: '#dc2626' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 8, marginBottom: 8 }}>
            <div><Label>Emoji</Label><input value={item.icon} onChange={e => update(i, 'icon', e.target.value)} style={inp} onFocus={focusGreen} onBlur={blurGray} /></div>
            <div><Label>Заглавие</Label><input value={item.title} onChange={e => update(i, 'title', e.target.value)} placeholder="Сертифициран" style={inp} onFocus={focusGreen} onBlur={blurGray} /></div>
          </div>
          <textarea value={item.text} onChange={e => update(i, 'text', e.target.value)} placeholder="Описание..." rows={2} style={{ ...inp, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
        </div>
      ))}
      <button onClick={add} style={{ padding: '7px 14px', background: '#f0fdf4', border: '1.5px dashed #bbf7d0', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#16a34a', fontWeight: 700, fontFamily: 'inherit' }}>
        + Добави причина
      </button>
    </div>
  )
}

// ─── EcoBadges Editor ─────────────────────────────────────────────────────────
function EcoBadgesEditor({ items, onChange }: { items: EcoBadge[]; onChange: (v: EcoBadge[]) => void }) {
  const colorOptions: EcoBadge['color'][] = ['green', 'blue', 'brown', 'gold']
  const colorLabels: Record<EcoBadge['color'], string> = { green: '🟢 Зелен', blue: '🔵 Син', brown: '🟤 Кафяв', gold: '🟡 Злато' }
  const add = () => onChange([...items, { label: '', color: 'green' }])
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const update = (i: number, field: keyof EcoBadge, val: any) => {
    const next = [...items]; next[i] = { ...next[i], [field]: val }; onChange(next)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((badge, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={badge.label} onChange={e => update(i, 'label', e.target.value)} placeholder="✓ Екосхема 3" style={{ ...inp, flex: 2 }} onFocus={focusGreen} onBlur={blurGray} />
          <select
            value={badge.color}
            onChange={e => update(i, 'color', e.target.value)}
            style={{ ...inp, flex: 1 }}
          >
            {colorOptions.map(c => <option key={c} value={c}>{colorLabels[c]}</option>)}
          </select>
          <button onClick={() => remove(i)} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '7px 8px', cursor: 'pointer', color: '#dc2626', fontSize: 12, flexShrink: 0 }}>✕</button>
        </div>
      ))}
      <button onClick={add} style={{ padding: '7px 14px', background: '#f0fdf4', border: '1.5px dashed #bbf7d0', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#16a34a', fontWeight: 700, fontFamily: 'inherit' }}>
        + Добави badge
      </button>
    </div>
  )
}

// ─── Testimonial Editor ────────────────────────────────────────────────────────
function TestimonialEditor({ value, onChange }: { value: Testimonial; onChange: (v: Testimonial) => void }) {
  const update = (field: keyof Testimonial, val: any) => onChange({ ...value, [field]: val })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><Label>Име</Label><input value={value.name || ''} onChange={e => update('name', e.target.value)} placeholder="Иван Георгиев" style={inp} onFocus={focusGreen} onBlur={blurGray} /></div>
        <div><Label>Местоположение</Label><input value={value.location || ''} onChange={e => update('location', e.target.value)} placeholder="Пловдивско · Домати" style={inp} onFocus={focusGreen} onBlur={blurGray} /></div>
      </div>
      <div>
        <Label>Оценка (1-5)</Label>
        <input type="number" min={1} max={5} value={value.rating || 5} onChange={e => update('rating', parseFloat(e.target.value) || 5)} style={{ ...inp, width: 80 }} onFocus={focusGreen} onBlur={blurGray} />
      </div>
      <div>
        <Label>Текст на отзива</Label>
        <textarea value={value.text || ''} onChange={e => update('text', e.target.value)} placeholder='"Отзив..."' rows={3} style={{ ...inp, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export function OwnProductsTab() {
  const [products,    setProducts]    = useState<OwnProduct[]>([])
  const [loading,     setLoading]     = useState(false)
  const [editing,     setEditing]     = useState<OwnProduct | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [togglingId,  setTogglingId]  = useState<string | null>(null)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [activeTab,   setActiveTab]   = useState<'basic' | 'content' | 'seo'>('basic')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/own-products?include_variants=true')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setProducts(data.products || [])
    } catch (e: any) {
      toast.error('Грешка при зареждане: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Quick stock toggle за продукт ─────────────────────────────────────────
  const quickToggleStock = async (product: OwnProduct) => {
    setTogglingId(product.id)
    const isOut = product.stock === 0
    const newStock = isOut ? 10 : 0
    try {
      const res = await fetch(`/api/own-products/${product.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock } : p))
      toast.success(isOut ? `✓ ${product.name} — върнат в наличност` : `⛔ ${product.name} — маркиран като изчерпан`)
    } catch (e: any) {
      toast.error('Грешка: ' + e.message)
    } finally {
      setTogglingId(null)
    }
  }

  // ── Quick stock toggle за вариант ─────────────────────────────────────────
  const toggleVariantStock = async (variantId: string, newStock: number) => {
    const res = await fetch(`/api/own-products/variants/${variantId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: newStock }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    setProducts(prev => prev.map(p => ({
      ...p,
      product_variants: p.product_variants?.map(v =>
        v.id === variantId ? { ...v, stock: newStock } : v
      ),
    })))
    toast.success(newStock === 0 ? '⛔ Вариантът е маркиран като изчерпан' : '✓ Вариантът е върнат в наличност')
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const { product_variants, ...payload } = editing as any
      const isNew = !payload.id
      const url   = isNew ? '/api/own-products' : `/api/own-products/${payload.id}`
      const res   = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`) }
      toast.success(isNew ? 'Продуктът е създаден!' : 'Запазено успешно!')
      setEditing(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const del = async (id: string) => {
    if (!confirm('Сигурен ли си? Действието е необратимо.')) return
    try {
      const res = await fetch(`/api/own-products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('Изтрито успешно')
      if (editing?.id === id) setEditing(null)
      load()
    } catch (e: any) {
      toast.error('Грешка: ' + e.message)
    }
  }

  const startNew = () => {
    setActiveTab('basic')
    setEditing({
      id: '', name: '', slug: '', subtitle: '', description: '',
      badge: 'Хит', emoji: '🌿', image_url: '', image_alt: '',
      price: 0, compare_price: 0, unit: 'л.', stock: 100,
      sort_order: 0, active: true, features: [], category: 'atlas',
      usage_notes: 'Листно: 150-500 мл/дка. Почвено: 200-500 мл/дка. Семена: 25-50 мл/100 кг.',
      faq: [], how_it_works: [], crops: [],
      why_items: [], eco_badges: [], certifications: [],
      stats: [], composition: [], composition_ph: '',
      testimonial: { name: '', location: '', text: '', rating: 5 },
      seo_title: '', seo_description: '', seo_keywords: '',
    })
  }

  const set = (key: string, val: any) =>
    setEditing(prev => prev ? { ...prev, [key]: val } : null)

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isProductOutOfStock = (p: OwnProduct) => {
    if (p.product_variants && p.product_variants.length > 0) {
      const activeVars = p.product_variants.filter(v => v.active)
      return activeVars.length > 0 ? activeVars.every(v => v.stock === 0) : p.stock === 0
    }
    return p.stock === 0
  }
  const hasVariants = (p: OwnProduct) => p.product_variants && p.product_variants.length > 0

  // ── Tab styles ────────────────────────────────────────────────────────────
  const tabBtn = (tab: typeof activeTab) => ({
    padding: '7px 14px', border: 'none', borderRadius: 7, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
    background: activeTab === tab ? '#1b4332' : '#f3f4f6',
    color: activeTab === tab ? '#fff' : '#374151',
    transition: 'all .15s',
  } as React.CSSProperties)

  return (
    <div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Info bar */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
        🛒 <strong>Собствени продукти</strong> — управлявай наличностите и цялото съдържание на продуктовите страници от тук. Всичко е в БД — без hard-coded текст.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr 480px' : '1fr', gap: 20 }}>

        {/* ── Product List ──────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {loading ? 'Зарежда...' : `${products.length} продукта`}
              {products.filter(isProductOutOfStock).length > 0 && (
                <span style={{ marginLeft: 8, color: '#dc2626', fontWeight: 700 }}>
                  · {products.filter(isProductOutOfStock).length} изчерпани
                </span>
              )}
            </span>
            <button onClick={startNew} style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
              + Добави продукт
            </button>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
                Зарежда...
              </div>
            ) : products.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                Няма продукти. Натисни «+ Добави продукт».
              </div>
            ) : products.map((product, i) => {
              const outOfStock = isProductOutOfStock(product)
              const hasVars    = hasVariants(product)
              const isExpanded = expandedId === product.id
              const isToggling = togglingId === product.id

              return (
                <div key={product.id}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderBottom: (isExpanded || i < products.length - 1) ? '1px solid #f5f5f5' : 'none',
                    background: editing?.id === product.id ? '#f0fdf4' : outOfStock ? '#fffbeb' : '',
                    transition: 'background .1s',
                  }}>
                    {product.image_url ? (
                      <img src={product.image_url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid #e5e7eb' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 8, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        {product.emoji || '📦'}
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{product.name}</span>
                        {outOfStock ? (
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>⛔ ИЗЧЕРПАН</span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#dcfce7', color: '#166534' }}>✓ В наличност</span>
                        )}
                        {product.active === false && <span style={{ fontSize: 11, color: '#ef4444' }}>● Неактивен</span>}
                      </div>

                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {!hasVars && <span>Наличност: <strong style={{ color: outOfStock ? '#dc2626' : '#16a34a' }}>{product.stock} бр.</strong></span>}
                        {hasVars && (
                          <button onClick={() => setExpandedId(isExpanded ? null : product.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6b7280', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>
                            {product.product_variants!.length} варианта {isExpanded ? '▲' : '▼'}
                          </button>
                        )}
                        {/* Content indicators */}
                        {product.faq && product.faq.length > 0 && <span style={{ color: '#16a34a' }}>✓ {product.faq.length} FAQ</span>}
                        {product.how_it_works && product.how_it_works.length > 0 && <span style={{ color: '#0369a1' }}>✓ {product.how_it_works.length} стъпки</span>}
                        {product.crops && product.crops.length > 0 && <span style={{ color: '#7c3aed' }}>✓ {product.crops.length} култури</span>}
                        {product.composition && product.composition.length > 0 && <span style={{ color: '#059669' }}>⚗️ {product.composition.length} съст.</span>}
                        {product.slug && <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#d1d5db' }}>{product.slug}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {!hasVars && (
                        <button onClick={() => quickToggleStock(product)} disabled={isToggling} style={{ padding: '6px 12px', border: 'none', borderRadius: 7, cursor: isToggling ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: outOfStock ? '#16a34a' : '#f97316', color: '#fff', opacity: isToggling ? 0.7 : 1, transition: 'all .15s', whiteSpace: 'nowrap' }}>
                          {isToggling ? '⏳' : (outOfStock ? '+ В наличност' : '⛔ Изчерпан')}
                        </button>
                      )}
                      <button
                        onClick={() => { setActiveTab('basic'); setEditing({ ...product }) }}
                        style={{ background: editing?.id === product.id ? '#dcfce7' : '#f3f4f6', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151', fontWeight: 600 }}
                      >
                        ✏️ Редактирай
                      </button>
                      <button onClick={() => del(product.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#991b1b' }}>✕</button>
                    </div>
                  </div>

                  {hasVars && isExpanded && (
                    <div style={{ padding: '12px 16px 12px 76px', background: '#fafaf9', borderBottom: i < products.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Варианти — управление на наличности
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {product.product_variants!.map(variant => (
                          <VariantStockRow key={variant.id} variant={variant} onStockChange={toggleVariantStock} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Edit Panel ─────────────────────────────────────────────────── */}
        {editing && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20, maxHeight: '92vh', overflowY: 'auto', position: 'sticky', top: 20 }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                {editing.id ? `✏️ ${editing.name || 'Редактирай'}` : '+ Нов продукт'}
              </h3>
              <button onClick={() => setEditing(null)} style={{ background: '#f5f5f5', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>✕</button>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <button style={tabBtn('basic')}   onClick={() => setActiveTab('basic')}>   🧱 Основни</button>
              <button style={tabBtn('content')} onClick={() => setActiveTab('content')}>📝 Съдържание</button>
              <button style={tabBtn('seo')}     onClick={() => setActiveTab('seo')}>     🔍 SEO</button>
            </div>

            {/* ── TAB: BASIC ────────────────────────────────────────────── */}
            {activeTab === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                <ImageUpload
                  value={editing.image_url || ''}
                  onChange={url => set('image_url', url)}
                  folder="products"
                  label="Снимка на продукта"
                  height={160}
                />

                {[
                  { key: 'name',      label: 'Наименование',  placeholder: 'Atlas Terra Nitro' },
                  { key: 'slug',      label: 'Slug (URL)',     placeholder: 'atlas-terra-nitro', mono: true },
                  { key: 'subtitle',  label: 'Подзаглавие',   placeholder: 'Биостимулант за вегетация' },
                  { key: 'image_alt', label: 'Alt текст (снимка)', placeholder: 'Atlas Terra NITRO — азотен биостимулант' },
                  { key: 'badge',     label: 'Badge',          placeholder: 'Хит' },
                  { key: 'emoji',     label: 'Emoji',          placeholder: '🌿' },
                  { key: 'category',  label: 'Категория',      placeholder: 'atlas' },
                ].map(f => (
                  <div key={f.key}>
                    <Label>{f.label}</Label>
                    <input
                      type="text" value={(editing as any)[f.key] || ''}
                      onChange={e => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      style={{ ...inp, ...(f.mono ? { fontFamily: 'monospace' } : {}) }}
                      onFocus={focusGreen} onBlur={blurGray}
                    />
                  </div>
                ))}

                <div>
                  <Label>Описание</Label>
                  <textarea rows={4} value={editing.description || ''} onChange={e => set('description', e.target.value)} placeholder="Описание на продукта..." style={{ ...inp, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
                </div>

                <div>
                  <Label>Предимства (по едно на ред)</Label>
                  <textarea rows={4} value={Array.isArray(editing.features) ? editing.features.join('\n') : ''}
                    onChange={e => set('features', e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean))}
                    placeholder="Повишава добива&#10;Подобрява почвата" style={{ ...inp, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
                </div>

                <div>
                  <Label>Начин на употреба (usage_notes)</Label>
                  <textarea rows={2} value={editing.usage_notes || ''} onChange={e => set('usage_notes', e.target.value)} placeholder="Листно: 150-500 мл/дка. Почвено: 200-500 мл/дка." style={{ ...inp, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>Формат: "Листно: X мл/дка. Почвено: Y мл/дка. Семена: Z мл/100 кг."</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { key: 'price',         label: 'Цена (€)',       placeholder: '14.90' },
                    { key: 'compare_price', label: 'Стара цена (€)', placeholder: '18.00' },
                  ].map(f => (
                    <div key={f.key}>
                      <Label>{f.label}</Label>
                      <input type="number" step="0.01" min="0" value={(editing as any)[f.key] || ''} onChange={e => set(f.key, parseFloat(e.target.value) || 0)} placeholder={f.placeholder} style={inp} onFocus={focusGreen} onBlur={blurGray} />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <Label>Мерна единица</Label>
                    <input type="text" value={editing.unit || ''} onChange={e => set('unit', e.target.value)} placeholder="л." style={inp} onFocus={focusGreen} onBlur={blurGray} />
                  </div>
                  <div>
                    <Label>Наличност (бр.)</Label>
                    <input type="number" min="0" value={editing.stock ?? ''} onChange={e => set('stock', parseInt(e.target.value) || 0)}
                      style={{ ...inp, borderColor: editing.stock === 0 ? '#f97316' : '#e5e7eb' }} onFocus={focusGreen} onBlur={blurGray} />
                    {editing.stock === 0 && <span style={{ fontSize: 11, color: '#f97316', marginTop: 3, display: 'block', fontWeight: 600 }}>⚠️ Ще се покаже като «Изчерпан»</span>}
                  </div>
                  <div>
                    <Label>Ред (sort)</Label>
                    <input type="number" min="0" value={editing.sort_order || 0} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} style={inp} onFocus={focusGreen} onBlur={blurGray} />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}>
                  <input type="checkbox" checked={!!editing.active} onChange={e => set('active', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#2d6a4f' }} />
                  Активен (видим на сайта)
                </label>
              </div>
            )}

            {/* ── TAB: CONTENT ──────────────────────────────────────────── */}
            {activeTab === 'content' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                <SectionHeader title="Ключови числа (Stats)" count={editing.stats?.length} />
                <StatsEditor
                  items={editing.stats || []}
                  onChange={v => set('stats', v)}
                />

                <SectionHeader title="Химичен състав" count={editing.composition?.length} />
                <CompositionEditor
                  items={editing.composition || []}
                  onChange={v => set('composition', v)}
                />
                <div>
                  <Label>pH стойност</Label>
                  <input
                    type="text"
                    value={(editing as any).composition_ph || ''}
                    onChange={e => set('composition_ph', e.target.value)}
                    placeholder="5.5"
                    style={{ ...inp, width: 120 }}
                    onFocus={focusGreen} onBlur={blurGray}
                  />
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 10 }}>Показва се като «pH: 5.5 — неутрален»</span>
                </div>

                <SectionHeader title="Eco Badges" count={editing.eco_badges?.length} />
                <EcoBadgesEditor
                  items={editing.eco_badges || []}
                  onChange={v => set('eco_badges', v)}
                />

                <SectionHeader title="Сертификати" count={editing.certifications?.length} />
                <div>
                  <Label>По едно на ред</Label>
                  <textarea
                    rows={3}
                    value={Array.isArray(editing.certifications) ? editing.certifications.join('\n') : ''}
                    onChange={e => set('certifications', e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean))}
                    placeholder="Регистриран в БАБХ&#10;Сертифициран за Екосхема 3&#10;Биологично земеделие EU"
                    style={{ ...inp, resize: 'vertical' }}
                    onFocus={focusGreen} onBlur={blurGray}
                  />
                </div>

                <SectionHeader title="Как работи (4 стъпки)" count={editing.how_it_works?.length} />
                <HowEditor items={editing.how_it_works || []} onChange={v => set('how_it_works', v)} />

                <SectionHeader title="Дози по култура" count={editing.crops?.length} />
                <CropsEditor items={editing.crops || []} onChange={v => set('crops', v)} />

                <SectionHeader title="Защо да избера" count={editing.why_items?.length} />
                <WhyEditor items={editing.why_items || []} onChange={v => set('why_items', v)} />

                <SectionHeader title="Отзив от клиент" />
                <TestimonialEditor
                  value={editing.testimonial || { name: '', location: '', text: '', rating: 5 }}
                  onChange={v => set('testimonial', v)}
                />

                <SectionHeader title="FAQ (въпроси и отговори)" count={editing.faq?.length} />
                <FaqEditor items={editing.faq || []} onChange={v => set('faq', v)} />

              </div>
            )}

            {/* ── TAB: SEO ──────────────────────────────────────────────── */}
            {activeTab === 'seo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#0c4a6e', lineHeight: 1.7 }}>
                  💡 <strong>SEO съвет:</strong> Заглавието трябва да е 50-60 символа. Описанието — 140-160 символа. Ключовите думи се ползват от schema.org микроданни.
                </div>

                <div>
                  <Label>SEO Заглавие (title tag)</Label>
                  <input type="text" value={editing.seo_title || ''} onChange={e => set('seo_title', e.target.value)} placeholder="Atlas Terra — Органичен Биостимулатор | Denny Angelow" style={inp} onFocus={focusGreen} onBlur={blurGray} />
                  <span style={{ fontSize: 11, color: editing.seo_title && editing.seo_title.length > 60 ? '#dc2626' : '#9ca3af' }}>
                    {editing.seo_title?.length || 0}/60 символа {editing.seo_title && editing.seo_title.length > 60 ? '⚠️ Твърде дълго' : ''}
                  </span>
                </div>

                <div>
                  <Label>SEO Описание (meta description)</Label>
                  <textarea rows={3} value={editing.seo_description || ''} onChange={e => set('seo_description', e.target.value)} placeholder="Atlas Terra е течен биостимулатор..." style={{ ...inp, resize: 'vertical' }} onFocus={focusGreen} onBlur={blurGray} />
                  <span style={{ fontSize: 11, color: editing.seo_description && editing.seo_description.length > 160 ? '#dc2626' : '#9ca3af' }}>
                    {editing.seo_description?.length || 0}/160 символа {editing.seo_description && editing.seo_description.length > 160 ? '⚠️ Твърде дълго' : ''}
                  </span>
                </div>

                <div>
                  <Label>Ключови думи (SEO keywords, запетая)</Label>
                  <textarea rows={3} value={editing.seo_keywords || ''} onChange={e => set('seo_keywords', e.target.value)} placeholder="atlas terra, органичен биостимулатор, хуминови киселини" style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} onFocus={focusGreen} onBlur={blurGray} />
                </div>

                {/* SEO preview */}
                {(editing.seo_title || editing.name) && (
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, fontFamily: 'Arial, sans-serif' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Предварителен изглед — Google</div>
                    <div style={{ fontSize: 18, color: '#1a0dab', marginBottom: 3, fontWeight: 400, lineHeight: 1.3 }}>
                      {editing.seo_title || editing.name}
                    </div>
                    <div style={{ fontSize: 14, color: '#006621', marginBottom: 4 }}>
                      https://dennyangelow.com/products/{editing.slug}
                    </div>
                    <div style={{ fontSize: 14, color: '#4d5156', lineHeight: 1.6 }}>
                      {editing.seo_description || editing.description?.slice(0, 160) || '—'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Save / Cancel */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
              <button onClick={() => setEditing(null)} style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: 9, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#374151' }}>
                Отказ
              </button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: '10px', background: saving ? '#6b7280' : '#1b4332', color: '#fff', border: 'none', borderRadius: 9, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
                {saving ? '⏳ Запазва...' : '✓ Запази промените'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
