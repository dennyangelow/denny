'use client'
// app/admin/components/SettingsTab.tsx — v8
// ✅ НОВО: urgency_bar_products — отделен urgency bar само за /products/* страниците
//    Различен от urgency_bar_text (началната страница)

import { useState, useEffect, useRef, useMemo } from 'react'
import { toast } from '@/components/ui/Toast'

interface Props { ordersCount: number; leadsCount: number }

// ✅ ПРЕОРГАНИЗИРАНО: групирани логически (Съдържание / Бизнес / Маркетинг /
//    Технически), всяка секция с кратко описание (винаги видимо, дори
//    свита) — за да знаеш какво има вътре без да отваряш. "group" решава
//    в кой блок с divider header попада секцията в render-а по-долу.
const SECTIONS = [
  {
    id: 'hero', group: 'Съдържание', label: '🏠 Главна страница',
    description: 'Заглавия, urgency лента и CTA текстове на началната страница',
    keys: [
      { key: 'urgency_bar_text',     label: 'Urgency лента — Начална страница',      type: 'textarea', placeholder: '🎁 **2 безплатни наръчника** — Домати & Краставици · 🚚 **Безплатна доставка** над 60 € · 💵 Само наложен платеж', hint: 'Показва се САМО на началната страница (/).' },
      { key: 'urgency_bar_products', label: '🌱 Urgency лента — Продуктови страници', type: 'textarea', placeholder: '🌱 **Atlas Terra** — Органичен биостимулант · 📦 **Безплатна доставка** при 10л+ · 💵 Само наложен платеж', hint: 'Показва се САМО на /products/* страниците (Atlas Terra продукти). Поддържа **bold** форматиране.' },
      { key: 'hero_title',           label: 'Главно заглавие',                        type: 'text',     placeholder: 'Искаш едри, здрави и сочни домати?' },
      { key: 'hero_warning',         label: 'Warning кутия (под subtitle)',            type: 'text',     placeholder: 'Не рискувай да изхвърлиш продукцията...', hint: 'Показва се в червена кутия с ⚠️' },
      { key: 'hero_subtitle',        label: 'Подзаглавие (под заглавието)',            type: 'textarea', placeholder: 'Без болести, без гниене...', hint: 'Поддържа **bold** форматиране' },
      { key: 'cta_title',            label: 'CTA заглавие (долу)',                     type: 'text',     placeholder: 'Изтегли И Двата Наръчника Напълно Безплатно' },
      { key: 'cta_subtitle',         label: 'CTA подзаглавие (долу)',                 type: 'textarea', placeholder: 'Над 6 000 фермери вече ги изтеглиха...', hint: 'Поддържа **bold** форматиране' },
      { key: 'footer_about_text',    label: 'Текст в Footer',                         type: 'textarea', placeholder: 'Помагам на фермери да отглеждат...' },
    ],
  },
  {
    id: 'seo', group: 'Съдържание', label: '🔍 SEO — Начална страница',
    description: 'Meta title/description, Open Graph, Twitter карти — обикновено се пипа веднъж',
    keys: [
      { key: 'seo_title',       label: 'Meta Title (50–70 символа)', type: 'text',     placeholder: 'Denny Angelow — Домати, Краставици, Торове и Агро Наръчници', hint: 'Показва се в Google като заглавие на резултата. Оптимално: 55–60 символа.' },
      { key: 'og_title',        label: 'OG Title (Facebook / Viber / WhatsApp)', type: 'text', placeholder: 'Denny Angelow — Безплатни Наръчници за Домати и Краставици', hint: 'Заглавие при споделяне в социалните мрежи.' },
      { key: 'og_image',        label: 'OG Image URL (1200×630px)', type: 'text', placeholder: '/og-image.jpg', hint: 'Снимка при споделяне. Може да е /og-image.jpg (от public/) или пълен https:// линк.' },
      { key: 'og_image_alt',    label: 'OG Image Alt текст', type: 'text', placeholder: 'Denny Angelow — Агро Наръчници за Домати и Краstavici', hint: 'Описание на снимката за достъпност и SEO.' },
      { key: 'twitter_title',       label: 'Twitter / X Title',       type: 'text',     placeholder: 'Denny Angelow — Безплатни Агро Наръчници', hint: 'Заглавие при споделяне в Twitter/X.' },
      { key: 'twitter_creator',     label: 'Twitter / X Handle',      type: 'text',     placeholder: '@dennyangelow', hint: 'Твоят Twitter handle с @.' },
      { key: 'google_site_verification', label: 'Google Search Console Verification', type: 'text', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Кода от Google Search Console → Settings → Ownership verification → HTML tag. Само стойността на content="...".' },
      { key: 'seo_description', label: 'Meta Description (120–160 символа)', type: 'textarea', placeholder: 'Безплатни PDF наръчници за домати и краставици. Над {count} фермери вече използват съветите на Дени Ангелов — агро консултант с 8+ години опит.', hint: 'Пиши {count} за да се замени автоматично с брой изтегляния. Оптимално: 145–155 символа.' },
      { key: 'seo_keywords',    label: 'Keywords (чрез запетая)',      type: 'textarea', placeholder: 'домати, отглеждане на домати, Прев-Голд, Амалгерол, агро консултант, Denny Angelow...', hint: 'Базови keywords. Автоматично се добавят и имената + keywords на всички афилиейт продукти.' },
      { key: 'og_description',  label: 'OG Description', type: 'textarea', placeholder: 'Изтегли безплатно и научи как да отгледаш едри, здрави домати и краставици. Над {count} фермери вече го използват.', hint: 'Описание при споделяне. Пиши {count} за автоматичен брой изтегляния.' },
      { key: 'twitter_description', label: 'Twitter / X Description', type: 'textarea', placeholder: 'Домати, краставици, торене, болести, оранжерии. Изтегли безплатно.', hint: 'Описание при споделяне в Twitter/X.' },
    ],
  },
  {
    id: 'contacts', group: 'Бизнес', label: '📞 Контакти',
    description: 'Телефон, имейл, WhatsApp — показват се в хедъра, футъра и поръчките',
    keys: [
      { key: 'site_phone',      label: 'Телефон',                    type: 'tel',   placeholder: '+359 876238623' },
      { key: 'site_email',      label: 'Email за клиенти',           type: 'email', placeholder: 'support@dennyangelow.com' },
      { key: 'admin_email',     label: 'Admin email (нови поръчки)', type: 'email', placeholder: 'denny@dennyangelow.com' },
      { key: 'whatsapp_number', label: 'WhatsApp (само цифри)',      type: 'text',  placeholder: '359876238623', hint: 'Без +, без интервали — само цифри' },
    ],
  },
  {
    id: 'shipping', group: 'Бизнес', label: '📦 Доставка',
    description: 'Цени за доставка по куриер и праг за безплатна доставка',
    keys: [
      { key: 'shipping_econt',      label: 'Цена Еконт',             type: 'number', placeholder: '5.00' },
      { key: 'shipping_speedy',     label: 'Цена Спиди',             type: 'number', placeholder: '5.50' },
      { key: 'free_shipping_above', label: 'Безплатна доставка над', type: 'number', placeholder: '60', hint: 'shipping_price в CartSystem = min(econt, speedy)' },
    ],
  },
  {
    id: 'currency', group: 'Бизнес', label: '💶 Валута',
    description: 'Код и символ на валутата, показвани до всяка цена в сайта',
    keys: [
      { key: 'currency',        label: 'Валута (код)',        type: 'text', placeholder: 'BGN', hint: 'Напр. BGN, EUR, USD' },
      { key: 'currency_symbol', label: 'Символ за показване', type: 'text', placeholder: '€',   hint: 'Показва се след сумата — €, лв., $' },
    ],
  },
  {
    id: 'social', group: 'Маркетинг', label: '📊 Броячи и доверие (Social Proof)',
    description: 'Числата и trust иконките в Hero секцията — НЕ линкове към социални мрежи (виж по-долу)',
    keys: [
      { key: 'social_proof_items', label: 'Броячи в Hero (JSON)', type: 'textarea', placeholder: '[{"number":"6 000+","label":"изтеглени"},{"number":"85K","label":"последователи"}]', hint: 'JSON масив с number и label' },
      { key: 'trust_strip_items',  label: 'Trust strip (JSON)',   type: 'textarea', placeholder: '[{"icon":"🌱","text":"Органични продукти"}]',                                         hint: 'JSON масив с icon и text' },
    ],
  },
  {
    id: 'emails', group: 'Маркетинг', label: '✉️ Email настройки',
    description: 'От кой адрес/име излизат системните имейли (поръчки, лийдове)',
    keys: [
      { key: 'email_from_name', label: 'От (Имена)', type: 'text',  placeholder: 'Denny Angelow' },
      { key: 'email_from_addr', label: 'От (Имейл)', type: 'email', placeholder: 'denny@dennyangelow.com' },
      { key: 'email_reply_to',  label: 'Reply-To',   type: 'email', placeholder: 'support@dennyangelow.com' },
    ],
  },
  {
    // ✅ управление на количката в менюто за страници, които по подразбиране
    //    са БЕЗ количка (afiliate продукти, /produkti каталог, блог,
    //    наръчници). Началната страница и /products/[slug] НЕ са тук —
    //    количката там е винаги активна и не се управлява оттук.
    id: 'cart_pages', group: 'Технически', label: '🛒 Количка по страници',
    description: 'Включва/изключва количката в менюто на afiliate/produkti/блог/наръчници страници',
    keys: [
      { key: 'cart_produkt_enabled',   label: 'Количка на afiliate продуктова страница (/produkt/[slug])', type: 'toggle', placeholder: '' },
      { key: 'cart_produkt_label',     label: 'Текст на бутона (когато количката е изключена)',             type: 'text', placeholder: '🌾 Всички продукти' },
      { key: 'cart_produkt_href',      label: 'Линк на бутона (когато количката е изключена)',              type: 'text', placeholder: '/produkti' },

      { key: 'cart_produkti_enabled',  label: 'Количка на каталога (/produkti)',                            type: 'toggle', placeholder: '' },
      { key: 'cart_produkti_label',    label: 'Текст на бутона (когато количката е изключена)',             type: 'text', placeholder: '🏠 Начало' },
      { key: 'cart_produkti_href',     label: 'Линк на бутона (когато количката е изключена)',              type: 'text', placeholder: '/' },

      { key: 'cart_blog_enabled',      label: 'Количка на блога (/blog)',                                   type: 'toggle', placeholder: '' },
      { key: 'cart_blog_label',        label: 'Текст на бутона (когато количката е изключена)',             type: 'text', placeholder: '🛍️ Продукти' },
      { key: 'cart_blog_href',         label: 'Линк на бутона (когато количката е изключена)',              type: 'text', placeholder: '/produkti' },

      { key: 'cart_naruchnik_enabled', label: 'Количка на наръчниците (/naruchnik/[slug])',                 type: 'toggle', placeholder: '' },
      { key: 'cart_naruchnik_label',   label: 'Текст на бутона (когато количката е изключена)',             type: 'text', placeholder: '🏠 Начало' },
      { key: 'cart_naruchnik_href',    label: 'Линк на бутона (когато количката е изключена)',              type: 'text', placeholder: '/' },
    ],
  },
  {
    // ✅ линкове към социалните мрежи, показвани в SiteFooter (иконките долу
    //    вляво). Празно поле = иконата не се показва изобщо за тази мрежа.
    id: 'social_links', group: 'Технически', label: '📱 Соц. мрежи — линкове (футър)',
    description: 'Facebook/Instagram/YouTube/TikTok линкове за иконките във футъра — празно поле скрива иконата',
    keys: [
      { key: 'social_facebook_url',  label: 'Facebook линк',  type: 'text', placeholder: 'https://www.facebook.com/dennyangelow' },
      { key: 'social_instagram_url', label: 'Instagram линк', type: 'text', placeholder: 'https://www.instagram.com/dennyangelow' },
      { key: 'social_youtube_url',   label: 'YouTube линк',   type: 'text', placeholder: 'https://www.youtube.com/@dennyangelow' },
      { key: 'social_tiktok_url',    label: 'TikTok линк',    type: 'text', placeholder: 'https://www.tiktok.com/@dennyangelow' },
    ],
  },
] as const

function validate(vals: Record<string, string>): string[] {
  const errs: string[] = []
  ;['shipping_econt', 'shipping_speedy', 'free_shipping_above'].forEach(k => {
    if (vals[k] && (isNaN(parseFloat(vals[k])) || parseFloat(vals[k]) < 0))
      errs.push(`${k}: трябва да е положително число`)
  })
  ;['social_proof_items', 'trust_strip_items'].forEach(k => {
    if (vals[k]) { try { JSON.parse(vals[k]) } catch { errs.push(`${k}: невалиден JSON`) } }
  })
  return errs
}

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

// ─── Интеграции toggle компонент ─────────────────────────────────────────────
interface IntegrationRowProps {
  icon: string; name: string; description: string; enabled: boolean; loading: boolean
  onToggle: () => void; statusLabel?: string; statusColor?: string; href?: string
}

function IntegrationRow({ icon, name, description, enabled, loading, onToggle, statusLabel, statusColor, href }: IntegrationRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f5f5f5' }}>
      <div style={{ fontSize: 22, width: 32, textAlign: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{name}</span>
          {statusLabel && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: statusColor ? `${statusColor}18` : '#f0fdf4', color: statusColor || '#166534' }}>{statusLabel}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1, lineHeight: 1.4 }}>
          {description}
          {href && <a href={href} target="_blank" rel="noreferrer" style={{ color: '#2d6a4f', marginLeft: 6, textDecoration: 'none', fontWeight: 600 }}>Dashboard ↗</a>}
        </div>
      </div>
      <button onClick={onToggle} disabled={loading} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: loading ? 'default' : 'pointer', background: enabled ? '#16a34a' : '#d1d5db', position: 'relative', transition: 'background .2s', flexShrink: 0, opacity: loading ? 0.6 : 1 }}>
        <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', left: enabled ? 23 : 3, boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </button>
    </div>
  )
}

// ─── Urgency Bar Preview ──────────────────────────────────────────────────────
function UrgencyPreview({ text, label }: { text: string; label: string }) {
  if (!text) return null
  // Рендира **bold** → <strong>
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>
        Preview — {label}
      </div>
      <div style={{ background: 'linear-gradient(90deg,#14532d,#166534,#14532d)', padding: '8px 16px', borderRadius: 8, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.9)', lineHeight: 1.5 }}>
        {parts.map((part, i) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={i} style={{ color: '#fff', fontWeight: 800 }}>{part.slice(2, -2)}</strong>
            : <span key={i}>{part}</span>
        )}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SettingsTab({ ordersCount, leadsCount }: Props) {
  const [vals,       setVals]       = useState<Record<string, string>>({})
  const [savedVals,  setSavedVals]  = useState<Record<string, string>>({})
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [search,     setSearch]     = useState('')
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set())
  const isFirstLoad = useRef(true)

  const [resendEnabled,   setResendEnabled]   = useState(true)
  const [systemeEnabled,  setSystemeEnabled]  = useState(true)
  const [togglingResend,  setTogglingResend]  = useState(false)
  const [togglingSysteme, setTogglingSysteme] = useState(false)
  const [testingSysteme,  setTestingSysteme]  = useState(false)

  const dirty = useMemo(
    () => Object.keys(vals).some(k => vals[k] !== savedVals[k]),
    [vals, savedVals],
  )

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.settings) {
          setVals(d.settings)
          setSavedVals(d.settings)
          setResendEnabled(d.settings.resend_enabled    !== 'false')
          setSystemeEnabled(d.settings.systemeio_enabled !== 'false')
        }
        setLoading(false)
      })
      .catch(() => { toast.error('Грешка при зареждане на настройките'); setLoading(false) })
  }, [])

  const toggleIntegration = async (key: string, current: boolean, setFn: (v: boolean) => void, setBusy: (v: boolean) => void, label: string) => {
    setBusy(true)
    const next = !current
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: { [key]: String(next) } }) })
      if (!res.ok) throw new Error()
      setFn(next)
      setVals(p => ({ ...p, [key]: String(next) }))
      setSavedVals(p => ({ ...p, [key]: String(next) }))
      toast.success(`${label} е ${next ? 'активиран' : 'деактивиран'}`)
    } catch { toast.error(`Грешка при промяна на ${label}`) }
    finally { setBusy(false) }
  }

  const testSystemeIO = async () => {
    setTestingSysteme(true)
    try {
      const res = await fetch('/api/integrations/systemeio/test')
      const d   = await res.json()
      if (d.ok) toast.success(`✅ Systeme.io: свързан (${d.contacts ?? '?'} контакта)`)
      else      toast.error(`❌ Systeme.io: ${d.error || 'грешка'}`)
    } catch { toast.error('❌ Не може да се свърже с Systeme.io') }
    finally { setTestingSysteme(false) }
  }

  const debouncedVals = useDebounce(vals, 2000)
  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return }
    if (!dirty) return
    const errs = validate(debouncedVals)
    if (errs.length > 0) return
    setAutoSaving(true)
    fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: debouncedVals }) })
      .then(res => { if (res.ok) { setSavedVals({ ...debouncedVals }); toast.success('Автоматично запазено ✓') } })
      .catch(() => {})
      .finally(() => setAutoSaving(false))
  }, [debouncedVals])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const set = (key: string, val: string) => setVals(p => ({ ...p, [key]: val }))

  const save = async () => {
    const errs = validate(vals)
    if (errs.length > 0) { errs.forEach(e => toast.error(e)); return }
    setSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: vals }) })
      if (!res.ok) throw new Error()
      setSavedVals({ ...vals })
      toast.success('Настройките са запазени!')
    } catch { toast.error('Грешка при запазване') }
    finally { setSaving(false) }
  }

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(vals, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `settings-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    toast.success('Настройките са изтеглени')
  }

  const importSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target?.result as string)
        if (typeof imported !== 'object') throw new Error()
        setVals(prev => ({ ...prev, ...imported }))
        toast.success('Импортирано — провери и запази')
      } catch { toast.error('Невалиден JSON файл') }
    }
    reader.readAsText(file); e.target.value = ''
  }

  const triggerSequence = async () => {
    const res = await fetch('/api/leads/sequence')
    const d   = await res.json()
    if (res.ok) toast.success(`Sequence: ${d.sent} имейла изпратени`)
    else        toast.error(d.error || 'Грешка')
  }

  const toggleSection = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const expandAll   = () => setExpanded(new Set(SECTIONS.map(s => s.id)))
  const collapseAll = () => setExpanded(new Set())

  const filteredSections = useMemo(() => {
    if (!search.trim()) return SECTIONS
    const q = search.toLowerCase()
    return SECTIONS
      .map(s => ({ ...s, keys: s.keys.filter(k => k.label.toLowerCase().includes(q) || k.key.toLowerCase().includes(q)) }))
      .filter(s => s.keys.length > 0)
  }, [search])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid #f0f0f0', borderRadius: 9,
    fontFamily: 'inherit', fontSize: 16, outline: 'none',
    background: '#f9fafb', color: 'var(--text)',
    boxSizing: 'border-box', transition: 'border-color .2s',
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#6b7280', fontSize: 14 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2d6a4f', borderRadius: '50%', animation: 'spin .7s linear infinite', marginRight: 12 }} />
      Зарежда настройките...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: '16px 14px' }}>
      <style>{`
        .settings-input:focus    { border-color: #2d6a4f !important; background: #fff !important }
        .settings-textarea:focus { border-color: #2d6a4f !important; background: #fff !important }
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .5 } }
        .settings-layout{display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
        .settings-fields-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px}
        @media(max-width:640px){.settings-fields-grid{grid-template-columns:1fr}}
        .settings-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:16px;flex-wrap:wrap}
        @media(max-width:900px){.settings-layout{grid-template-columns:1fr}}
        @media(max-width:560px){.settings-header{flex-direction:column;align-items:flex-start}}
      `}</style>

      {/* Header */}
      <div className="settings-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Настройки</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            Глобални параметри
            {autoSaving && <span style={{ fontSize: 11, color: '#16a34a', animation: 'pulse 1s infinite' }}>⏳ Запазва...</span>}
            {!autoSaving && !dirty && <span style={{ fontSize: 11, color: '#9ca3af' }}>✓ Запазено</span>}
            {!autoSaving && dirty  && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>● Незапазени промени</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={exportSettings} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text)' }}>
            ↓ Експорт JSON
          </button>
          <label style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--text)' }}>
            ↑ Импорт JSON
            <input type="file" accept=".json" onChange={importSettings} style={{ display: 'none' }} />
          </label>
          <button onClick={save} disabled={saving || !dirty}
            style={{ background: dirty ? '#1b4332' : '#d1d5db', color: dirty ? '#fff' : '#6b7280', border: 'none', borderRadius: 9, padding: '9px 20px', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: dirty ? 'pointer' : 'default', transition: 'all .2s' }}>
            {saving ? '⏳ Запазва...' : '✓ Запази'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 0 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input placeholder="Търси настройка..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 36, background: '#fff' }} className="settings-input" />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={expandAll} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--text)', whiteSpace: 'nowrap' }}>
            ⤢ Разгъни всички
          </button>
          <button onClick={collapseAll} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: 'var(--text)', whiteSpace: 'nowrap' }}>
            ⤡ Свий всички
          </button>
        </div>
        {search && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, width: '100%' }}>{filteredSections.reduce((s, sec) => s + sec.keys.length, 0)} намерени резултата</div>}
      </div>

      <div className="settings-layout">

        {/* Settings sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredSections.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              Няма настройки за „{search}"
            </div>
          ) : filteredSections.map((section, idx) => {
            const isExpanded   = search.trim() ? true : expanded.has(section.id)
            const sectionDirty = section.keys.some(k => vals[k.key] !== savedVals[k.key])
            // ✅ Group divider — показва се само пред първата секция от всяка
            //    група (не и при активно търсене, за да не къса резултатите)
            const showGroupHeader = !search.trim() && (idx === 0 || filteredSections[idx - 1].group !== section.group)

            return (
              <div key={section.id}>
                {showGroupHeader && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.08em', margin: idx === 0 ? '0 0 4px 4px' : '18px 0 4px 4px' }}>
                    {section.group}
                  </div>
                )}
                <div style={{ background: '#fff', border: `1px solid ${sectionDirty ? '#fde68a' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color .2s' }}>
                <button onClick={() => toggleSection(section.id)}
                  style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'left', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{section.label}</h2>
                      {sectionDirty && <span style={{ fontSize: 10, background: '#fde68a', color: '#92400e', padding: '2px 7px', borderRadius: 99, fontWeight: 700, flexShrink: 0 }}>Редактирано</span>}
                    </div>
                    {/* ✅ Описание — винаги видимо, дори свита, за да знаеш какво има вътре без да отваряш */}
                    <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 3, lineHeight: 1.4 }}>{section.description}</div>
                  </div>
                  <span style={{ color: '#9ca3af', fontSize: 12, transition: 'transform .2s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▼</span>
                </button>

                {isExpanded && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f5f5f5' }}>
                    <div style={{ height: 14 }} />
                    <div className="settings-fields-grid">
                    {section.keys.map(k => {
                      const isChanged = vals[k.key] !== savedVals[k.key]
                      const isUrgencyProducts = k.key === 'urgency_bar_products'
                      const isUrgencyHome     = k.key === 'urgency_bar_text'
                      // ✅ 'toggle' тип поле (виж секция "cart_pages") —
                      //   рендва се като превключвател, не като текстово поле.
                      //   Стойността се пази като string 'true'/'false' в vals,
                      //   но минава през СЪЩИЯ автоматичен save механизъм
                      //   (debouncedVals useEffect) като всичко останало.
                      const isToggle = (k as { type: string }).type === 'toggle'
                      const toggleOn = vals[k.key] === 'true'
                      // ✅ НОВО: textarea/toggle полета заемат целия ред (нужно
                      //    им е повече място / имат preview под тях); кратките
                      //    text/tel/email/number полета се редят по 2 в ред —
                      //    секции като "Контакти"/"Валута" вече не хабят
                      //    цял ред за едно кратко поле.
                      const isFullWidth = k.type === 'textarea' || isToggle || isUrgencyProducts || isUrgencyHome

                      return (
                        <div key={k.key} style={{ gridColumn: isFullWidth ? '1 / -1' : 'auto' }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: isChanged ? '#92400e' : '#374151', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                            {k.label}
                            {isChanged && <span style={{ fontSize: 10, color: '#f59e0b' }}>●</span>}
                          </label>

                          {/* Специален контейнер за urgency bar полетата */}
                          {(isUrgencyProducts || isUrgencyHome) ? (
                            <div style={{ border: `1.5px solid ${isUrgencyProducts ? '#bbf7d0' : '#fde68a'}`, borderRadius: 10, padding: 12, background: isUrgencyProducts ? '#f0fdf4' : '#fffbeb' }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: isUrgencyProducts ? '#15803d' : '#92400e', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                                {isUrgencyProducts ? '🌱 Само /products/* страници' : '🏠 Само началната страница /'}
                              </div>
                              <textarea rows={3} value={vals[k.key] || ''} onChange={e => set(k.key, e.target.value)}
                                placeholder={k.placeholder} className="settings-textarea"
                                style={{ ...inputStyle, resize: 'vertical', background: '#fff' }} />
                              {'hint' in k && k.hint && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{k.hint}</div>}
                              {/* Live preview */}
                              <UrgencyPreview text={vals[k.key] || ''} label={isUrgencyProducts ? 'Продуктова страница' : 'Начална страница'} />
                            </div>
                          ) : isToggle ? (
                            <button
                              type="button"
                              onClick={() => set(k.key, toggleOn ? 'false' : 'true')}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              <span style={{ width: 44, height: 24, borderRadius: 12, background: toggleOn ? '#16a34a' : '#d1d5db', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                                <span style={{ position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', left: toggleOn ? 23 : 3, boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: toggleOn ? '#16a34a' : '#6b7280' }}>
                                {toggleOn ? 'Активна' : 'Изключена'}
                              </span>
                            </button>
                          ) : (
                            <>
                              {k.type === 'textarea' ? (
                                <textarea rows={3} value={vals[k.key] || ''} onChange={e => set(k.key, e.target.value)}
                                  placeholder={k.placeholder} className="settings-textarea"
                                  style={{ ...inputStyle, resize: 'vertical' }} />
                              ) : (
                                <input type={k.type} value={vals[k.key] || ''} onChange={e => set(k.key, e.target.value)}
                                  placeholder={k.placeholder} className="settings-input"
                                  step={k.type === 'number' ? '0.01' : undefined}
                                  min={k.type === 'number' ? '0' : undefined}
                                  style={inputStyle} />
                              )}
                              {'hint' in k && k.hint && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{k.hint}</div>}
                            </>
                          )}
                        </div>
                      )
                    })}
                    </div>
                  </div>
                )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Urgency bar quick guide */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#14532d', marginBottom: 10 }}>🌱 Urgency Bar Guide</h2>
            <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.7 }}>
              <strong>urgency_bar_text</strong> → Началната страница / — показва се само там.<br/>
              <strong>urgency_bar_products</strong> → Всички /products/* страници — само Atlas Terra продукти.<br/>
              <br/>
              Поддържа <code style={{ background: '#dcfce7', padding: '1px 4px', borderRadius: 3 }}>**bold**</code> форматиране.<br/>
              <br/>
              <strong>Препоръчан текст за продуктите:</strong><br/>
              <code style={{ background: '#dcfce7', padding: '3px 6px', borderRadius: 4, fontSize: 11, display: 'block', marginTop: 4, lineHeight: 1.6 }}>
                🌱 **Atlas Terra** — Органичен биостимулант · 📦 **Безплатна доставка** при 10л+ · 💵 Само наложен платеж
              </code>
            </div>
          </div>

          {/* 🛒 Количка по страници — quick guide */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 14, padding: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#1e3a8a', marginBottom: 10 }}>🛒 Количка по страници</h2>
            <div style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.7 }}>
              Началната страница и /products/* (Atlas Terra) винаги имат количка — не се управлява оттук.<br/>
              <br/>
              За afiliate продукти, /produkti, блога и наръчниците: ако е <strong>„Изключена"</strong>, вместо бутона за количка се показва линкът, който зададеш (текст + href).<br/>
              <br/>
              Празен текст/линк → пада се на разумен default (виж placeholder-ите).
            </div>
          </div>

          {/* 📱 Социални мрежи — quick guide */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 10 }}>📱 Социални мрежи</h2>
            <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.7 }}>
              Иконките в дъното на футъра (FB/IG/YT/TT) взимат линковете оттук.<br/>
              <br/>
              <strong>Празно поле</strong> → иконата на тази мрежа изобщо не се показва във футъра — удобно ако не ползваш някоя платформа.
            </div>
          </div>

          {/* ИНТЕГРАЦИИ */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>🔌 Интеграции</h2>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 14px', lineHeight: 1.5 }}>Активирай/деактивирай без рестартиране — влиза в сила веднага.</p>
            <IntegrationRow icon="✉️" name="Resend" description="Welcome + follow-up имейли към потребителите" enabled={resendEnabled} loading={togglingResend} statusLabel={resendEnabled ? 'Активен' : 'Изключен'} statusColor={resendEnabled ? '#16a34a' : '#6b7280'} href="https://resend.com/emails"
              onToggle={() => toggleIntegration('resend_enabled', resendEnabled, setResendEnabled, setTogglingResend, 'Resend')} />
            <IntegrationRow icon="🟠" name="Systeme.io" description="Синхронизира leads + автоматизации в Systeme.io" enabled={systemeEnabled} loading={togglingSysteme} statusLabel={systemeEnabled ? 'Активен' : 'Изключен'} statusColor={systemeEnabled ? '#16a34a' : '#6b7280'} href="https://systeme.io/dashboard/contacts"
              onToggle={() => toggleIntegration('systemeio_enabled', systemeEnabled, setSystemeEnabled, setTogglingSysteme, 'Systeme.io')} />
            <button onClick={testSystemeIO} disabled={testingSysteme || !systemeEnabled}
              style={{ marginTop: 12, width: '100%', padding: '9px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: (testingSysteme || !systemeEnabled) ? 'default' : 'pointer', background: systemeEnabled ? '#fff7ed' : '#f9fafb', border: `1px solid ${systemeEnabled ? '#fed7aa' : '#e5e7eb'}`, borderRadius: 9, color: systemeEnabled ? '#c2410c' : '#9ca3af', transition: 'all .2s', opacity: !systemeEnabled ? 0.5 : 1 }}>
              {testingSysteme ? '⏳ Проверява...' : '🔗 Тествай Systeme.io връзка'}
            </button>
            <div style={{ marginTop: 10, background: '#f8fafc', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
              <strong style={{ color: '#374151', display: 'block', marginBottom: 2 }}>Как работи:</strong>
              При изтегляне на наръчник → записва се в Supabase → изпраща welcome имейл (Resend) → добавя контакт в Systeme.io.<br/>
              <strong style={{ color: '#92400e' }}>⚠️ Env var:</strong> трябва да е точно <code>systemeio_api</code> в Vercel.
            </div>
          </div>

          {/* Status */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 14px' }}>📊 Статус</h2>
            {[
              { label: 'Поръчки',    value: ordersCount,   color: '#16a34a' },
              { label: 'Абонати',    value: leadsCount,    color: '#0ea5e9' },
              { label: 'Framework',  value: 'Next.js 14' },
              { label: 'База данни', value: 'Supabase' },
              { label: 'Email',      value: resendEnabled  ? '✅ Resend'     : '⏸ Resend изкл.',   color: resendEnabled  ? '#16a34a' : '#9ca3af' },
              { label: 'Leads sync', value: systemeEnabled ? '✅ Systeme.io' : '⏸ Systeme изкл.',  color: systemeEnabled ? '#f97316' : '#9ca3af' },
              { label: 'Hosting',    value: 'Vercel' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                <span style={{ fontWeight: 700, color: (row as any).color || 'var(--text)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Email sequences */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>⚙️ Email Sequences</h2>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>Изпълнява се автоматично всеки час (Vercel Cron).</p>
            <div style={{ background: '#f0fdf4', borderRadius: 9, padding: '10px 12px', fontSize: 12, color: '#166534', marginBottom: 12, lineHeight: 1.6 }}>
              📅 Welcome → +2д → +5д → +10д<br/>🛒 Abandoned: след 24ч без обработка
            </div>
            <button onClick={triggerSequence} style={{ width: '100%', padding: '10px', background: '#1b4332', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}>
              ▶ Стартирай ръчно
            </button>
          </div>

          {/* Google Analytics */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>📊 Google Analytics</h2>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, lineHeight: 1.5 }}>
              GA4 скриптът се зарежда автоматично ако <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>NEXT_PUBLIC_GA_ID</code> е зададен в Vercel.
            </p>
            <div style={{ background: '#f8fafc', borderRadius: 9, padding: '12px 14px', marginBottom: 12, fontSize: 12, lineHeight: 1.8 }}>
              <strong style={{ display: 'block', marginBottom: 6, color: '#374151' }}>Как да настроиш:</strong>
              <ol style={{ paddingLeft: 16, margin: 0, color: '#4b5563' }}>
                <li>Отиди на <a href="https://analytics.google.com" target="_blank" rel="noreferrer" style={{ color: '#2d6a4f', fontWeight: 600 }}>analytics.google.com</a></li>
                <li>Създай Property → Web → въведи dennyangelow.com</li>
                <li>Копирай Measurement ID (<code style={{ background: '#e5e7eb', padding: '1px 4px', borderRadius: 3 }}>G-XXXXXXXXXX</code>)</li>
                <li>Vercel → Environment Variables → <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: 3, fontSize: 11 }}>NEXT_PUBLIC_GA_ID = G-XXXXXXXXXX</code></li>
                <li>Redeploy → готово ✅</li>
              </ol>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a href="https://analytics.google.com" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9, textDecoration: 'none', color: '#15803d', fontSize: 13, fontWeight: 600 }}>
                <span>📊</span> Отвори GA4
              </a>
              <a href="https://vercel.com/dennyangelows-projects/denny/settings/environment-variables" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 9, textDecoration: 'none', color: '#374151', fontSize: 13, fontWeight: 600 }}>
                <span>▲</span> Vercel Env Vars
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>🔗 Бързи линкове</h2>
            {[
              { label: 'Supabase Dashboard', url: 'https://app.supabase.com',             icon: '⬡', color: '#3ecf8e' },
              { label: 'Resend Dashboard',   url: 'https://resend.com/emails',             icon: '✉', color: '#0ea5e9' },
              { label: 'Systeme.io',         url: 'https://systeme.io/dashboard/contacts', icon: '🟠', color: '#f97316' },
              { label: 'Vercel Dashboard',   url: 'https://vercel.com/dashboard',          icon: '▲', color: '#111' },
              { label: 'Главна страница',    url: '/',                                     icon: '◫', color: '#6b7280' },
            ].map(l => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 9, textDecoration: 'none', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6, transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#2d6a4f'; e.currentTarget.style.background = '#f0fdf4' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = '#f8fafc' }}>
                <span style={{ color: l.color, fontSize: 16 }}>{l.icon}</span>
                <span style={{ flex: 1 }}>{l.label}</span>
                <span style={{ color: '#9ca3af', fontSize: 11 }}>↗</span>
              </a>
            ))}
          </div>

          {/* Security */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: 18 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 10 }}>⚠️ Сигурност</h2>
            {[
              ['ADMIN_SECRET',   'Задай в Vercel → Env Vars. Без него /admin е публичен!'],
              ['systemeio_api',  'Задай в Vercel → Env Vars с точно това име.'],
              ['RLS в Supabase', 'Row Level Security трябва да е активирана.'],
              ['CRON_SECRET',    'Защита на /api/leads/sequence.'],
            ].map(([k, v]) => (
              <div key={k} style={{ marginBottom: 8, fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>
                <strong style={{ color: '#92400e', display: 'block', fontSize: 11, textTransform: 'uppercase' }}>{k}</strong>
                {v}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
