'use client'
// app/produkt/[slug]/AffiliateProduktClient.tsx — v6
// ✅ ПОДОБРЕНИЯ спрямо v5:
//   1. Tab badge с брой — "❓ Въпроси (8)" показва колко съдържание има преди клик
//   2. Цена в мобилния sticky бутон — "49.90 EUR — Виж в AgroApteki"
//   3. Pulse анимация на бутона след 30 сек престой
//   4. "Последно обновено" дата видима на потребителя
//   5. Lightbox за снимката — клик отваря fullscreen <dialog>
//   6. "Комбинирай с" показана под табовете на мобилно (по-видима)
//   7. loading="lazy" на related снимките
//   8. "👥 847 оценки" по-видимо с икона навсякъде
//   9. formatBgDate helper за красива дата на български
//  10. useRef за dialog (правилен API)

import { useState, useEffect, useMemo, useRef } from 'react'
import type { AffiliateProduct, ProductImage } from '@/lib/affiliate'
import { getRating, parseHowToUse, parseYouTubeEmbed, getAllImages } from '@/lib/affiliate'

// ✅ ФИКС: DM Sans и Cormorant Garamond вече се зареждат ВЕДНЪЖ, глобално, в
//    app/layout.tsx чрез next/font/google — приложени като CSS променливи
//    (--font-dm-sans / --font-cormorant) върху <html>. Тук просто ги ползваме
//    с var(...) — регистрирането им пак тук би заредило шрифтовете двойно.

interface Props {
  product:     AffiliateProduct
  related:     AffiliateProduct[]
  avgRating:   number
  reviewCount: number
  // ✅ По желание — ако не е подадено (напр. стар caller), се извежда от product
  images?:     ProductImage[]
}

type TabId = 'about' | 'howto' | 'tech' | 'faq'

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <span style={{ display:'inline-flex', gap:1 }} role="img" aria-label={`Рейтинг ${rating.toFixed(1)} от 5`}>
      {[1,2,3,4,5].map(i => (
        <span key={i} aria-hidden="true"
          style={{ fontSize:size, color: i<=Math.round(rating) ? '#f59e0b' : '#e2e8f0', lineHeight:1 }}>★</span>
      ))}
    </span>
  )
}

// ✅ ФИКС: поддръжка на **bold** inline текст — разбива реда по **...** и
//    рендерира съответните части в <strong>, без да губи останалия текст.
function renderInline(text: string, keyPrefix: React.Key) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(p => p !== '')
  if (parts.length <= 1) return text
  return parts.map((part, idx) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${keyPrefix}-b${idx}`} style={{ fontWeight:700, color:'#1e293b' }}>{part.slice(2, -2)}</strong>
      : <span key={`${keyPrefix}-t${idx}`}>{part}</span>
  )
}

const isTableRow = (l: string) => l.trim().startsWith('|') && l.trim().endsWith('|')
const isTableSep = (l: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(l.trim())
const parseTableRow = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())

// ✅ ФИКС: поддръжка на markdown таблици (`| Кол1 | Кол2 |` + `|---|---|` разделител).
//    Преди това целите редове с `|` излизаха като суров текст (виж скрийншотите).
function renderFullContent(text?: string, color = '#16a34a') {
  if (!text) return null
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} style={{ fontSize:14, fontWeight:700, color:'#1e293b', marginTop:18, marginBottom:8, lineHeight:1.4 }}>
          {renderInline(line.replace('## ', ''), `h${i}`)}
        </h2>
      )
      i++
      continue
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = parseTableRow(line)
      i += 2 // header + separator
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(parseTableRow(lines[i]))
        i++
      }
      elements.push(
        <div key={`table-${i}`} style={{ overflowX:'auto', borderRadius:12, border:'1px solid #f1f5f9', margin:'8px 0 14px' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>
                {header.map((h, hi) => (
                  <th key={hi} style={{ background:'#f0fdf4', color:'#166534', fontWeight:800, fontSize:10.5, letterSpacing:'.05em', textTransform:'uppercase', padding:'9px 14px', textAlign:'left', whiteSpace:'nowrap' }}>
                    {renderInline(h, `th${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} style={{ padding:'9px 14px', borderTop:'1px solid #f1f5f9', color:'#374151', lineHeight:1.5 }}>
                      {renderInline(c, `td${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    if (line.startsWith('- ') || line.startsWith('• ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('• '))) {
        items.push(lines[i].trim().replace(/^[-•]\s*/, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ listStyle:'none', padding:0, margin:'0 0 6px' }}>
          {items.map((item, j) => (
            <li key={j} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:5, fontSize:13.5, color:'#374151', lineHeight:1.65 }}>
              <span style={{ color, fontWeight:800, flexShrink:0, marginTop:1 }}>✓</span>
              <span>{renderInline(item, `li${j}`)}</span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    elements.push(
      <p key={i} style={{ fontSize:14, color:'#4b5563', lineHeight:1.8, marginBottom:8 }}>{renderInline(line, `p${i}`)}</p>
    )
    i++
  }
  return elements
}

function difficultyBadge(quarantineDays?: number) {
  if (quarantineDays === undefined) return null
  if (quarantineDays === 0)  return { label:'Лесно за прилагане',         color:'#166534', bg:'#f0fdf4', border:'#bbf7d0', icon:'✅' }
  if (quarantineDays <= 3)   return { label:'Умерено — спази карантина',   color:'#92400e', bg:'#fffbeb', border:'#fde68a', icon:'⚠️' }
  return                            { label:'Внимание — дълга карантина',  color:'#991b1b', bg:'#fef2f2', border:'#fecaca', icon:'🔴' }
}

// ✅ НОВО: етикети за начин на приложение в таба "Приложение".
//    Изрично без думата "фертигация" — само "Почвено внасяне" / "Капково напояване".
function methodLabel(method?: string): { icon: string; label: string; tone: 'foliar' | 'soil' } | null {
  switch (method) {
    case 'foliar': return { icon:'🌿', label:'Листно пръскане',      tone:'foliar' }
    case 'soil':   return { icon:'💧', label:'Почвено внасяне',       tone:'soil' }
    case 'drip':   return { icon:'💧', label:'Капково напояване',     tone:'soil' }
    default:       return null
  }
}

function formatBgDate(dateStr?: string): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString('bg-BG', { year:'numeric', month:'long', day:'numeric' })
  } catch { return null }
}

export default function AffiliateProduktClient({ product, related, avgRating, reviewCount, images }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('about')
  const [openFaq,   setOpenFaq]   = useState<number | null>(null)
  const [scrollPct, setScrollPct] = useState(0)
  const [bought,    setBought]    = useState(false)
  const [mobMenu,   setMobMenu]   = useState(false)
  const [scrolled,  setScrolled]  = useState(false)
  const [pulse,     setPulse]     = useState(false)   // ✅ #3
  const [lightbox,  setLightbox]  = useState(false)   // ✅ #5
  const dialogRef = useRef<HTMLDialogElement>(null)    // ✅ #10

  // ── Галерия ────────────────────────────────────────────────────────────
  const allGalleryImages = useMemo(() => images ?? getAllImages(product), [images, product])
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set())
  const gallery = allGalleryImages.filter(img => !brokenUrls.has(img.url))
  const [activeIdx, setActiveIdx] = useState(0)
  const currentIdx = Math.min(activeIdx, Math.max(gallery.length - 1, 0))
  const current    = gallery[currentIdx]

  const markBroken = (url: string) =>
    setBrokenUrls(prev => new Set(prev).add(url))

  const color = product.color || '#16a34a'

  const howToSteps   = parseHowToUse(product.how_to_use)
  const youtubeEmbed = parseYouTubeEmbed(product.youtube_url)

  const faqItems  = Array.isArray(product.faq)        ? product.faq        : []
  // ✅ НОВО: dose_table вече поддържа опционални полета `crop`, `stage`, `method`,
  //    `purpose` за по-обучително, разбито по култура приложение. Стар формат
  //    ({phase, dose, interval}) продължава да работи — вижда се fallback таблица долу.
  //    Типовете от lib/affiliate все още не описват тези полета — cast към `any[]`
  //    докато не се разширят там; не чупи нищо ако полетата липсват.
  const doseTable = (Array.isArray(product.dose_table) ? product.dose_table : []) as {
    phase?: string; crop?: string; stage?: string
    method?: 'foliar' | 'soil' | 'drip' | string
    dose: string; interval: string; purpose?: string
  }[]
  const crops     = Array.isArray(product.crops)      ? product.crops      : []
  const warnings  = Array.isArray(product.warnings)   ? product.warnings   : []
  const features  = Array.isArray(product.features)   ? product.features   : []
  const bullets   = Array.isArray(product.bullets)    ? product.bullets    : features

  // ✅ НОВО: опционални CMS полета за по-подробния таб "Технически" —
  //    добави ги в AffiliateProduct типа в lib/affiliate.ts когато ги попълниш в админ панела.
  const composition = Array.isArray((product as any).composition)
    ? (product as any).composition as { element: string; content: string }[] : []
  const modeOfAction = Array.isArray((product as any).mode_of_action)
    ? (product as any).mode_of_action as string[] : []
  const ph              = (product as any).ph as string | undefined
  const density          = (product as any).density as string | undefined
  const storageInfo      = (product as any).storage_instructions as string | undefined
  const applicationIntro = (product as any).application_intro as string | undefined

  const diff        = difficultyBadge(product.quarantine_days)
  const lastUpdated = formatBgDate(product.updated_at || product.date_published) // ✅ #4/#9

  const hasAbout = !!(product.description || bullets.length > 0 || product.full_content || warnings.length > 0 || product.vs_competitor)
  const hasHowto = howToSteps.length > 0 || doseTable.length > 0
  const hasTech  = !!(product.active_substance || product.dosage || crops.length > 0 || product.quarantine_days !== undefined)
  const hasFaq   = faqItems.length > 0

  // ✅ #1 Tabs с count badge
  const tabs = useMemo(() => ([
    hasAbout && { id:'about' as TabId, label:'За продукта', icon:'📋', count: null },
    hasHowto && { id:'howto' as TabId, label:'Приложение',  icon:'📌', count: howToSteps.length || doseTable.length || null },
    hasTech  && { id:'tech'  as TabId, label:'Технически',  icon:'🔬', count: null },
    hasFaq   && { id:'faq'   as TabId, label:'Въпроси',     icon:'❓', count: faqItems.length },
  ].filter(Boolean) as { id: TabId; label: string; icon: string; count: number | null }[]),
  [hasAbout, hasHowto, hasTech, hasFaq, howToSteps.length, doseTable.length, faqItems.length])

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id)
    }
  }, [tabs, activeTab])

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      setScrollPct(Math.min((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100, 100))
      setScrolled(el.scrollTop > 10)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ✅ #3 Pulse след 30 сек
  useEffect(() => {
    const t = setTimeout(() => setPulse(true), 30_000)
    return () => clearTimeout(t)
  }, [])

  // ✅ #5 #10 Lightbox с useRef
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (lightbox) { d.showModal() } else { if (d.open) d.close() }
  }, [lightbox])

  const handleBuy = () => {
    const url = product.affiliate_url
    if (!url || url === 'undefined' || url === 'null') {
      console.warn('[handleBuy] affiliate_url невалиден:', url)
      return
    }
    window.open(url, '_blank', 'noopener noreferrer')
    setBought(true)
    setPulse(false)
    setTimeout(() => setBought(false), 2500)
    fetch('/api/affiliate-clicks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner: product.partner, product_slug: product.slug }),
    }).catch(() => {})
  }

  // ✅ #2 Цена за мобилния бутон
  const priceLabel = product.price
    ? `${Number(product.price).toFixed(2)} ${product.price_currency || 'EUR'} — `
    : ''

  // ✅ #6 Related компонент — използван на 2 места (desktop/mobile)
  const RelatedBlock = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
      {related.map(rel => (
        <a key={rel.id} href={`/produkt/${rel.slug}`} className="af-rel"
          style={{'--rc': rel.color || color} as React.CSSProperties}>
          {rel.image_url
            ? <img src={rel.image_url} alt={rel.name}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                width={40} height={40}
                loading="lazy"  // ✅ #7
                style={{ width:40, height:40, objectFit:'contain', borderRadius:8, flexShrink:0, mixBlendMode:'multiply' }} />
            : <div style={{ width:40, height:40, borderRadius:8, background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{rel.emoji || '🌿'}</div>
          }
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{rel.name}</div>
            <div style={{ fontSize:10, color:rel.color||color, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', marginTop:1 }}>{rel.category_label || rel.subtitle}</div>
          </div>
          <span style={{ color:rel.color||color, fontSize:13, flexShrink:0 }}>→</span>
        </a>
      ))}
    </div>
  )

  return (
    <div className="af-page-root">
      <style suppressHydrationWarning>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth;overflow-x:hidden;max-width:100vw}
        body{font-family:var(--font-dm-sans),-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#fafaf8;color:#1a1a1a;overflow-x:hidden;max-width:100vw;width:100%}
        .af-page-root{width:100%;max-width:100vw;overflow-x:hidden;position:relative}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes tabIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideRight{from{opacity:0;transform:translateX(-100%)}to{opacity:1;transform:translateX(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{box-shadow:0 8px 28px var(--pc,#16a34a44)}50%{box-shadow:0 8px 36px var(--pc,#16a34a88),0 0 0 6px var(--pc,#16a34a22)}}
        .af-btn-pulse{animation:pulse 1.8s ease-in-out infinite}
        .site-header{position:sticky;top:0;z-index:200;background:rgba(255,255,255,.96);backdrop-filter:blur(16px);border-bottom:1px solid #e5e7eb;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:60px;box-shadow:0 1px 8px rgba(0,0,0,.04);transition:all .3s;gap:14px}
        .site-header.scrolled{box-shadow:0 4px 24px rgba(0,0,0,.08)}
        .header-logo{display:flex;align-items:center;gap:9px;flex-shrink:0;text-decoration:none}
        .logo-name{font-weight:700;font-size:17px;font-family:var(--font-cormorant),serif;color:#1a1a1a;line-height:1}
        .logo-sub{font-size:9px;color:#16a34a;font-weight:700;letter-spacing:.09em;text-transform:uppercase}
        .header-nav{display:flex;gap:2px;align-items:center}
        .nav-link{color:#374151;text-decoration:none;font-size:13px;font-weight:600;padding:5px 11px;border-radius:8px;transition:all .2s;white-space:nowrap}
        .nav-link:hover{color:#16a34a;background:#f0fdf4}
        .cart-btn{background:#f0fdf4;color:#16a34a;border:2px solid #16a34a;border-radius:11px;padding:7px 14px;cursor:pointer;font-weight:800;font-size:13.5px;display:flex;align-items:center;gap:5px;transition:all .2s;font-family:inherit;white-space:nowrap;flex-shrink:0;text-decoration:none}
        .cart-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(22,163,74,.25)}
        .mob-btn{display:none;background:#f4f4f4;border:none;border-radius:9px;width:38px;height:38px;font-size:19px;cursor:pointer;align-items:center;justify-content:center;flex-shrink:0}
        .mob-nav{position:sticky;top:60px;z-index:100;background:#fff;border-bottom:1px solid #e5e7eb;padding:10px 22px;display:flex;flex-direction:column;gap:3px;box-shadow:0 8px 24px rgba(0,0,0,.08);animation:slideRight .25s ease}
        .mob-nav-link{color:#374151;text-decoration:none;font-size:15px;font-weight:700;padding:9px 13px;border-radius:9px;display:block}
        .mob-nav-link:hover{background:#f0fdf4;color:#16a34a}
        .af-hero-band{background:linear-gradient(160deg,#f0fdf4 0%,#dcfce7 50%,#f0fdf8 100%);border-bottom:1px solid #bbf7d0;padding:20px 0 0;position:relative;width:100%;max-width:100vw}
        .af-hero-band::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent 5%,#86efac 40%,#16a34a 50%,#86efac 60%,transparent 95%)}
        .af-hero-inner{max-width:1080px;margin:0 auto;padding:0 20px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
        .af-bc{display:flex;align-items:center;gap:5px;font-size:12px;color:#6b7280;min-width:0;flex:1;overflow:hidden}
        .af-bc a{color:#6b7280;text-decoration:none;transition:color .15s;white-space:nowrap;flex-shrink:0}.af-bc a:hover{color:#16a34a}
        .af-bc strong{color:#14532d;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.af-bc-sep{opacity:.4;flex-shrink:0}
        .af-cat-badge{font-size:9.5px;font-weight:800;padding:4px 11px;border-radius:20px;letter-spacing:.1em;text-transform:uppercase;flex-shrink:0;white-space:nowrap}
        .af-grid{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:24px;max-width:1080px;margin:0 auto;padding:20px 20px 80px;align-items:start;width:100%}
        .af-left{position:sticky;top:76px;display:flex;flex-direction:column;gap:12px;animation:fadeUp .45s ease both;min-width:0;width:100%}
        .af-right{display:flex;flex-direction:column;gap:0;animation:fadeUp .45s .08s ease both;min-width:0;width:100%}
        .af-card{background:#fff;border-radius:18px;border:1px solid rgba(0,0,0,.07);box-shadow:0 1px 3px rgba(0,0,0,.04),0 6px 24px rgba(0,0,0,.05);overflow:hidden}
        .af-card-p{padding:20px 22px}.af-card-sm{padding:14px 18px}
        .af-sec{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;display:flex;align-items:center;gap:8px;margin-bottom:12px}
        .af-sec::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,#e2e8f0,transparent)}
        .af-h2-seo{font-size:14px;font-weight:700;color:#1e293b;margin-bottom:12px;margin-top:4px;line-height:1.4}
        .af-btn-buy{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:16px 22px;border:none;border-radius:14px;font-size:15.5px;font-weight:800;font-family:var(--font-dm-sans),sans-serif;cursor:pointer;letter-spacing:-.01em;color:#fff;transition:all .22s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
        .af-btn-buy::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,transparent 55%);pointer-events:none}
        .af-btn-buy:hover{transform:translateY(-2px);filter:brightness(1.06)}
        .af-btn-buy:active{transform:translateY(0);filter:brightness(.96)}
        .af-trust-row{display:flex;gap:5px;flex-wrap:wrap;justify-content:center}
        .af-trust-b{font-size:10px;font-weight:700;color:#64748b;background:#f8f7f4;border:1px solid #e8e3d9;border-radius:6px;padding:4px 9px}
        .af-tab-badge{display:inline-flex;align-items:center;justify-content:center;background:rgba(22,163,74,.15);color:#166534;border-radius:20px;font-size:9px;font-weight:800;padding:1px 6px;margin-left:3px;line-height:1.4}
        .af-tab.active .af-tab-badge{background:rgba(20,83,45,.2);color:#14532d}
        .af-tabs-bar{display:flex;background:#fff;border-radius:18px 18px 0 0;overflow:hidden;border:1px solid rgba(0,0,0,.07);border-bottom:none;box-shadow:0 1px 3px rgba(0,0,0,.04),0 6px 24px rgba(0,0,0,.05)}
        .af-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:13px 8px;font-size:12.5px;font-weight:700;font-family:var(--font-dm-sans),sans-serif;background:none;border:none;cursor:pointer;transition:all .18s;color:#94a3b8;white-space:nowrap;border-bottom:2.5px solid transparent}
        .af-tab:hover{color:#374151;background:#fafaf8}
        .af-tab.active{color:#14532d;background:#f0fdf4;border-bottom-color:#16a34a}
        .af-tab-icon{font-size:14px}
        .af-tab-panel{background:#fff;border-radius:0 0 18px 18px;border:1px solid rgba(0,0,0,.07);border-top:none;box-shadow:0 1px 3px rgba(0,0,0,.04),0 6px 24px rgba(0,0,0,.05);padding:22px;animation:tabIn .22s ease;margin-bottom:16px}
        .af-title-card{background:#fff;padding:20px 22px;border-radius:18px;border:1px solid rgba(0,0,0,.07);box-shadow:0 1px 3px rgba(0,0,0,.04),0 6px 24px rgba(0,0,0,.05);margin-bottom:14px}
        .af-bullet{display:flex;align-items:flex-start;gap:10px;padding:10px 13px;border-radius:10px;margin-bottom:6px;font-size:13.5px;font-weight:500;line-height:1.55}
        .af-step{display:flex;gap:14px;align-items:flex-start;padding:13px 0;border-bottom:1px solid #f4f4f0}
        .af-step:last-child{border-bottom:none}
        .af-step-num{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;flex-shrink:0;color:#fff}
        .af-tech-row{display:flex;border-radius:10px;overflow:hidden;border:1px solid #f0ede8;margin-bottom:8px}
        .af-tech-label{background:#f8f7f4;padding:10px 14px;font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.09em;display:flex;align-items:center;min-width:118px;flex-shrink:0}
        .af-tech-val{padding:10px 14px;font-size:13.5px;color:#374151;line-height:1.5;border-left:1px solid #f0ede8}
        .af-dose-table{width:100%;border-collapse:collapse;font-size:13px}
        .af-dose-table th{background:#f0fdf4;color:#166534;font-weight:800;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:9px 14px;text-align:left}
        .af-dose-table td{padding:10px 14px;border-top:1px solid #f1f5f9;color:#374151}
        .af-dose-table tr:hover td{background:#fafaf8}
        .af-vs-table{width:100%;border-collapse:collapse;font-size:12.5px}
        .af-vs-table th{padding:10px 14px;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;text-align:left}
        .af-vs-table td{padding:10px 14px;border-top:1px solid #f1f5f9;vertical-align:top;line-height:1.5}
        .af-faq-item{border-bottom:1px solid #f4f4f0}.af-faq-item:last-child{border-bottom:none}
        .af-faq-btn{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;background:none;border:none;cursor:pointer;font-family:var(--font-dm-sans),sans-serif;text-align:left;font-size:13.5px;font-weight:600;color:#1e293b;transition:color .15s}
        .af-faq-btn:hover{color:#16a34a}
        .af-faq-icon{width:24px;height:24px;border-radius:50%;flex-shrink:0;background:#f0fdf4;border:1.5px solid #d1fae5;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#16a34a;transition:transform .25s,background .2s}
        .af-faq-icon.open{transform:rotate(45deg);background:#16a34a;color:#fff;border-color:#16a34a}
        .af-faq-ans{font-size:13.5px;color:#4b5563;line-height:1.85;padding:0 0 14px 14px;border-left:3px solid #16a34a;overflow:hidden}
        .af-rel{display:flex;align-items:center;gap:11px;padding:10px 12px;border:1.5px solid #ede9e1;border-radius:12px;background:#fafaf8;text-decoration:none;transition:all .2s}
        .af-rel:hover{border-color:var(--rc,#16a34a);background:#fff;transform:translateX(3px);box-shadow:0 3px 12px rgba(0,0,0,.06)}
        .af-yt-wrap{position:relative;padding-bottom:56.25%;height:0;border-radius:0 0 18px 18px;overflow:hidden}
        .af-yt-wrap iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:none}
        .af-final-cta{border-radius:18px;padding:26px 24px;text-align:center;margin-bottom:0}
        .af-mob-sticky{display:none;position:fixed;bottom:0;left:0;right:0;z-index:98;padding:10px 14px calc(env(safe-area-inset-bottom,0px) + 14px);background:linear-gradient(to top,rgba(250,249,246,.98) 70%,transparent);backdrop-filter:blur(10px)}
        .af-beginner{background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:1.5px solid #a7f3d0;border-radius:13px;padding:16px 18px;margin-bottom:14px}
        .af-beginner-title{font-size:10px;font-weight:800;color:#065f46;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px}
        .af-beginner-text{font-size:13.5px;color:#374151;line-height:1.75}
        .af-lightbox{max-width:90vw;max-height:90vh;border:none;border-radius:18px;padding:16px;background:#0a0a0a;box-shadow:0 24px 80px rgba(0,0,0,.7);animation:fadeIn .2s ease;position:relative}
        .af-lightbox::backdrop{background:rgba(0,0,0,.85);animation:fadeIn .2s ease}
        .af-lightbox-img{max-width:calc(90vw - 32px);max-height:calc(90vh - 60px);object-fit:contain;display:block;border-radius:10px;margin:0 auto}
        .af-lightbox-close{position:absolute;top:10px;right:12px;background:rgba(255,255,255,.12);border:none;color:#fff;font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;font-family:inherit}
        .af-lightbox-close:hover{background:rgba(255,255,255,.25)}
        .af-lightbox-nav{position:absolute;bottom:-42px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:16px;color:#fff;font-size:12px;font-weight:700}
        .af-lightbox-nav button{background:rgba(255,255,255,.12);border:none;color:#fff;font-size:20px;width:34px;height:34px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;font-family:inherit;line-height:1}
        .af-lightbox-nav button:hover{background:rgba(255,255,255,.25)}
        .af-thumb-strip{display:flex;gap:8px;margin-top:10px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
        .af-thumb-strip::-webkit-scrollbar{display:none}
        .af-thumb{flex-shrink:0;width:52px;height:52px;border-radius:9px;padding:0;overflow:hidden;background:#fff;border:2px solid #e5e7eb;cursor:pointer;transition:border-color .15s,transform .15s}
        .af-thumb:hover{border-color:var(--tc,#16a34a);transform:translateY(-1px)}
        .af-thumb.active{border-color:var(--tc,#16a34a);box-shadow:0 0 0 2px var(--tc,#16a34a)22}
        .af-thumb img{width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply;display:block}
        .af-related-mobile{display:none}
        .af-pill-season-full{}
        @media(max-width:820px){
          .af-page-root{overflow-x:hidden!important;max-width:100vw!important;width:100%!important}
          .af-grid{grid-template-columns:minmax(0,1fr)!important;gap:10px!important;padding:10px 12px 100px!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important}
          .af-left{position:static!important;gap:10px;width:100%;min-width:0;box-sizing:border-box}
          .af-right{gap:10px;width:100%;min-width:0;box-sizing:border-box}
          .af-card{width:100%!important;min-width:0!important;box-sizing:border-box!important}
          .site-header{padding:0 12px;height:52px}
          .logo-name{font-size:14px}
          .logo-sub{font-size:8px;letter-spacing:.06em}
          .header-nav{display:none}
          .mob-btn{display:flex}
          .cart-btn{font-size:11px;padding:5px 10px;border-radius:8px;gap:3px}
          .af-hero-inner{padding:0 12px 10px;gap:8px;flex-wrap:nowrap}
          .af-bc{font-size:11px;gap:4px;min-width:0;flex:1;overflow:hidden}
          .af-bc strong{max-width:110px;font-size:11px}
          .af-cat-badge{font-size:9px;padding:3px 9px;max-width:130px}
          .af-card{border-radius:14px}
          .af-card-p{padding:14px 15px}
          .af-card-sm{padding:12px 14px}
          .af-title-card{padding:14px 15px;border-radius:14px;margin-bottom:0}
          .af-tab-panel{padding:14px 15px;border-radius:0 0 14px 14px}
          .af-tabs-bar{border-radius:12px 12px 0 0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:0;margin-top:10px}
          .af-tabs-bar::-webkit-scrollbar{display:none}
          .af-tab{flex:0 0 auto;min-width:76px;padding:10px 9px;font-size:11px;gap:3px}
          .af-tab-icon{font-size:12px}
          .af-tab-badge{font-size:8px;padding:1px 4px}
          .af-stat-pills{grid-template-columns:repeat(2,1fr)!important}
          .af-pill-season-full{grid-column:1/-1}
          .af-tech-row{flex-direction:column}
          .af-tech-label{min-width:unset;width:100%;padding:6px 12px 3px;font-size:8.5px;border-radius:0}
          .af-tech-val{border-left:none;border-top:1px solid #f0ede8;padding:7px 12px 9px;font-size:13px;word-break:break-word;overflow-wrap:anywhere}
          .af-dose-table{font-size:12.5px}
          .af-vs-table th,.af-vs-table td{padding:8px 10px;font-size:11.5px}
          .af-step{gap:10px;padding:10px 0}
          .af-step-num{width:26px;height:26px;font-size:11px}
          .af-bullet{padding:9px 11px;font-size:13px}
          .af-faq-btn{font-size:13px}
          .af-faq-ans{font-size:13px;padding:0 0 12px 12px}
          .af-rel{padding:9px 10px}
          .af-mob-sticky{display:block}
          #af-buy-card{display:none}
          .af-final-cta{padding:20px 15px;border-radius:14px}
          .af-trust-b{font-size:9.5px;padding:3px 7px}
          .af-trust-row{gap:4px}
          .af-beginner{padding:13px 14px}
          .af-beginner-text{font-size:13px}
          .af-btn-buy{font-size:14.5px;padding:14px 16px;border-radius:12px}
          .af-related-mobile{display:block}
          .af-lightbox{max-width:97vw;max-height:95vh;padding:12px}
          .af-lightbox-img{max-width:calc(97vw - 24px);max-height:calc(95vh - 52px)}
        }
        @media(max-width:480px){
          .af-grid{padding:8px 10px 100px;gap:8px}
          .af-card-p{padding:13px}
          .af-tab-panel{padding:13px}
          .af-title-card{padding:13px}
          .af-tab{min-width:68px;padding:9px 7px;font-size:10.5px}
          .af-dose-table thead{display:none}
          .af-dose-table tr{display:block;border:1px solid #f1f5f9;border-radius:10px;margin-bottom:8px;padding:10px}
          .af-dose-table td{display:block;border:none;padding:3px 0;font-size:12.5px}
          .af-dose-table td:before{content:attr(data-label);font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:2px}
          .af-vs-table{font-size:10.5px}
          .af-vs-table th,.af-vs-table td{padding:7px 8px}
          .site-header{height:48px}
          .logo-name{font-size:13px}
          .cart-btn{font-size:10.5px;padding:5px 8px}
          .mob-btn{width:34px;height:34px;font-size:17px}
        }
        @media print{.af-mob-sticky{display:none!important}.af-grid{grid-template-columns:1fr}.af-left{position:static}}
      `}</style>

      {/* Progress bar */}
      <div aria-hidden style={{ position:'fixed',top:0,left:0,height:3,zIndex:200,width:`${scrollPct}%`,background:`linear-gradient(90deg,${color},#4ade80)`,transition:'width .1s linear' }} />

      {/* ✅ #5 Lightbox dialog — с навигация ако има повече от 1 снимка */}
      {current && (
        <dialog ref={dialogRef} className="af-lightbox"
          onClick={e => { if (e.target === dialogRef.current) setLightbox(false) }}
          onKeyDown={e => {
            if (e.key === 'Escape') setLightbox(false)
            if (e.key === 'ArrowRight') setActiveIdx(i => (i + 1) % gallery.length)
            if (e.key === 'ArrowLeft')  setActiveIdx(i => (i - 1 + gallery.length) % gallery.length)
          }}>
          <button className="af-lightbox-close" onClick={() => setLightbox(false)} aria-label="Затвори">✕</button>
          <img className="af-lightbox-img" src={current.url} alt={current.alt}
            onError={() => markBroken(current.url)} />
          {gallery.length > 1 && (
            <div className="af-lightbox-nav">
              <button aria-label="Предишна снимка" onClick={() => setActiveIdx(i => (i - 1 + gallery.length) % gallery.length)}>‹</button>
              <span>{currentIdx + 1} / {gallery.length}</span>
              <button aria-label="Следваща снимка" onClick={() => setActiveIdx(i => (i + 1) % gallery.length)}>›</button>
            </div>
          )}
        </dialog>
      )}

      {/* Header */}
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <a href="/" className="header-logo">
          <span style={{ fontSize:24 }}>🍅</span>
          <div><div className="logo-name">Denny Angelow</div><div className="logo-sub">Агро Консултант</div></div>
        </a>
        <nav className="header-nav">
          <a href="/#produkti" className="nav-link">Продукти</a>
          <a href="/#atlas" className="nav-link">Atlas Terra</a>
          <a href="/#ginegar" className="nav-link">Ginegar</a>
          <a href="/#testimonials" className="nav-link">Отзиви</a>
          <a href="/#faq" className="nav-link">Въпроси</a>
        </nav>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <a href="/#produkti" className="cart-btn">← Всички продукти</a>
          <button className="mob-btn" onClick={() => setMobMenu(v => !v)} aria-label="Меню" aria-expanded={mobMenu}>
            {mobMenu ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {mobMenu && (
        <div className="mob-nav">
          {([['/#produkti','Продукти'],['/#atlas','Atlas Terra'],['/#testimonials','Отзиви'],['/#faq','Въпроси']] as [string,string][]).map(([h,l]) => (
            <a key={h} href={h} className="mob-nav-link" onClick={() => setMobMenu(false)}>{l}</a>
          ))}
          <a href="/#produkti" className="mob-nav-link" style={{ color:'#16a34a', fontWeight:800 }} onClick={() => setMobMenu(false)}>← Всички продукти</a>
        </div>
      )}

      {/* Hero band */}
      <div className="af-hero-band">
        <div className="af-hero-inner">
          <nav className="af-bc" aria-label="Навигация до страницата">
            <a href="/">Начало</a><span className="af-bc-sep">›</span>
            <a href="/#produkti">Продукти</a><span className="af-bc-sep">›</span>
            <strong title={product.name}>{product.name}</strong>
          </nav>
          <span className="af-cat-badge"
            style={{ color, background:`${color}15`, border:`1.5px solid ${color}30`, display: product.category_label ? undefined : 'none' }}>
            {product.emoji} {product.category_label}
          </span>
        </div>
      </div>

      {/* Main grid */}
      <div className="af-grid" style={{ boxSizing:'border-box', width:'100%' }}>

        {/* ── LEFT ── */}
        <div className="af-left">

          {/* Image card */}
          <div className="af-card" style={{ padding:18, background:'linear-gradient(145deg,#fafaf8 0%,#fff 100%)' }}>
            <div style={{ position:'relative' }}>
              {product.badge_text && (
                <div style={{ position:'absolute',top:8,left:8,zIndex:2,background:color,color:'#fff',fontSize:9,fontWeight:800,letterSpacing:'.08em',textTransform:'uppercase',padding:'4px 10px',borderRadius:20,boxShadow:`0 3px 12px ${color}55` }}>
                  ✨ {product.badge_text}
                </div>
              )}
              {product.tag_text && (
                <div style={{ position:'absolute',top:8,right:8,zIndex:2,background:'rgba(10,10,10,.55)',backdropFilter:'blur(6px)',color:'#fff',fontSize:9,fontWeight:700,padding:'4px 9px',borderRadius:20 }}>
                  {product.tag_text}
                </div>
              )}
              {/* ✅ #5 Zoom hint */}
              {current && (
                <div aria-hidden style={{ position:'absolute',bottom:8,right:8,zIndex:2,background:'rgba(0,0,0,.42)',color:'#fff',fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:20,backdropFilter:'blur(4px)',pointerEvents:'none' }}>
                  🔍 Увеличи
                </div>
              )}
              {current ? (
                <img
                  key={current.url}
                  src={current.url}
                  alt={current.alt}
                  onError={() => markBroken(current.url)}
                  loading="eager"
                  width={300} height={300}
                  onClick={() => setLightbox(true)}
                  style={{ width:'100%',maxHeight:300,objectFit:'contain',borderRadius:12,display:'block',mixBlendMode:'multiply',cursor:'zoom-in' }}
                />
              ) : (
                <div style={{ height:240,borderRadius:12,fontSize:72,background:`linear-gradient(135deg,${color}18,${color}08)`,border:`2px dashed ${color}30`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  {product.emoji || '🌿'}
                </div>
              )}
            </div>

            {/* Thumbnail strip — само ако има повече от 1 снимка */}
            {gallery.length > 1 && (
              <div className="af-thumb-strip" role="tablist" aria-label="Снимки на продукта">
                {gallery.map((img, i) => (
                  <button
                    key={img.url}
                    type="button"
                    role="tab"
                    aria-selected={i === currentIdx}
                    aria-label={img.alt}
                    onClick={() => setActiveIdx(i)}
                    className={`af-thumb${i === currentIdx ? ' active' : ''}`}
                    style={{ '--tc': color } as React.CSSProperties}
                  >
                    <img src={img.url} alt="" loading="lazy" width={52} height={52} />
                  </button>
                ))}
              </div>
            )}

            {/* Stat pills */}
            {(product.volume || product.quarantine_days !== undefined || product.season) && (() => {
              const count = [product.volume, product.quarantine_days !== undefined, product.season].filter(Boolean).length
              return (
                <div className="af-stat-pills" style={{ display:'grid', gridTemplateColumns:`repeat(${count},1fr)`, gap:7, marginTop:12 }}>
                  {product.volume && (
                    <div style={{ background:'#f8f7f4',border:'1px solid #ede9e1',borderRadius:9,padding:'8px',textAlign:'center' }}>
                      <div style={{ fontSize:8,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:3 }}>ОБЕМ</div>
                      <div style={{ fontSize:13,fontWeight:800,color:'#0f172a' }}>{product.volume}</div>
                    </div>
                  )}
                  {product.quarantine_days !== undefined && (
                    <div style={{ background:product.quarantine_days===0?'#f0fdf4':'#fff7ed',border:`1px solid ${product.quarantine_days===0?'#bbf7d0':'#fed7aa'}`,borderRadius:9,padding:'8px',textAlign:'center' }}>
                      <div style={{ fontSize:8,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:3 }}>КАРАНТИНА</div>
                      <div style={{ fontSize:11,fontWeight:800,color:product.quarantine_days===0?'#166534':'#9a3412',lineHeight:1.3 }}>
                        {product.quarantine_days === 0 ? '0 дни ✓' : product.quarantine_note || `${product.quarantine_days} дни`}
                      </div>
                    </div>
                  )}
                  {product.season && (
                    <div className={count === 3 ? 'af-pill-season-full' : ''} style={{ background:'#f8f7f4',border:'1px solid #ede9e1',borderRadius:9,padding:'8px',textAlign:'center' }}>
                      <div style={{ fontSize:8,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:3 }}>СЕЗОН</div>
                      <div style={{ fontSize:10,fontWeight:700,color:'#0f172a',lineHeight:1.3 }}>{product.season}</div>
                    </div>
                  )}
                </div>
              )
            })()}

            {diff && (
              <div style={{ marginTop:10,padding:'7px 12px',borderRadius:9,background:diff.bg,border:`1px solid ${diff.border}`,fontSize:11,fontWeight:700,color:diff.color,display:'flex',alignItems:'center',gap:6 }}>
                {diff.icon} {diff.label}
              </div>
            )}
            <div className="af-trust-row" style={{ marginTop:10 }}>
              {['✅ Оригинален','🚚 Бързо','🔒 Сигурно'].map(b => <span key={b} className="af-trust-b">{b}</span>)}
            </div>
          </div>

          {/* Buy card */}
          <div className="af-card af-card-p" id="af-buy-card">
            {/* ✅ #8 Брой оценки с икона */}
            <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:12 }}>
              <Stars rating={avgRating} size={14} />
              <span style={{ fontSize:12.5,fontWeight:700,color:'#374151' }}>{avgRating.toFixed(1)}/5</span>
              <span style={{ fontSize:11.5,color:'#94a3b8' }}>👥 {reviewCount.toLocaleString('bg-BG')} отзива</span>
            </div>

            {product.price && (
              <div style={{ marginBottom:4 }}>
                <div style={{ display:'flex',alignItems:'baseline',gap:6 }}>
                  <span style={{ fontFamily:"var(--font-cormorant),serif",fontSize:38,fontWeight:700,color:'#0a0a0a',letterSpacing:'-.03em',lineHeight:1 }}>
                    {Number(product.price).toFixed(2)}
                  </span>
                  <span style={{ fontSize:16,fontWeight:700,color:'#374151' }}>{product.price_currency || 'EUR'}</span>
                  {product.volume && <span style={{ fontSize:12.5,color:'#94a3b8' }}>/ {product.volume}</span>}
                </div>
                <p style={{ fontSize:10.5,color:'#94a3b8',marginTop:3 }}>Ориентировъчна цена при партньора</p>
              </div>
            )}

            {product.quarantine_days === 0 && (
              <div style={{ background:'linear-gradient(90deg,#f0fdf4,#ecfdf5)',border:'1.5px solid #a7f3d0',borderRadius:10,padding:'10px 13px',marginBottom:12,marginTop:12,display:'flex',alignItems:'center',gap:9 }}>
                <div style={{ width:32,height:32,borderRadius:'50%',flexShrink:0,background:'#16a34a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15 }}>✅</div>
                <div>
                  <div style={{ fontSize:10,fontWeight:800,color:'#166534',letterSpacing:'.05em' }}>0 ДНИ КАРАНТИНА</div>
                  <div style={{ fontSize:11.5,color:'#4b5563',marginTop:1,lineHeight:1.4 }}>Пръскаш днес — береш утре.</div>
                </div>
              </div>
            )}
            {product.quarantine_days !== undefined && product.quarantine_days > 0 && (
              <div style={{ background:'#fff7ed',border:'1.5px solid #fed7aa',borderRadius:10,padding:'10px 13px',marginBottom:12,marginTop:12,display:'flex',alignItems:'center',gap:9 }}>
                <span style={{ fontSize:20,flexShrink:0 }}>⏱</span>
                <div>
                  <div style={{ fontSize:10,fontWeight:800,color:'#92400e',letterSpacing:'.05em' }}>КАРАНТИНЕН СРОК</div>
                  <div style={{ fontSize:11.5,color:'#78350f',marginTop:1,lineHeight:1.4 }}>{product.quarantine_note || `${product.quarantine_days} дни след пръскане`}</div>
                </div>
              </div>
            )}

            {/* ✅ #3 Pulse бутон */}
            <button
              onClick={handleBuy}
              className={`af-btn-buy${pulse ? ' af-btn-pulse' : ''}`}
              style={{
                '--pc': `${color}55`,
                background: bought ? 'linear-gradient(135deg,#16a34a,#15803d)' : `linear-gradient(135deg,${color},${color}dd)`,
                boxShadow: bought ? '0 8px 28px rgba(22,163,74,.4)' : `0 8px 28px ${color}44`,
                marginBottom: 8,
              } as React.CSSProperties}
              aria-label={`Виж ${product.name} в agroapteki.com`}
            >
              {bought ? '✓ Пренасочваме те…' : <><span>🛒</span> Виж в AgroApteki <span style={{opacity:.7}}>→</span></>}
            </button>
            <p style={{ fontSize:10.5,color:'#9ca3af',textAlign:'center',marginBottom:12 }}>Ще те пренасочим към agroapteki.com — сигурна поръчка</p>
            <div className="af-trust-row">
              {['💵 Наложен платеж','🚚 Еконт / Спиди','📞 Консултация'].map(t => <span key={t} className="af-trust-b">{t}</span>)}
            </div>
          </div>

          {/* Author card */}
          <div className="af-card af-card-sm" style={{ background:'linear-gradient(135deg,#f0fdf4 0%,#fff 100%)',border:'1px solid #d1fae5' }}>
            <div style={{ display:'flex',alignItems:'center',gap:11 }}>
              <div style={{ width:42,height:42,borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,#052e16,#16a34a)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,border:'2px solid rgba(22,163,74,.25)' }}>🌱</div>
              <div>
                <div style={{ fontFamily:"var(--font-cormorant),serif",fontWeight:700,fontSize:16,color:'#0f172a',lineHeight:1 }}>Denny Angelow</div>
                <div style={{ fontSize:9,color:'#16a34a',fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em',marginTop:3 }}>Агро Консултант</div>
              </div>
              <div style={{ marginLeft:'auto',textAlign:'right' }}>
                <Stars rating={avgRating} size={11} />
                <div style={{ fontSize:9.5,color:'#64748b',marginTop:2 }}>{avgRating.toFixed(1)}/5 · {reviewCount}</div>
              </div>
            </div>
            <p style={{ fontSize:12,color:'#4b5563',lineHeight:1.6,marginTop:9 }}>
              Лично проверен — препоръчван на <strong style={{color:'#166534'}}>85K+ последователи</strong> и 800+ стопанства.
            </p>
          </div>

          {/* ✅ #6 Related — само на DESKTOP (скрита на мобилно чрез CSS) */}
          {related.length > 0 && (
            <div className="af-card af-card-sm" style={{ display:'block' }}
              // скрита на mobile чрез .af-related-mobile логика в @media — тук просто "block" на desktop
            >
              <p className="af-sec">🔗 Комбинирай с</p>
              <RelatedBlock />
            </div>
          )}
        </div>

        {/* ── RIGHT ── */}
        <div className="af-right">

          {/* Title card */}
          <div className="af-title-card">
            <h1 style={{ fontFamily:"var(--font-cormorant),serif",fontSize:'clamp(26px,3.5vw,40px)',fontWeight:700,color:'#0a0a0a',lineHeight:1.1,letterSpacing:'-.02em',marginBottom:product.subtitle?7:0 }}>
              {product.name}
            </h1>
            {product.subtitle && (
              <p style={{ fontSize:14.5,color:'#64748b',lineHeight:1.55,marginBottom:12 }}>{product.subtitle}</p>
            )}
            {/* ✅ #8 Рейтинг с икона */}
            <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
              <Stars rating={avgRating} size={13} />
              <span style={{ fontSize:12.5,fontWeight:700,color:'#374151' }}>{avgRating.toFixed(1)}/5</span>
              <span style={{ fontSize:12,color:'#94a3b8' }}>👥 {reviewCount.toLocaleString('bg-BG')} верифицирани отзива</span>
              {product.social_proof && (
                <span style={{ fontSize:12,color:'#64748b',fontStyle:'italic' }}>· {product.social_proof}</span>
              )}
            </div>
            {/* ✅ #4 Последно обновено */}
            {lastUpdated && (
              <div style={{ marginTop:8,fontSize:10.5,color:'#b0b8c1',display:'flex',alignItems:'center',gap:4 }}>
                🕐 Последно обновено: <span style={{ fontWeight:600,color:'#94a3b8' }}>{lastUpdated}</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          {tabs.length > 0 && (
            <>
              {/* ✅ #1 Tab badge с брой */}
              <div className="af-tabs-bar" role="tablist">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`tabpanel-${tab.id}`}
                    id={`tab-${tab.id}`}
                    className={`af-tab${activeTab === tab.id ? ' active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="af-tab-icon">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.count !== null && tab.count > 0 && (
                      <span className="af-tab-badge">{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* ✅ SEO ФИКС: всеки таб вече се рендерира ВИНАГИ в DOM-а (не само активният).
                  Google рендерира JS, но не кликва по табове — ако съдържанието не е монтирано,
                  то на практика не съществува за търсачката, дори да има Product/FAQ schema.
                  Вместо {`{activeTab === 'x' && (...)}`} (условно МОНТИРАНЕ), сега всеки панел
                  е отделен <div> с hidden={`{activeTab !== 'x'}`} — HTML/CSS показване/скриване,
                  съдържанието остава в DOM-а през цялото време. Google официално третира
                  таб/акордеон съдържание скрито по този начин наравно с видимото. */}

                {/* За продукта */}
                {hasAbout && (
                  <div className="af-tab-panel" role="tabpanel" id="tabpanel-about" aria-labelledby="tab-about" hidden={activeTab !== 'about'}>
                    {product.description && (
                      <div className="af-beginner">
                        <div className="af-beginner-title">🌱 Накратко — за какво служи</div>
                        <p className="af-beginner-text">{product.description}</p>
                      </div>
                    )}
                    {bullets.length > 0 && (
                      <div style={{ marginBottom: product.full_content ? 16 : 0 }}>
                        <h2 className="af-h2-seo">Основни предимства на {product.name}</h2>
                        {bullets.map((b, i) => (
                          <div key={i} className="af-bullet" style={{ background:`linear-gradient(135deg,${color}0a,transparent)`, border:`1px solid ${color}1e`, color:'#1a2e1a' }}>
                            <span style={{ color, fontWeight:800, flexShrink:0, marginTop:1, fontSize:13 }}>✓</span>{b}
                          </div>
                        ))}
                      </div>
                    )}
                    {product.full_content && (
                      <div style={{ marginTop: bullets.length > 0 ? 4 : 0 }}>
                        <h2 className="af-h2-seo">Подробно описание на {product.name}</h2>
                        {renderFullContent(product.full_content, color)}
                      </div>
                    )}
                    {warnings.length > 0 && (
                      <div style={{ background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:13,padding:'15px 18px',marginTop:14 }}>
                        <h2 className="af-h2-seo" style={{ color:'#92400e' }}>Важни предупреждения</h2>
                        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                          {warnings.map((w, i) => (
                            <div key={i} style={{ display:'flex',gap:7,alignItems:'flex-start',fontSize:13.5,color:'#78350f',lineHeight:1.6 }}>
                              <span style={{ flexShrink:0 }}>⚠</span>{w}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {product.vs_competitor && (
                      <div style={{ marginTop:14 }}>
                        <h2 className="af-h2-seo">{product.name} срещу {product.vs_competitor.competitor}</h2>
                        <div style={{ overflowX:'auto',borderRadius:12,border:'1px solid #f1f5f9' }}>
                          <table className="af-vs-table">
                            <thead><tr>
                              <th style={{ background:'#f8f7f4',color:'#64748b' }}>Характеристика</th>
                              <th style={{ background:`${color}12`,color }}>{product.name} ✓</th>
                              <th style={{ background:'#fef2f2',color:'#dc2626' }}>{product.vs_competitor.competitor}</th>
                            </tr></thead>
                            <tbody>
                              {product.vs_competitor.vs.map((row, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight:600,color:'#374151' }}>{row.feature}</td>
                                  <td style={{ color:'#166534',fontWeight:600 }}>✓ {row.ours}</td>
                                  <td style={{ color:'#dc2626' }}>✗ {row.theirs}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Приложение */}
                {hasHowto && (
                  <div className="af-tab-panel" role="tabpanel" id="tabpanel-howto" aria-labelledby="tab-howto" hidden={activeTab !== 'howto'}>
                    {/* ✅ НОВО: обучително въведение — защо фазата и начинът на приложение имат значение */}
                    <div className="af-beginner" style={{ marginBottom:18 }}>
                      <div className="af-beginner-title">🎯 Защо фазата и начинът на приложение имат значение</div>
                      <p className="af-beginner-text">
                        {applicationIntro || `Хранителните елементи в ${product.name} се усвояват различно според фазата на развитие на растението. Листното пръскане действа бързо и е подходящо при първите признаци на дефицит или за профилактика през критични фази. Почвеното/капково внасяне изгражда траен резерв в корена за целия сезон и е по-подходящо при системно програмно торене.`}
                      </p>
                    </div>

                    {/* ✅ НОВО: легенда за начин на приложение */}
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11.5, fontWeight:700, color:'#166534', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:20, padding:'5px 12px' }}>
                        🌿 Листно пръскане — бърз ефект
                      </span>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11.5, fontWeight:700, color:'#075985', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:20, padding:'5px 12px' }}>
                        💧 Почвено / капково — траен резерв
                      </span>
                    </div>

                    {howToSteps.length > 0 && (
                      <>
                        <h2 className="af-h2-seo">Как да използваш {product.name} — стъпки</h2>
                        {howToSteps.map((step, i) => (
                          <div key={i} className="af-step">
                            <div className="af-step-num" style={{ background:`linear-gradient(135deg,${color},${color}bb)`, boxShadow:`0 3px 10px ${color}44` }}>{i + 1}</div>
                            <p style={{ fontSize:14,color:'#374151',lineHeight:1.75,margin:0,paddingTop:4 }}>{step}</p>
                          </div>
                        ))}
                      </>
                    )}

                    {doseTable.length > 0 && (
                      <div style={{ marginTop: howToSteps.length > 0 ? 22 : 0 }}>
                        <h2 className="af-h2-seo">Дозировка на {product.name} по култури и фази</h2>
                        <p className="af-sec">📊 Норми на приложение</p>

                        {/* ✅ Разширен изглед — карти по култура/фаза, когато данните го поддържат */}
                        {doseTable.some(r => r.crop || r.stage || r.method) ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                            {doseTable.map((row, i) => {
                              const m = methodLabel(row.method)
                              return (
                                <div key={i} style={{ border:'1px solid #f1f5f9', borderRadius:12, padding:'14px 16px', background:'#fafaf8' }}>
                                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                                    <span style={{ fontWeight:700, fontSize:13.5, color:'#1e293b' }}>{row.crop || row.phase}</span>
                                    {m && (
                                      <span style={{
                                        fontSize:11, fontWeight:800, whiteSpace:'nowrap', borderRadius:20, padding:'3px 10px',
                                        color: m.tone === 'foliar' ? '#166534' : '#075985',
                                        background: m.tone === 'foliar' ? '#f0fdf4' : '#eff6ff',
                                        border: `1px solid ${m.tone === 'foliar' ? '#bbf7d0' : '#bfdbfe'}`,
                                      }}>
                                        {m.icon} {m.label}
                                      </span>
                                    )}
                                  </div>
                                  {row.stage && (
                                    <div style={{ fontSize:12.5, color:'#64748b', marginBottom:8 }}>📅 Фаза: {row.stage}</div>
                                  )}
                                  <div style={{ display:'flex', gap:20, flexWrap:'wrap', fontSize:13 }}>
                                    <div><span style={{ color:'#94a3b8', fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em' }}>Доза </span><strong style={{ color }}>{row.dose}</strong></div>
                                    <div><span style={{ color:'#94a3b8', fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em' }}>Интервал </span><span style={{ color:'#4b5563' }}>{row.interval}</span></div>
                                  </div>
                                  {row.purpose && (
                                    <div style={{ fontSize:12.5, color:'#374151', marginTop:9, lineHeight:1.6, paddingTop:9, borderTop:'1px dashed #e2e8f0' }}>💡 {row.purpose}</div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div style={{ overflowX:'auto',borderRadius:12,border:'1px solid #f1f5f9' }}>
                            <table className="af-dose-table">
                              <thead><tr>
                                <th>Култура / Неприятел</th><th>Доза</th><th>Интервал</th>
                              </tr></thead>
                              <tbody>
                                {doseTable.map((row, i) => (
                                  <tr key={i}>
                                    <td data-label="Употреба" style={{ fontWeight:600 }}>{row.phase}</td>
                                    <td data-label="Доза" style={{ color, fontWeight:700 }}>{row.dose}</td>
                                    <td data-label="Интервал" style={{ color:'#64748b' }}>{row.interval}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <p style={{ fontSize:11,color:'#94a3b8',marginTop:8 }}>* При съмнение се консултирайте с агроном.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Технически */}
                {hasTech && (
                  <div className="af-tab-panel" role="tabpanel" id="tabpanel-tech" aria-labelledby="tab-tech" hidden={activeTab !== 'tech'}>
                    <h2 className="af-h2-seo">Технически характеристики на {product.name}</h2>

                    {/* ✅ НОВО: пълен състав (Елемент / Съдържание) — вместо суров markdown */}
                    {composition.length > 0 && (
                      <div style={{ marginBottom:18 }}>
                        <p className="af-sec">🧪 Пълен състав</p>
                        <div style={{ overflowX:'auto',borderRadius:12,border:'1px solid #f1f5f9' }}>
                          <table className="af-dose-table">
                            <thead><tr><th>Елемент</th><th>Съдържание</th></tr></thead>
                            <tbody>
                              {composition.map((c, i) => (
                                <tr key={i}>
                                  <td data-label="Елемент" style={{ fontWeight:600 }}>{c.element}</td>
                                  <td data-label="Съдържание" style={{ color, fontWeight:700 }}>{c.content}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {product.active_substance && (
                      <div className="af-tech-row"><div className="af-tech-label">Активно вещество</div><div className="af-tech-val">{product.active_substance}</div></div>
                    )}
                    {product.dosage && (
                      <div className="af-tech-row"><div className="af-tech-label">Дозировка</div><div className="af-tech-val">{product.dosage}</div></div>
                    )}
                    {ph && (
                      <div className="af-tech-row"><div className="af-tech-label">pH</div><div className="af-tech-val">{ph}</div></div>
                    )}
                    {density && (
                      <div className="af-tech-row"><div className="af-tech-label">Плътност</div><div className="af-tech-val">{density}</div></div>
                    )}
                    {product.quarantine_days !== undefined && (
                      <div className="af-tech-row">
                        <div className="af-tech-label">Карантина</div>
                        <div className="af-tech-val" style={{ color: product.quarantine_days===0?'#166534':'#9a3412', fontWeight:700 }}>
                          {product.quarantine_days === 0 ? '✓ 0 дни — бери на следващия ден' : product.quarantine_note || `${product.quarantine_days} дни`}
                        </div>
                      </div>
                    )}
                    {product.volume && (
                      <div className="af-tech-row"><div className="af-tech-label">Опаковка</div><div className="af-tech-val">{product.volume}</div></div>
                    )}
                    {product.season && (
                      <div className="af-tech-row"><div className="af-tech-label">Сезон</div><div className="af-tech-val">{product.season}</div></div>
                    )}
                    {crops.length > 0 && (
                      <div className="af-tech-row" style={{ alignItems:'flex-start' }}>
                        <div className="af-tech-label" style={{ alignSelf:'stretch' }}>Подходящ за</div>
                        <div className="af-tech-val" style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                          {crops.map(crop => (
                            <span key={crop} style={{ fontSize:12,fontWeight:700,color:'#166534',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:20,padding:'3px 10px' }}>🌱 {crop}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* ✅ НОВО: механизъм на действие — обучителни bullet точки */}
                    {modeOfAction.length > 0 && (
                      <div style={{ marginTop:14 }}>
                        <p className="af-sec">⚙️ Механизъм на действие</p>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {modeOfAction.map((m, i) => (
                            <div key={i} style={{ display:'flex', gap:7, alignItems:'flex-start', fontSize:13.5, color:'#374151', lineHeight:1.65 }}>
                              <span style={{ color, fontWeight:800, flexShrink:0, marginTop:1 }}>✓</span>{m}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ✅ НОВО: съхранение */}
                    {storageInfo && (
                      <div style={{ marginTop:12,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 14px',fontSize:12.5,color:'#374151',lineHeight:1.7 }}>
                        📦 <strong>Съхранение:</strong> {storageInfo}
                      </div>
                    )}

                    {product.quarantine_days !== undefined && product.quarantine_days > 0 && (
                      <div style={{ marginTop:12,background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'12px 14px',fontSize:12.5,color:'#78350f',lineHeight:1.7 }}>
                        💡 <strong>Какво означава карантина?</strong> Броят дни след последното пръскане, след които е безопасно да берете. Ако карантината е {product.quarantine_days} дни и пръскате на 1-ви, берете най-рано на {product.quarantine_days + 1}-ви.
                      </div>
                    )}
                  </div>
                )}

                {/* Въпроси */}
                {hasFaq && (
                  <div className="af-tab-panel" role="tabpanel" id="tabpanel-faq" aria-labelledby="tab-faq" hidden={activeTab !== 'faq'}>
                    <h2 className="af-h2-seo">Често задавани въпроси за {product.name}</h2>
                    {faqItems.map(({ q, a }, i) => (
                      <div key={i} className="af-faq-item">
                        <button className="af-faq-btn" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                          <span>{q}</span>
                          <span className={`af-faq-icon${openFaq === i ? ' open' : ''}`}>+</span>
                        </button>
                        {/* ✅ ФИКС: отговорът вече ВИНАГИ е в DOM-а — скрит с CSS (display:none),
                            не условно монтиран. Отговаря на FAQPage schema-та в page.tsx: Google
                            иска видимия текст да съвпада със schema-та; преди това отговорите,
                            които потребителят не е отворил, изобщо не съществуваха в HTML-а. */}
                        <p className="af-faq-ans" style={{ display: openFaq === i ? 'block' : 'none' }}>{a}</p>
                      </div>
                    ))}
                  </div>
                )}

              {/* ✅ #6 Related — само на MOBILE (под табовете, по-видима) */}
              {related.length > 0 && (
                <div className="af-card af-card-sm af-related-mobile" style={{ marginBottom:16 }}>
                  <p className="af-sec">🔗 Комбинирай с</p>
                  <RelatedBlock />
                </div>
              )}
            </>
          )}

          {/* YouTube */}
          {youtubeEmbed && (
            <div className="af-card" style={{ overflow:'hidden',marginBottom:16 }}>
              <div style={{ padding:'16px 20px 8px' }}><p className="af-sec">▶️ Видео ревю</p></div>
              <div className="af-yt-wrap">
                <iframe
                  src={youtubeEmbed}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  title={`${product.name} видео`}
                />
              </div>
            </div>
          )}

          {/* Final CTA */}
          <div className="af-final-cta" style={{ background:`linear-gradient(135deg,${color}0e,#fafaf8)`, border:`1.5px solid ${color}20` }}>
            <div style={{ fontSize:38,marginBottom:8,filter:'drop-shadow(0 3px 6px rgba(0,0,0,.12))' }}>{product.emoji || '🌿'}</div>
            <h3 style={{ fontFamily:"var(--font-cormorant),serif",fontSize:22,fontWeight:700,color:'#0a0a0a',marginBottom:7,lineHeight:1.15 }}>
              Готов да опиташ {product.name}?
            </h3>
            <p style={{ fontSize:13.5,color:'#64748b',lineHeight:1.65,marginBottom:18,maxWidth:380,margin:'0 auto 18px' }}>
              {product.social_proof || `Хиляди фермери вече използват ${product.name} с отлични резултати.`}
            </p>
            <button onClick={handleBuy} className="af-btn-buy"
              style={{ background:`linear-gradient(135deg,${color},${color}dd)`, boxShadow:`0 8px 28px ${color}44`, maxWidth:300, margin:'0 auto' }}>
              🛒 Виж в AgroApteki →
            </button>
            <p style={{ fontSize:10,color:'#b0a89a',marginTop:9 }}>Ще те пренасочим към agroapteki.com</p>
          </div>

        </div>
      </div>

      {/* ✅ #2 Mobile sticky — с цена */}
      <div className="af-mob-sticky">
        <button
          onClick={handleBuy}
          className={`af-btn-buy${pulse ? ' af-btn-pulse' : ''}`}
          style={{
            '--pc': `${color}55`,
            background: `linear-gradient(135deg,${color},${color}dd)`,
            boxShadow: `0 -3px 16px ${color}33,0 8px 28px ${color}44`,
          } as React.CSSProperties}
          aria-label={`Виж ${product.name} в agroapteki.com`}
        >
          🛒 {priceLabel}Виж в AgroApteki →
        </button>
      </div>
    </div>
  )
}
