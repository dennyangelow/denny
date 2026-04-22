'use client'
// app/admin/components/ContentTab.tsx — v7
// ✅ ПРОМЕНИ v7 (спрямо v6):
//   - Добавен FieldType 'faq_editor' — визуален FAQ editor (въпрос + отговор)
//   - FaqEditor компонент — добавяй/трий/редактирай FAQ въпроси
//   - Нови полета в affiliate: image_alt, rating, review_count, date_published
//   - startNew() обработва faq_editor тип (default [])
//   - FAQ данните се изпращат директно като масив към Supabase jsonb
// ✅ ЗАПАЗЕНО от v6:
//   - Всички subtab конфигурации (naruchnici, own, links, special, promos)
//   - PdfUpload компонент с drag-and-drop
//   - NaruchnikSeoTab subtab mode
//   - SeoCharCounter компонент
//   - Цялата save/delete/load логика
//   - Slug auto-generation за links tab
//   - SEO badge в листа

import { useState, useEffect, useCallback } from 'react'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { toast } from '@/components/ui/Toast'
import { PromoBannersTab } from './PromoBannersTab'
import { OwnProductsTab } from './OwnProductsTab'
import { NaruchnikSeoTab } from './NaruchnikSeoTab'

type SubTab = 'naruchnici' | 'affiliate' | 'own' | 'links' | 'special' | 'promos'
type NaruchnikMode = 'list' | 'seo'

interface BaseItem { id: string; [key: string]: any }

// ✅ Типове полета (включва нови v8 типове)
type FieldType = 'text' | 'textarea' | 'url' | 'number' | 'color' | 'checkbox' | 'bullets' | 'seo_section' | 'faq_editor' | 'dose_table_editor' | 'vs_editor' | 'warnings_editor' | 'howto_editor'

interface FieldDef {
  key:          string
  label:        string
  type:         FieldType
  placeholder?: string
}

interface TabConfig {
  label:        string
  api:          string
  responseKey:  string
  imageField?:  string
  logoField?:   string
  pdfField?:    string
  imageFolder?: string
  fields:       FieldDef[]
}

const CONFIGS: Record<Exclude<SubTab, 'promos'>, TabConfig> = {
  naruchnici: {
    label: 'Наръчници', api: '/api/naruchnici', responseKey: 'naruchnici',
    imageField: 'cover_image_url', imageFolder: 'naruchnici',
    pdfField: 'pdf_url',
    fields: [
      { key: 'title',       label: 'Заглавие',    type: 'text',     placeholder: 'Тайните на едрите домати' },
      { key: 'subtitle',    label: 'Подзаглавие', type: 'text',     placeholder: 'Пълен наръчник за...' },
      { key: 'slug',        label: 'Slug (URL)',   type: 'text',     placeholder: 'super-domati' },
      { key: 'description', label: 'Описание',    type: 'textarea', placeholder: 'Описание...' },
      { key: 'category',    label: 'Категория',   type: 'text',     placeholder: 'domati' },
      { key: 'sort_order',  label: 'Ред',         type: 'number',   placeholder: '0' },
      { key: 'active',      label: 'Активен',     type: 'checkbox' },
    ],
  },

  affiliate: {
    label: 'Афилиейт продукти', api: '/api/affiliate-products', responseKey: 'products',
    imageField: 'image_url', imageFolder: 'affiliate',
    fields: [
      // ── Основна информация ──────────────────────────────────────────────────
      { key: 'name',           label: 'Наименование',              type: 'text',     placeholder: 'Кристалон Зелен 18-18-18' },
      { key: 'slug',           label: 'Slug',                      type: 'text',     placeholder: 'kristalon' },
      { key: 'subtitle',       label: 'Подзаглавие',               type: 'text',     placeholder: 'NPK тор с микроелементи' },
      { key: 'category_label', label: 'Категория (под снимката)',  type: 'text',     placeholder: 'Биостимулатор на корените' },
      { key: 'description',    label: 'Кратко описание (курсив)',  type: 'textarea', placeholder: 'Описание...' },
      { key: 'image_alt',      label: 'Image Alt текст (SEO)',     type: 'text',     placeholder: 'Кристалон Зелен — NPK тор с микроелементи' },
      { key: 'emoji',          label: 'Emoji',                     type: 'text',     placeholder: '🌿' },
      { key: 'color',          label: 'Цвят (HEX)',                type: 'color' },
      { key: 'badge_text',     label: 'Бадж текст',               type: 'text',     placeholder: 'Най-използван' },
      { key: 'badge_color',    label: 'Бадж цвят (HEX)',          type: 'color' },
      { key: 'tag_text',       label: 'Таг (горе вдясно)',         type: 'text',     placeholder: '⭐ Фаворит' },
      { key: 'affiliate_url',  label: 'Affiliate URL (купи бутон)', type: 'url',    placeholder: 'https://agroapteki.com/...' },
      { key: 'partner',        label: 'Партньор',                 type: 'text',     placeholder: 'agroapteki' },
      { key: 'sort_order',     label: 'Ред (sort)',               type: 'number',   placeholder: '0' },
      { key: 'active',         label: 'Активен',                  type: 'checkbox' },

      // ── Рейтинг ─────────────────────────────────────────────────────────────
      { key: '_rating_divider', label: '⭐ Рейтинг и отзиви',     type: 'seo_section' },
      { key: 'rating',         label: 'Рейтинг (1.0 – 5.0)',      type: 'number',   placeholder: '4.9' },
      { key: 'review_count',   label: 'Брой отзиви',              type: 'number',   placeholder: '23' },
      { key: 'date_published', label: 'Дата публикуване (YYYY-MM-DD)', type: 'text', placeholder: '2026-03-28' },

      // ── SEO ─────────────────────────────────────────────────────────────────
      { key: '_seo_divider',    label: '🔍 SEO — Meta тагове',    type: 'seo_section' },
      { key: 'seo_title',       label: 'SEO Title (50–70 символа)', type: 'text',   placeholder: 'Кристалон Зелен 18-18-18 — NPK тор | Denny Angelow' },
      { key: 'seo_description', label: 'SEO Description (120–160 символа)', type: 'textarea', placeholder: 'Описание...' },
      { key: 'seo_keywords',    label: 'Keywords (чрез запетая)', type: 'text',     placeholder: 'кристалон зелен, NPK тор, торене на домати' },

      // ── Продуктова страница ─────────────────────────────────────────────────
      { key: '_page_divider',  label: '📄 Продуктова страница (/produkt/slug)', type: 'seo_section' },
      { key: 'bullets',        label: 'Предимства (по едно на ред)',  type: 'bullets',  placeholder: '0 дни карантина\n3 в 1\nБез резистентност' },
      { key: 'full_content',   label: 'Пълно описание (Markdown — ## H2, **bold**, - списък)', type: 'textarea', placeholder: '## Какво е?\n\n...\n\n## Защо работи?\n\n...' },
      { key: 'how_to_use',     label: 'Как се използва (по едно на ред — ще се номерират)', type: 'bullets', placeholder: 'Разреди 1:100 с вода\nПръскай рано сутрин\nПовтаряй на 14-21 дни' },
      { key: 'combine_with',   label: 'Комбинирай с (slugs, разделени със запетая)', type: 'text', placeholder: 'kaliteh,ridomil,kristalon' },

      // ── FAQ ─────────────────────────────────────────────────────────────────
      { key: '_faq_divider',   label: '❓ FAQ — Въпроси и отговори', type: 'seo_section' },
      { key: 'faq',            label: 'FAQ',                        type: 'faq_editor' },

      // ── Как се използва (How-to стъпки) ────────────────────────────────────
      { key: '_howto_divider', label: '📌 Как се използва — стъпки', type: 'seo_section' },
      { key: 'how_to_use',     label: 'Стъпки (по едно на ред)',    type: 'howto_editor' },

      // ── Дозировъчна таблица ─────────────────────────────────────────────────
      { key: '_dose_divider',  label: '💉 Дозировъчна таблица',     type: 'seo_section' },
      { key: 'dose_table',     label: 'Дози по култура/неприятел',  type: 'dose_table_editor' },

      // ── VS Competitor ───────────────────────────────────────────────────────
      { key: '_vs_divider',    label: '⚔️ Сравнение с конкурент',   type: 'seo_section' },
      { key: 'vs_competitor',  label: 'Сравнителна таблица',        type: 'vs_editor' },

      // ── Технически данни ────────────────────────────────────────────────────
      { key: '_tech_divider',      label: '🔬 Технически данни (продуктова страница)', type: 'seo_section' },
      { key: 'active_substance',   label: 'Активно вещество',       type: 'text',    placeholder: 'Спинозад 480 г/л' },
      { key: 'volume',             label: 'Обем/Опаковка',          type: 'text',    placeholder: '100 мл' },
      { key: 'dosage',             label: 'Дозировка (обобщено)',    type: 'text',    placeholder: '10–30 мл/дка' },
      { key: 'quarantine_days',    label: 'Карантина (дни — число)', type: 'number', placeholder: '3' },
      { key: 'quarantine_note',    label: 'Карантина (детайли)',     type: 'text',    placeholder: 'Ягоди 1 ден | Домати 3 дни | Лозя 14 дни' },
      { key: 'season',             label: 'Сезон',                  type: 'text',    placeholder: 'Пролет / Лято — при поява на вредители' },
      { key: 'social_proof',       label: 'Social proof (1 ред)',   type: 'text',    placeholder: 'Одобрен за биологично производство в ЕС' },

      // ── Предупреждения ───────────────────────────────────────────────────────
      { key: '_warn_divider',  label: '⚠️ Предупреждения',          type: 'seo_section' },
      { key: 'warnings',       label: 'Предупреждения (по едно на ред)', type: 'warnings_editor' },

      // ── Култури (crops) ──────────────────────────────────────────────────────
      { key: '_crops_divider', label: '🌱 Култури',                 type: 'seo_section' },
      { key: 'crops',          label: 'Култури (по едно на ред)',   type: 'bullets',  placeholder: 'домати\nкраставици\nчушки\nлозя' },
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
      { key: 'emoji',      label: 'Иконка (emoji)',       type: 'text',   placeholder: '🌱' },
      { key: 'label',      label: 'Надпис',               type: 'text',   placeholder: 'Торове и Стимулатори' },
      { key: 'slug',       label: 'Slug (за аналитика)',  type: 'text',   placeholder: 'torove-bio-stimulatori' },
      { key: 'link',       label: 'URL',                  type: 'url',    placeholder: 'https://...' },
      { key: 'color',      label: 'Цвят (HEX)',           type: 'color' },
      { key: 'sort_order', label: 'Ред',                  type: 'number', placeholder: '0' },
      { key: 'active',     label: 'Активен',              type: 'checkbox' },
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
      { key: 'partner',     label: 'Партньор (за tracking)',      type: 'text',     placeholder: 'ginegar' },
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

// ─── SEO char counter ──────────────────────────────────────────────────────────
function SeoCharCounter({ value, ideal, max }: { value: string; ideal: number; max: number }) {
  const len   = (value || '').length
  const color = len === 0 ? '#9ca3af'
              : len > max ? '#dc2626'
              : len >= ideal ? '#16a34a'
              : '#d97706'
  const msg   = len === 0    ? `0 / ${ideal}–${max} символа`
              : len > max    ? `${len} ⚠️ прекалено дълго (>${max})`
              : len >= ideal ? `${len} ✓ идеално`
              : `${len} — добави още ${ideal - len} символа`
  return <span style={{ fontSize: 11, color, marginTop: 3, display: 'block' }}>{msg}</span>
}

// ─── FAQ Editor ────────────────────────────────────────────────────────────────
function FaqEditor({
  value,
  onChange,
}: {
  value: { q: string; a: string }[]
  onChange: (v: { q: string; a: string }[]) => void
}) {
  const items: { q: string; a: string }[] = Array.isArray(value) ? value : []

  const update = (idx: number, field: 'q' | 'a', val: string) => {
    onChange(items.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }

  const add    = () => onChange([...items, { q: '', a: '' }])
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.length === 0 && (
        <div style={{ padding: '16px', background: '#f9fafb', borderRadius: 10, border: '1px dashed #e5e7eb', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
          Няма въпроси. Натисни «+ Добави въпрос» за начало.
        </div>
      )}
      {items.map((item, idx) => (
        <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', background: '#fafafa', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Въпрос {idx + 1}
            </span>
            <button
              onClick={() => remove(idx)}
              style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 12, color: '#991b1b', fontWeight: 700 }}
            >
              ✕ Изтрий
            </button>
          </div>
          <input
            type="text"
            value={item.q}
            onChange={e => update(idx, 'q', e.target.value)}
            placeholder="Как се използва продуктът?"
            style={{ ...inp, marginBottom: 8 }}
            onFocus={focusGreen} onBlur={blurGray}
          />
          <textarea
            rows={3}
            value={item.a}
            onChange={e => update(idx, 'a', e.target.value)}
            placeholder="Подробен отговор..."
            style={{ ...inp, resize: 'vertical' }}
            onFocus={focusGreen} onBlur={blurGray}
          />
        </div>
      ))}
      <button
        onClick={add}
        style={{ padding: '10px', border: '1.5px dashed #d1d5db', borderRadius: 9, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280', fontFamily: 'inherit', fontWeight: 600, transition: 'all .15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2d6a4f'; (e.currentTarget as HTMLElement).style.color = '#2d6a4f' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}
      >
        + Добави въпрос
      </button>
      {items.length > 0 && (
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          {items.length} {items.length === 1 ? 'въпрос' : 'въпроса'} · Запазват се при «Запази»
        </div>
      )}
    </div>
  )
}

// ─── HowTo Editor ──────────────────────────────────────────────────────────────
// Записва масив от стъпки — serialize-ва към JSON array ["стъпка1","стъпка2"]
function HowToEditor({ value, onChange }: { value: string | string[]; onChange: (v: string) => void }) {
  // Парсира и двата формата: JSON array или curly-brace
  const parse = (raw: string | string[]): string[] => {
    if (Array.isArray(raw)) return raw
    if (!raw) return []
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p } catch {}
    try {
      const fixed = String(raw).trim().replace(/^\{/, '[').replace(/\}$/, ']')
      const p = JSON.parse(fixed); if (Array.isArray(p)) return p
    } catch {}
    return String(raw).split('\n').map(s => s.trim()).filter(Boolean)
  }

  const steps = parse(value)
  const text  = steps.join('\n')

  const handleChange = (val: string) => {
    const arr = val.split('\n').map(s => s.trim()).filter(Boolean)
    onChange(JSON.stringify(arr))
  }

  return (
    <div>
      <textarea
        rows={6}
        value={text}
        onChange={e => handleChange(e.target.value)}
        placeholder="Пръскай вечерта след залез&#10;Покрий долната страна на листата&#10;Редувай с различен препарат"
        style={{ ...inp, resize: 'vertical' }}
        onFocus={focusGreen} onBlur={blurGray}
      />
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
        По едно на ред. Ще се номерират автоматично.
        {steps.length > 0 && <span style={{ color: '#16a34a', marginLeft: 6 }}>✓ {steps.length} стъпки</span>}
      </div>
    </div>
  )
}

// ─── Warnings Editor ────────────────────────────────────────────────────────────
function WarningsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const items = Array.isArray(value) ? value : []
  const text  = items.join('\n')
  return (
    <div>
      <textarea
        rows={4}
        value={text}
        onChange={e => onChange(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
        placeholder="⚠️ ТОКСИЧЕН ЗА ПЧЕЛИ - Пръскайте само след залез!&#10;Не използвайте повече от 3 пъти годишно"
        style={{ ...inp, resize: 'vertical' }}
        onFocus={focusGreen} onBlur={blurGray}
      />
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
        По едно на ред. Показват се в червено на продуктовата страница.
        {items.length > 0 && <span style={{ color: '#d97706', marginLeft: 6 }}>⚠️ {items.length} предупреждения</span>}
      </div>
    </div>
  )
}

// ─── Dose Table Editor ──────────────────────────────────────────────────────────
function DoseTableEditor({
  value,
  onChange,
}: {
  value: { phase: string; dose: string; interval: string }[]
  onChange: (v: { phase: string; dose: string; interval: string }[]) => void
}) {
  const rows = Array.isArray(value) ? value : []

  const update = (idx: number, field: 'phase' | 'dose' | 'interval', val: string) =>
    onChange(rows.map((r, i) => i === idx ? { ...r, [field]: val } : r))

  const add    = () => onChange([...rows, { phase: '', dose: '', interval: '' }])
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.length === 0 && (
        <div style={{ padding: 14, background: '#f9fafb', borderRadius: 10, border: '1px dashed #e5e7eb', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
          Няма редове. Натисни «+ Добави ред» за начало.
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 28px', gap: 4, fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 2px' }}>
          <span>Култура / Неприятел</span><span>Доза</span><span>Интервал</span><span />
        </div>
      )}
      {rows.map((row, idx) => (
        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 28px', gap: 5, alignItems: 'center' }}>
          <input value={row.phase} onChange={e => update(idx, 'phase', e.target.value)}
            placeholder="Домати — трипс" style={{ ...inp, fontSize: 12 }} onFocus={focusGreen} onBlur={blurGray} />
          <input value={row.dose}  onChange={e => update(idx, 'dose',  e.target.value)}
            placeholder="10–25 мл/дка" style={{ ...inp, fontSize: 12 }} onFocus={focusGreen} onBlur={blurGray} />
          <input value={row.interval} onChange={e => update(idx, 'interval', e.target.value)}
            placeholder="При поява, макс. 3 пъти" style={{ ...inp, fontSize: 12 }} onFocus={focusGreen} onBlur={blurGray} />
          <button onClick={() => remove(idx)}
            style={{ background: '#fee2e2', border: 'none', borderRadius: 6, width: 28, height: 36, cursor: 'pointer', fontSize: 13, color: '#991b1b', flexShrink: 0 }}>✕</button>
        </div>
      ))}
      <button onClick={add}
        style={{ padding: '9px', border: '1.5px dashed #d1d5db', borderRadius: 9, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280', fontFamily: 'inherit', fontWeight: 600 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2d6a4f'; (e.currentTarget as HTMLElement).style.color = '#2d6a4f' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
        + Добави ред
      </button>
      {rows.length > 0 && (
        <div style={{ fontSize: 11, color: '#9ca3af' }}>{rows.length} реда · Запазват се при «Запази»</div>
      )}
    </div>
  )
}

// ─── VS Competitor Editor ───────────────────────────────────────────────────────
function VsEditor({
  value,
  onChange,
}: {
  value: { competitor: string; vs: { feature: string; ours: string; theirs: string }[] } | null | undefined
  onChange: (v: { competitor: string; vs: { feature: string; ours: string; theirs: string }[] }) => void
}) {
  const data = value && typeof value === 'object'
    ? value
    : { competitor: '', vs: [] }

  const setCompetitor = (c: string) => onChange({ ...data, competitor: c })
  const setRows = (vs: typeof data.vs)  => onChange({ ...data, vs })

  const updateRow = (idx: number, field: 'feature' | 'ours' | 'theirs', val: string) =>
    setRows(data.vs.map((r, i) => i === idx ? { ...r, [field]: val } : r))

  const addRow    = () => setRows([...data.vs, { feature: '', ours: '', theirs: '' }])
  const removeRow = (idx: number) => setRows(data.vs.filter((_, i) => i !== idx))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>Конкурентен продукт</label>
        <input value={data.competitor} onChange={e => setCompetitor(e.target.value)}
          placeholder="Спинтор 240 СК" style={inp} onFocus={focusGreen} onBlur={blurGray} />
      </div>
      {data.vs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 28px', gap: 4, fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 2px' }}>
          <span>Характеристика</span><span>Нашият продукт ✓</span><span>{data.competitor || 'Конкурент'}</span><span />
        </div>
      )}
      {data.vs.map((row, idx) => (
        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 28px', gap: 5, alignItems: 'center' }}>
          <input value={row.feature} onChange={e => updateRow(idx, 'feature', e.target.value)}
            placeholder="Концентрация" style={{ ...inp, fontSize: 12 }} onFocus={focusGreen} onBlur={blurGray} />
          <input value={row.ours}    onChange={e => updateRow(idx, 'ours',    e.target.value)}
            placeholder="480 г/л" style={{ ...inp, fontSize: 12, borderColor: '#bbf7d0', background: '#f0fdf4' }} onFocus={focusGreen} onBlur={blurGray} />
          <input value={row.theirs}  onChange={e => updateRow(idx, 'theirs',  e.target.value)}
            placeholder="240 г/л" style={{ ...inp, fontSize: 12 }} onFocus={focusGreen} onBlur={blurGray} />
          <button onClick={() => removeRow(idx)}
            style={{ background: '#fee2e2', border: 'none', borderRadius: 6, width: 28, height: 36, cursor: 'pointer', fontSize: 13, color: '#991b1b' }}>✕</button>
        </div>
      ))}
      {data.vs.length === 0 && (
        <div style={{ padding: 12, background: '#f9fafb', borderRadius: 10, border: '1px dashed #e5e7eb', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
          Добави редове за сравнение долу.
        </div>
      )}
      <button onClick={addRow}
        style={{ padding: '9px', border: '1.5px dashed #d1d5db', borderRadius: 9, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280', fontFamily: 'inherit', fontWeight: 600 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2d6a4f'; (e.currentTarget as HTMLElement).style.color = '#2d6a4f' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
        + Добави ред за сравнение
      </button>
      {data.vs.length > 0 && (
        <div style={{ fontSize: 11, color: '#9ca3af' }}>{data.vs.length} реда · Запазват се при «Запази»</div>
      )}
    </div>
  )
}

// ─── PdfUpload component ───────────────────────────────────────────────────────
function PdfUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') { setError('Моля избери PDF файл.'); return }
    if (file.size > 20 * 1024 * 1024)   { setError('Файлът е прекалено голям. Максимум 20 MB.'); return }
    setError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'naruchnici/pdf')
      const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`) }
      const { url } = await res.json()
      onChange(url)
    } catch (e: any) {
      setError('Грешка при качване: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleFile(file) }
  const fileName = value ? value.split('/').pop()?.split('?')[0] : null

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
        📄 PDF Файл на наръчника
      </label>
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
        <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={uploading}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
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
      {error && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#dc2626', background: '#fee2e2', borderRadius: 7, padding: '6px 10px' }}>
          ⚠️ {error}
        </div>
      )}
      {value && !uploading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <a href={value} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}>
            🔗 Отвори PDF в нов таб
          </a>
          <button onClick={() => onChange('')}
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
  const [subTab,        setSubTab]       = useState<SubTab>('naruchnici')
  const [naruchnikMode, setNaruchnikMode] = useState<NaruchnikMode>('list')
  const [items,         setItems]        = useState<BaseItem[]>([])
  const [loading,       setLoading]      = useState(false)
  const [editing,       setEditing]      = useState<BaseItem | null>(null)
  const [saving,        setSaving]       = useState(false)

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
  useEffect(() => { if (subTab !== 'naruchnici') setNaruchnikMode('list') }, [subTab])

  // ── New item defaults ─────────────────────────────────────────────────────
  const startNew = () => {
    const defaults: BaseItem = { id: '' }
    cfg.fields.forEach(f => {
      if (f.type === 'seo_section') return
      if (f.type === 'faq_editor')        defaults[f.key] = []
      else if (f.type === 'dose_table_editor') defaults[f.key] = []
      else if (f.type === 'warnings_editor')   defaults[f.key] = []
      else if (f.type === 'howto_editor')      defaults[f.key] = ''
      else if (f.type === 'vs_editor')         defaults[f.key] = { competitor: '', vs: [] }
      else if (f.type === 'checkbox') defaults[f.key] = true
      else if (f.type === 'number')   defaults[f.key] = 0
      else if (f.type === 'color')    defaults[f.key] = '#16a34a'
      else if (f.type === 'bullets')  defaults[f.key] = []
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
      let payload = { ...editing }

      // Auto-generate slug for links
      if (subTab === 'links' && (!payload.slug || payload.slug.trim() === '' || payload.slug.trim() === '-')) {
        const label = (payload.label || '') as string
        const cyrMap: Record<string, string> = {
          а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ж:'zh',з:'z',и:'i',й:'y',
          к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',
          ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sht',ъ:'a',ь:'',ю:'yu',я:'ya',
        }
        const transliterated = label.toLowerCase().split('').map(ch => cyrMap[ch] ?? ch).join('')
        payload.slug = transliterated
          .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60)
          || `link-${payload.id?.slice(0, 6) || Date.now()}`
      }

      // Премахваме visual-only separator полетата (_prefix)
      // faq и другите масиви се изпращат директно — Supabase jsonb ги приема
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([k]) => !k.startsWith('_'))
      )

      const isNew = !cleanPayload.id
      const url   = isNew ? cfg.api : `${cfg.api}/${cleanPayload.id}`
      const res   = await fetch(url, {
        method:  isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(cleanPayload),
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

  const itemName = (item: BaseItem) =>
    item.title || item.name || item.label || item.slug || item.id

  const itemSub = (item: BaseItem) => {
    if (subTab === 'links') return item.link || item.href || '—'
    return item.affiliate_url || item.button_url || item.slug || '—'
  }

  const hasAffiliateSeo = (item: BaseItem) =>
    subTab === 'affiliate' && !!(item.seo_title || item.seo_description || item.seo_keywords)

  const hasAffiliateFaq = (item: BaseItem) =>
    subTab === 'affiliate' && Array.isArray(item.faq) && item.faq.length > 0

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 28px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header + main sub-tabs */}
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
                border:     `1px solid ${subTab === t ? '#2d6a4f' : 'var(--border)'}`,
                background: subTab === t ? '#2d6a4f' : '#fff',
                color:      subTab === t ? '#fff' : 'var(--muted)',
              }}>
              {SUB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Наръчници sub-mode switcher */}
        {subTab === 'naruchnici' && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {(['list', 'seo'] as NaruchnikMode[]).map(mode => (
              <button key={mode} onClick={() => setNaruchnikMode(mode)}
                style={{
                  padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 600, transition: 'all .15s',
                  border:     `1px solid ${naruchnikMode === mode ? '#1b4332' : '#e5e7eb'}`,
                  background: naruchnikMode === mode ? '#1b4332' : '#f9fafb',
                  color:      naruchnikMode === mode ? '#fff' : '#6b7280',
                }}>
                {mode === 'list' ? '📗 Списък и редактиране' : '🔍 SEO Оптимизация'}
              </button>
            ))}
          </div>
        )}

        {/* Афилиейт инфо бар */}
        {subTab === 'affiliate' && (
          <div style={{ marginTop: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#1e40af', lineHeight: 1.6 }}>
            🔍 <strong>Афилиейт продукти</strong> — в редактора ще намериш всички секции: Основна информация · SEO · FAQ · How-to стъпки · Дозировъчна таблица · VS Конкурент · Технически данни · Предупреждения · Култури.
            Промените се записват директно в Supabase и са видими на продуктовата страница след макс. 60 секунди.
          </div>
        )}
      </div>

      {/* SEO Mode for naruchnici */}
      {subTab === 'naruchnici' && naruchnikMode === 'seo' && <NaruchnikSeoTab />}

      {/* Promos tab */}
      {subTab === 'promos' && (
        <div>
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#9a3412', lineHeight: 1.6 }}>
            📣 <strong>Промо банерите</strong> се показват под собствените продукти на началната страница.
          </div>
          <PromoBannersTab />
        </div>
      )}

      {/* Own products */}
      {subTab === 'own' && <OwnProductsTab />}

      {/* Special sections info */}
      {subTab === 'special' && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
          🏕️ <strong>Специални секции</strong> се показват на началната страница между препоръчаните продукти и Atlas Terra.
        </div>
      )}

      {/* List + edit panel */}
      {subTab !== 'promos' && subTab !== 'own' && !(subTab === 'naruchnici' && naruchnikMode === 'seo') && (
        <div style={{ display: 'grid', gridTemplateColumns: editing ? '1fr 440px' : '1fr', gap: 20 }}>

          {/* List */}
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
                    <img src={item[cfg.imageField]} alt=""
                      style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: '#f3f4f6', border: '1px solid #e5e7eb' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {itemName(item)}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{itemSub(item)}</span>
                      {item.active === false && <span style={{ color: '#ef4444', fontSize: 11, flexShrink: 0 }}>● Неактивен</span>}

                      {/* SEO badge за наръчници */}
                      {subTab === 'naruchnici' && item.meta_title && (
                        <span style={{ color: '#16a34a', fontSize: 11, flexShrink: 0, background: '#ecfdf5', padding: '1px 6px', borderRadius: 99 }}>✓ SEO</span>
                      )}
                      {/* SEO badge за афилиейт */}
                      {hasAffiliateSeo(item) && (
                        <span style={{ color: '#1d4ed8', fontSize: 11, flexShrink: 0, background: '#eff6ff', padding: '1px 6px', borderRadius: 99 }}>🔍 SEO</span>
                      )}
                      {/* FAQ badge за афилиейт */}
                      {hasAffiliateFaq(item) && (
                        <span style={{ color: '#7c3aed', fontSize: 11, flexShrink: 0, background: '#f5f3ff', padding: '1px 6px', borderRadius: 99 }}>❓ {item.faq.length} FAQ</span>
                      )}
                      {/* Rating badge */}
                      {subTab === 'affiliate' && item.rating && (
                        <span style={{ color: '#d97706', fontSize: 11, flexShrink: 0, background: '#fffbeb', padding: '1px 6px', borderRadius: 99 }}>⭐ {item.rating}</span>
                      )}
                      {/* Dose table badge */}
                      {subTab === 'affiliate' && Array.isArray(item.dose_table) && item.dose_table.length > 0 && (
                        <span style={{ color: '#059669', fontSize: 11, flexShrink: 0, background: '#ecfdf5', padding: '1px 6px', borderRadius: 99 }}>💉 {item.dose_table.length} дози</span>
                      )}
                      {/* VS badge */}
                      {subTab === 'affiliate' && item.vs_competitor?.competitor && (
                        <span style={{ color: '#7c3aed', fontSize: 11, flexShrink: 0, background: '#f5f3ff', padding: '1px 6px', borderRadius: 99 }}>⚔️ vs {item.vs_competitor.competitor}</span>
                      )}
                      {/* Warnings badge */}
                      {subTab === 'affiliate' && Array.isArray(item.warnings) && item.warnings.length > 0 && (
                        <span style={{ color: '#dc2626', fontSize: 11, flexShrink: 0, background: '#fee2e2', padding: '1px 6px', borderRadius: 99 }}>⚠️ {item.warnings.length}</span>
                      )}

                      {subTab === 'links' && item.slug && item.slug !== '-' && (
                        <span style={{ color: '#2d6a4f', fontSize: 11, flexShrink: 0, background: '#ecfdf5', padding: '1px 6px', borderRadius: 99, fontFamily: 'monospace' }}>🏷 {item.slug}</span>
                      )}
                      {subTab === 'special' && item.partner && (
                        <span style={{ color: '#7c3aed', fontSize: 11, flexShrink: 0, background: '#f3e8ff', padding: '1px 6px', borderRadius: 99 }}>🔗 {item.partner}</span>
                      )}
                      {subTab === 'special' && item.bullets?.length > 0 && (
                        <span style={{ color: '#16a34a', fontSize: 11, flexShrink: 0 }}>✓ {item.bullets.length} предимства</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => { const n = { ...item }; if (subTab === 'links' && n.slug === '-') n.slug = ''; setEditing(n) }}
                      style={{ background: editing?.id === item.id ? '#dcfce7' : '#f3f4f6', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151', fontWeight: 600 }}>
                      ✏️ Редактирай
                    </button>
                    <button onClick={() => del(item.id)}
                      style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#991b1b' }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Edit panel */}
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
                  {subTab === 'naruchnici' && editing.id && (
                    <button onClick={() => setNaruchnikMode('seo')}
                      style={{ marginTop: 6, fontSize: 11, color: '#065f46', background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                      🔍 Редактирай SEO за този наръчник
                    </button>
                  )}
                </div>
                <button onClick={() => setEditing(null)}
                  style={{ background: '#f5f5f5', border: 'none', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Image upload */}
                {cfg.imageField && (
                  <ImageUpload
                    value={editing[cfg.imageField] || ''}
                    onChange={url => set(cfg.imageField!, url)}
                    folder={cfg.imageFolder || 'uploads'}
                    label={cfg.logoField ? 'Главна снимка (вдясно в секцията)' : 'Снимка'}
                    height={160}
                  />
                )}

                {/* Logo upload (само за special) */}
                {cfg.logoField && (
                  <ImageUpload
                    value={editing[cfg.logoField] || ''}
                    onChange={url => set(cfg.logoField!, url)}
                    folder={cfg.imageFolder || 'uploads'}
                    label="Лого (под снимката, незадължително)"
                    height={90}
                  />
                )}

                {/* PDF upload (само за наръчници) */}
                {cfg.pdfField && (
                  <PdfUpload value={editing[cfg.pdfField] || ''} onChange={url => set(cfg.pdfField!, url)} />
                )}

                {/* Form fields */}
                {cfg.fields.map(f => {

                  // ── SEO section visual separator ──────────────────────────
                  if (f.type === 'seo_section') {
                    return (
                      <div key={f.key} style={{ marginTop: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 99, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                            {f.label}
                          </span>
                          <div style={{ height: 1, flex: 1, background: '#e5e7eb' }} />
                        </div>
                        <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0', lineHeight: 1.5 }}>
                          {f.key === '_seo_divider' && 'Попълни полетата долу за да може Google да намери и индексира правилно този продукт.'}
                          {f.key === '_page_divider' && 'Тези полета се показват на продуктовата страница /produkt/slug.'}
                          {f.key === '_faq_divider' && 'FAQ въпросите се показват на продуктовата страница и подобряват SEO (FAQPage schema).'}
                          {f.key === '_rating_divider' && 'Рейтингът се използва в Google Product schema — влияе на резултатите в търсачката.'}
                          {f.key === '_howto_divider' && 'Стъпките се показват в таб „Приложение" на продуктовата страница и в HowTo schema за SEO.'}
                          {f.key === '_dose_divider'  && 'Таблицата с дози се показва в таб „Приложение". Добави по един ред за всяка култура/неприятел.'}
                          {f.key === '_vs_divider'    && 'Таблицата за сравнение се показва в таб „За продукта". Зелено = твоят продукт.'}
                          {f.key === '_tech_divider'  && 'Тези данни се показват в таб „Технически" на продуктовата страница.'}
                          {f.key === '_warn_divider'  && 'Предупрежденията се показват в таб „За продукта" в червено. Включи ⚠️ emoji за по-добра видимост.'}
                          {f.key === '_crops_divider' && 'Културите се показват в таб „Технически" като зелени тагове.'}
                        </p>
                      </div>
                    )
                  }

                  // ── FAQ Editor ────────────────────────────────────────────
                  if (f.type === 'faq_editor') {
                    return (
                      <div key={f.key}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                          {f.label}
                        </label>
                        <FaqEditor
                          value={Array.isArray(editing[f.key]) ? editing[f.key] : []}
                          onChange={v => set(f.key, v)}
                        />
                      </div>
                    )
                  }

                  // ── HowTo Editor ──────────────────────────────────────────
                  if (f.type === 'howto_editor') {
                    return (
                      <div key={f.key}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                          {f.label}
                        </label>
                        <HowToEditor
                          value={editing[f.key] || ''}
                          onChange={v => set(f.key, v)}
                        />
                      </div>
                    )
                  }

                  // ── Warnings Editor ───────────────────────────────────────
                  if (f.type === 'warnings_editor') {
                    return (
                      <div key={f.key}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                          {f.label}
                        </label>
                        <WarningsEditor
                          value={Array.isArray(editing[f.key]) ? editing[f.key] : []}
                          onChange={v => set(f.key, v)}
                        />
                      </div>
                    )
                  }

                  // ── Dose Table Editor ─────────────────────────────────────
                  if (f.type === 'dose_table_editor') {
                    return (
                      <div key={f.key}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                          {f.label}
                        </label>
                        <DoseTableEditor
                          value={Array.isArray(editing[f.key]) ? editing[f.key] : []}
                          onChange={v => set(f.key, v)}
                        />
                      </div>
                    )
                  }

                  // ── VS Competitor Editor ──────────────────────────────────
                  if (f.type === 'vs_editor') {
                    return (
                      <div key={f.key}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8 }}>
                          {f.label}
                        </label>
                        <VsEditor
                          value={editing[f.key] || null}
                          onChange={v => set(f.key, v)}
                        />
                      </div>
                    )
                  }

                  return (
                    <div key={f.key}>
                      {f.type !== 'checkbox' && (
                        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                          {f.label}
                        </label>
                      )}

                      {f.type === 'textarea' ? (
                        <>
                          <textarea
                            rows={f.key === 'full_content' ? 8 : 3}
                            value={editing[f.key] || ''}
                            onChange={e => set(f.key, e.target.value)}
                            placeholder={f.placeholder}
                            style={{ ...inp, resize: 'vertical' }}
                            onFocus={focusGreen} onBlur={blurGray}
                          />
                          {f.key === 'seo_description' && (
                            <SeoCharCounter value={editing[f.key] || ''} ideal={120} max={160} />
                          )}
                        </>

                      ) : f.type === 'bullets' ? (
                        <div>
                          <textarea
                            rows={5}
                            value={Array.isArray(editing[f.key]) ? editing[f.key].join('\n') : (typeof editing[f.key] === 'string' ? editing[f.key] : '')}
                            onChange={e => set(f.key, e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean))}
                            placeholder={f.placeholder}
                            style={{ ...inp, resize: 'vertical' }}
                            onFocus={focusGreen} onBlur={blurGray}
                          />
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                            По едно на ред. Празните редове се игнорират.
                            {Array.isArray(editing[f.key]) && editing[f.key].length > 0 && (
                              <span style={{ color: '#16a34a', marginLeft: 6 }}>✓ {editing[f.key].length} реда</span>
                            )}
                          </div>
                        </div>

                      ) : f.type === 'checkbox' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}>
                          <input type="checkbox" checked={!!editing[f.key]} onChange={e => set(f.key, e.target.checked)}
                            style={{ width: 16, height: 16, accentColor: '#2d6a4f' }} />
                          {f.label}
                        </label>

                      ) : f.type === 'color' ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="color" value={editing[f.key] || '#16a34a'} onChange={e => set(f.key, e.target.value)}
                            style={{ width: 40, height: 36, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', padding: 2, flexShrink: 0 }} />
                          <input type="text" value={editing[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                            placeholder="#16a34a" style={{ ...inp, fontFamily: 'monospace' }}
                            onFocus={focusGreen} onBlur={blurGray} />
                        </div>

                      ) : (
                        <>
                          <input
                            type={f.type === 'number' ? 'number' : f.type === 'url' ? 'url' : 'text'}
                            value={editing[f.key] ?? ''}
                            onChange={e => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                            placeholder={f.placeholder}
                            step={f.type === 'number' ? '0.1' : undefined}
                            min={f.type === 'number' ? '0' : undefined}
                            max={f.key === 'rating' ? '5' : undefined}
                            style={{ ...inp, ...(f.key === 'slug' ? { fontFamily: 'monospace', letterSpacing: '0.02em' } : {}) }}
                            onFocus={focusGreen} onBlur={blurGray}
                          />
                          {f.key === 'seo_title' && (
                            <SeoCharCounter value={editing[f.key] || ''} ideal={50} max={70} />
                          )}
                          {/* Slug preview hint — само за links */}
                          {f.key === 'slug' && subTab === 'links' && (
                            <div style={{ marginTop: 5, fontSize: 11, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 9px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {editing['slug'] && editing['slug'].trim() !== '' ? (
                                <>
                                  <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                                  <span>Tracking slug: <code style={{ background: '#ecfdf5', color: '#166534', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>{editing['slug']}</code></span>
                                </>
                              ) : (
                                <>
                                  <span style={{ color: '#f59e0b' }}>⚡</span>
                                  <span>Автоматично от надписа</span>
                                </>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
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
