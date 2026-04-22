'use client'
// app/produkt/[slug]/AffiliateProduktClient.tsx — v4
// ✅ ПОДОБРЕНИЯ спрямо v3:
//   SEO: <h2> тагове в таб съдържанието, role="tab/tabpanel", aria-selected
//   СЪДЪРЖАНИЕ: "Накратко" beginner box, quarantine_note вместо само число,
//               "Трудност" badge, обяснение на карантина за начинаещи
//   ВИЗУАЛНИ: мобилни табове с label (не само emoji), dose table стакиран на mobile,
//             по-голям акцент на цената, quarantine warning в buy card

import { useState, useEffect } from 'react'
import type { AffiliateProduct } from '@/lib/affiliate'
import { getRating } from '@/lib/affiliate'

interface Props {
  product:     AffiliateProduct
  related:     AffiliateProduct[]
  avgRating:   number
  reviewCount: number
}

type TabId = 'about' | 'howto' | 'tech' | 'faq'

function parseHowToUse(raw?: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {}
  try {
    const fixed = String(raw).trim().replace(/^\{/, '[').replace(/\}$/, ']')
    const parsed = JSON.parse(fixed)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {}
  return String(raw).split('\n').map(s => s.trim()).filter(Boolean)
}

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
        <h2 key={i} style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginTop: 16, marginBottom: 6, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .6 }}>
          {line.replace('## ', '')}
        </h2>
      )
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('• '))) {
        items.push(lines[i].trim().replace(/^[-•]\s*/, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ listStyle: 'none', padding: 0, margin: '0 0 6px' }}>
          {items.map((item, j) => (
            <li key={j} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 5, fontSize: 13.5, color: '#374151', lineHeight: 1.65 }}>
              <span style={{ color, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>✓</span>
              {item}
            </li>
          ))}
        </ul>
      )
      continue
    } else {
      elements.push(
        <p key={i} style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.8, marginBottom: 8 }}>{line}</p>
      )
    }
    i++
  }
  return elements
}

function difficultyBadge(quarantineDays?: number) {
  if (quarantineDays === undefined) return null
  if (quarantineDays === 0) return { label: 'Лесно за прилагане', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' }
  if (quarantineDays <= 3)  return { label: 'Умерено — спази карантина', color: '#92400e', bg: '#fffbeb', border: '#fde68a', icon: '⚠️' }
  return { label: 'Внимание — дълга карантина', color: '#991b1b', bg: '#fef2f2', border: '#fecaca', icon: '🔴' }
}

export default function AffiliateProduktClient({ product, related, avgRating, reviewCount }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('about')
  const [openFaq,   setOpenFaq]   = useState<number | null>(null)
  const [scrollPct, setScrollPct] = useState(0)
  const [imgError,  setImgError]  = useState(false)
  const [bought,    setBought]    = useState(false)
  const [mobMenu,   setMobMenu]   = useState(false)
  const [scrolled,  setScrolled]  = useState(false)

  const color = product.color || '#16a34a'

  const howToSteps = parseHowToUse(product.how_to_use)
  const faqItems   = Array.isArray(product.faq)        ? product.faq        : []
  const doseTable  = Array.isArray(product.dose_table) ? product.dose_table : []
  const crops      = Array.isArray(product.crops)      ? product.crops      : []
  const warnings   = Array.isArray(product.warnings)   ? product.warnings   : []
  const features   = Array.isArray(product.features)   ? product.features   : []
  const bullets    = Array.isArray(product.bullets)    ? product.bullets    : features

  const diff = difficultyBadge(product.quarantine_days)

  const hasAbout = !!(product.description || bullets.length > 0 || product.full_content || warnings.length > 0 || product.vs_competitor)
  const hasHowto = howToSteps.length > 0 || doseTable.length > 0
  const hasTech  = !!(product.active_substance || product.dosage || crops.length > 0 || product.quarantine_days !== undefined)
  const hasFaq   = faqItems.length > 0

  const tabs: { id: TabId; label: string; icon: string }[] = [
    hasAbout && { id: 'about' as TabId, label: 'За продукта', icon: '📋' },
    hasHowto && { id: 'howto' as TabId, label: 'Приложение',  icon: '📌' },
    hasTech  && { id: 'tech'  as TabId, label: 'Технически',  icon: '🔬' },
    hasFaq   && { id: 'faq'   as TabId, label: 'Въпроси',     icon: '❓' },
  ].filter(Boolean) as { id: TabId; label: string; icon: string }[]

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) setActiveTab(tabs[0].id)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      setScrollPct(Math.min((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100, 100))
      setScrolled(el.scrollTop > 10)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleBuy = () => {
    fetch('/api/affiliate-clicks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ partner: product.partner, product_slug: product.slug }) }).catch(() => {})
    setBought(true)
    setTimeout(() => setBought(false), 2500)
    window.open(product.affiliate_url, '_blank', 'noopener noreferrer')
  }

  const stars = (rating: number, size = 13) => (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1,2,3,4,5].map(i => <span key={i} style={{ fontSize: size, color: i <= Math.round(rating) ? '#f59e0b' : '#e2e8f0', lineHeight: 1 }}>★</span>)}
    </span>
  )

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth;overflow-x:hidden}
        body{font-family:'DM Sans',-apple-system,sans-serif;-webkit-font-smoothing:antialiased;background:#fafaf8;color:#1a1a1a;overflow-x:hidden;width:100%}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes tabIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideRight{from{opacity:0;transform:translateX(-100%)}to{opacity:1;transform:translateX(0)}}
        .site-header{position:sticky;top:0;z-index:200;background:rgba(255,255,255,.96);backdrop-filter:blur(16px);border-bottom:1px solid #e5e7eb;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:60px;box-shadow:0 1px 8px rgba(0,0,0,.04);transition:all .3s;gap:14px}
        .site-header.scrolled{box-shadow:0 4px 24px rgba(0,0,0,.08)}
        .header-logo{display:flex;align-items:center;gap:9px;flex-shrink:0;text-decoration:none}
        .logo-name{font-weight:700;font-size:17px;font-family:'Cormorant Garamond',serif;color:#1a1a1a;line-height:1}
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
        .af-hero-band{background:linear-gradient(160deg,#f0fdf4 0%,#dcfce7 50%,#f0fdf8 100%);border-bottom:1px solid #bbf7d0;padding:20px 0 0;position:relative;overflow:hidden;width:100%}
        .af-hero-band::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent 5%,#86efac 40%,#16a34a 50%,#86efac 60%,transparent 95%)}
        .af-hero-inner{max-width:1080px;margin:0 auto;padding:0 20px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:nowrap;overflow:hidden}
        .af-bc{display:flex;align-items:center;gap:5px;font-size:12px;color:#6b7280;flex-wrap:nowrap;overflow:hidden;min-width:0;flex:1}
        .af-bc a{color:#6b7280;text-decoration:none;transition:color .15s;white-space:nowrap}.af-bc a:hover{color:#16a34a}
        .af-bc strong{color:#14532d;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px}.af-bc-sep{opacity:.4;flex-shrink:0}
        .af-cat-badge{font-size:9.5px;font-weight:800;padding:4px 11px;border-radius:20px;letter-spacing:.1em;text-transform:uppercase;flex-shrink:0;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis}
        .af-grid{display:grid;grid-template-columns:340px 1fr;gap:24px;max-width:1080px;margin:0 auto;padding:20px 20px 80px;align-items:start;width:100%}
        .af-left{position:sticky;top:76px;display:flex;flex-direction:column;gap:12px;animation:fadeUp .45s ease both}
        .af-right{display:flex;flex-direction:column;gap:0;animation:fadeUp .45s .08s ease both}
        .af-card{background:#fff;border-radius:18px;border:1px solid rgba(0,0,0,.07);box-shadow:0 1px 3px rgba(0,0,0,.04),0 6px 24px rgba(0,0,0,.05);overflow:hidden}
        .af-card-p{padding:20px 22px}.af-card-sm{padding:14px 18px}
        .af-sec{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;display:flex;align-items:center;gap:8px;margin-bottom:12px}
        .af-sec::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,#e2e8f0,transparent)}
        .af-h2-seo{font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;display:flex;align-items:center;gap:8px;margin-bottom:12px;margin-top:0}
        .af-h2-seo::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,#e2e8f0,transparent)}
        .af-btn-buy{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:16px 22px;border:none;border-radius:14px;font-size:15.5px;font-weight:800;font-family:'DM Sans',sans-serif;cursor:pointer;letter-spacing:-.01em;color:#fff;transition:all .22s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
        .af-btn-buy::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.15) 0%,transparent 55%);pointer-events:none}
        .af-btn-buy:hover{transform:translateY(-2px);filter:brightness(1.06)}
        .af-btn-buy:active{transform:translateY(0);filter:brightness(.96)}
        .af-trust-row{display:flex;gap:5px;flex-wrap:wrap;justify-content:center}
        .af-trust-b{font-size:10px;font-weight:700;color:#64748b;background:#f8f7f4;border:1px solid #e8e3d9;border-radius:6px;padding:4px 9px}
        .af-tabs-bar{display:flex;background:#fff;border-radius:18px 18px 0 0;overflow:hidden;border:1px solid rgba(0,0,0,.07);border-bottom:none;box-shadow:0 1px 3px rgba(0,0,0,.04),0 6px 24px rgba(0,0,0,.05)}
        .af-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:13px 8px;font-size:12.5px;font-weight:700;font-family:'DM Sans',sans-serif;background:none;border:none;cursor:pointer;transition:all .18s;color:#94a3b8;white-space:nowrap;border-bottom:2.5px solid transparent}
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
        .af-faq-btn{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;text-align:left;font-size:13.5px;font-weight:600;color:#1e293b;transition:color .15s}
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
        /* Stat pills — pill-season-full се active само на мобилно чрез медиа query */
        .af-pill-season-full{}
        @media(max-width:820px){
          /* ═══ LAYOUT ═══ */
          .af-grid{grid-template-columns:1fr!important;gap:10px;padding:10px 12px 100px;max-width:100vw;overflow-x:hidden}
          .af-left{position:static;gap:10px}
          .af-right{gap:10px}

          /* ═══ HEADER ═══ */
          .site-header{padding:0 12px;height:52px}
          .logo-name{font-size:14px}
          .logo-sub{font-size:8px;letter-spacing:.06em}
          .header-nav{display:none}
          .mob-btn{display:flex}
          /* Бутонът "← Всички продукти" — по-компактен */
          .cart-btn{font-size:11px;padding:5px 10px;border-radius:8px;gap:3px}

          /* ═══ HERO BAND ═══ */
          .af-hero-inner{padding:0 12px 10px;gap:8px;flex-wrap:nowrap}
          .af-bc{font-size:11px;gap:4px;min-width:0;flex:1;overflow:hidden}
          .af-bc strong{max-width:110px;font-size:11px}
          .af-cat-badge{font-size:9px;padding:3px 9px;max-width:130px}

          /* ═══ CARDS ═══ */
          .af-card{border-radius:14px}
          .af-card-p{padding:14px 15px}
          .af-card-sm{padding:12px 14px}
          .af-title-card{padding:14px 15px;border-radius:14px;margin-bottom:0}
          .af-tab-panel{padding:14px 15px;border-radius:0 0 14px 14px}

          /* ═══ TABS ═══ */
          .af-tabs-bar{border-radius:12px 12px 0 0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:0;margin-top:10px}
          .af-tabs-bar::-webkit-scrollbar{display:none}
          .af-tab{flex:0 0 auto;min-width:76px;padding:10px 9px;font-size:11px;gap:3px}
          .af-tab-icon{font-size:12px}

          /* ═══ STAT PILLS — 3 items: 2 горе + 1 долу full-width ═══ */
          .af-stat-pills{grid-template-columns:repeat(2,1fr)!important}
          .af-pill-season-full{grid-column:1/-1}

          /* ═══ TECH ROWS ═══ */
          .af-tech-row{flex-direction:column}
          .af-tech-label{min-width:unset;width:100%;padding:6px 12px 3px;font-size:8.5px;border-radius:0}
          .af-tech-val{border-left:none;border-top:1px solid #f0ede8;padding:7px 12px 9px;font-size:13px;word-break:break-word;overflow-wrap:anywhere}

          /* ═══ TABLE OVERFLOW ═══ */
          .af-dose-table{font-size:12.5px}
          .af-vs-table th,.af-vs-table td{padding:8px 10px;font-size:11.5px}

          /* ═══ OTHER ═══ */
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
        }
        @media(max-width:480px){
          .af-grid{padding:8px 10px 100px;gap:8px}
          .af-card-p{padding:13px}
          .af-tab-panel{padding:13px}
          .af-title-card{padding:13px}
          .af-tab{min-width:68px;padding:9px 7px;font-size:10.5px}
          /* Dose table — stacked cards */
          .af-dose-table thead{display:none}
          .af-dose-table tr{display:block;border:1px solid #f1f5f9;border-radius:10px;margin-bottom:8px;padding:10px}
          .af-dose-table td{display:block;border:none;padding:3px 0;font-size:12.5px}
          .af-dose-table td:before{content:attr(data-label);font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:2px}
          /* VS table scrollable */
          .af-vs-table{font-size:10.5px}
          .af-vs-table th,.af-vs-table td{padding:7px 8px}
          /* Header */
          .site-header{height:48px}
          .logo-name{font-size:13px}
          .cart-btn{font-size:10.5px;padding:5px 8px}
          .mob-btn{width:34px;height:34px;font-size:17px}
        }
        @media print{.af-mob-sticky{display:none!important}.af-grid{grid-template-columns:1fr}.af-left{position:static}}
      `}</style>

      {/* Progress bar */}
      <div aria-hidden style={{ position:'fixed',top:0,left:0,height:3,zIndex:200,width:`${scrollPct}%`,background:`linear-gradient(90deg,${color},#4ade80)`,transition:'width .1s linear' }} />

      {/* Header */}
      <header className={`site-header${scrolled?' scrolled':''}`}>
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
        <div style={{ display:'flex',gap:10,alignItems:'center' }}>
          <a href="/#produkti" className="cart-btn">← Всички продукти</a>
          <button className="mob-btn" onClick={() => setMobMenu(v=>!v)} aria-label="Меню" aria-expanded={mobMenu}>{mobMenu?'✕':'☰'}</button>
        </div>
      </header>

      {mobMenu && (
        <div className="mob-nav">
          {([['/#produkti','Продукти'],['/#atlas','Atlas Terra'],['/#testimonials','Отзиви'],['/#faq','Въпроси']] as [string,string][]).map(([h,l]) => (
            <a key={h} href={h} className="mob-nav-link" onClick={()=>setMobMenu(false)}>{l}</a>
          ))}
          <a href="/#produkti" className="mob-nav-link" style={{color:'#16a34a',fontWeight:800}} onClick={()=>setMobMenu(false)}>← Всички продукти</a>
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
          <span className="af-cat-badge" style={{ color,background:`${color}15`,border:`1.5px solid ${color}30`,display: product.category_label ? undefined : 'none' }}>
            {product.emoji} {product.category_label}
          </span>
        </div>
      </div>

      {/* Main grid */}
      <div className="af-grid" style={{ boxSizing:'border-box' }}>

        {/* LEFT */}
        <div className="af-left">

          {/* Image */}
          <div className="af-card" style={{ padding:18,background:'linear-gradient(145deg,#fafaf8 0%,#fff 100%)' }}>
            <div style={{ position:'relative' }}>
              {product.badge_text && (
                <div style={{ position:'absolute',top:8,left:8,zIndex:2,background:color,color:'#fff',fontSize:9,fontWeight:800,letterSpacing:'.08em',textTransform:'uppercase',padding:'4px 10px',borderRadius:20,boxShadow:`0 3px 12px ${color}55` }}>✨ {product.badge_text}</div>
              )}
              {product.tag_text && (
                <div style={{ position:'absolute',top:8,right:8,zIndex:2,background:'rgba(10,10,10,.55)',backdropFilter:'blur(6px)',color:'#fff',fontSize:9,fontWeight:700,padding:'4px 9px',borderRadius:20 }}>{product.tag_text}</div>
              )}
              {product.image_url && !imgError ? (
                <img src={product.image_url} alt={product.image_alt||product.name} onError={()=>setImgError(true)} loading="eager"
                  style={{ width:'100%',maxHeight:300,objectFit:'contain',borderRadius:12,display:'block',mixBlendMode:'multiply' }} />
              ) : (
                <div style={{ height:240,borderRadius:12,fontSize:72,background:`linear-gradient(135deg,${color}18,${color}08)`,border:`2px dashed ${color}30`,display:'flex',alignItems:'center',justifyContent:'center' }}>{product.emoji||'🌿'}</div>
              )}
            </div>

            {/* Stat pills */}
            {(product.volume||product.quarantine_days!==undefined||product.season) && (
              (() => {
                const count = [product.volume, product.quarantine_days!==undefined, product.season].filter(Boolean).length
                // На мобилно: ако са 3, правим 2+1 (третото span full)
                // На desktop: всички в 1 ред
                return (
                  <div className="af-stat-pills" style={{ display:'grid', gridTemplateColumns:`repeat(${count},1fr)`, gap:7, marginTop:12 }}>
                    {product.volume && (
                      <div style={{ background:'#f8f7f4',border:'1px solid #ede9e1',borderRadius:9,padding:'8px',textAlign:'center' }}>
                        <div style={{ fontSize:8,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:3 }}>ОБЕМ</div>
                        <div style={{ fontSize:13,fontWeight:800,color:'#0f172a' }}>{product.volume}</div>
                      </div>
                    )}
                    {product.quarantine_days!==undefined && (
                      <div style={{ background:product.quarantine_days===0?'#f0fdf4':'#fff7ed',border:`1px solid ${product.quarantine_days===0?'#bbf7d0':'#fed7aa'}`,borderRadius:9,padding:'8px',textAlign:'center' }}>
                        <div style={{ fontSize:8,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:3 }}>КАРАНТИНА</div>
                        <div style={{ fontSize:11,fontWeight:800,color:product.quarantine_days===0?'#166534':'#9a3412',lineHeight:1.3 }}>
                          {product.quarantine_days===0 ? '0 дни ✓' : product.quarantine_note||`${product.quarantine_days} дни`}
                        </div>
                      </div>
                    )}
                    {product.season && (
                      <div className={count===3 ? 'af-pill-season-full' : ''} style={{ background:'#f8f7f4',border:'1px solid #ede9e1',borderRadius:9,padding:'8px',textAlign:'center' }}>
                        <div style={{ fontSize:8,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:3 }}>СЕЗОН</div>
                        <div style={{ fontSize:10,fontWeight:700,color:'#0f172a',lineHeight:1.3 }}>{product.season}</div>
                      </div>
                    )}
                  </div>
                )
              })()
            )}

            {/* Difficulty */}
            {diff && (
              <div style={{ marginTop:10,padding:'7px 12px',borderRadius:9,background:diff.bg,border:`1px solid ${diff.border}`,fontSize:11,fontWeight:700,color:diff.color,display:'flex',alignItems:'center',gap:6 }}>
                {diff.icon} {diff.label}
              </div>
            )}
            <div className="af-trust-row" style={{ marginTop:10 }}>
              {['✅ Оригинален','🚚 Бързо','🔒 Сигурно'].map(b=><span key={b} className="af-trust-b">{b}</span>)}
            </div>
          </div>

          {/* Buy card */}
          <div className="af-card af-card-p" id="af-buy-card">
            <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:12 }}>
              {stars(avgRating,14)}<span style={{ fontSize:12.5,fontWeight:700,color:'#374151' }}>{avgRating}/5</span>
              <span style={{ fontSize:11.5,color:'#94a3b8' }}>({reviewCount} отзива)</span>
            </div>

            {product.price && (
              <div style={{ marginBottom:4 }}>
                <div style={{ display:'flex',alignItems:'baseline',gap:6 }}>
                  <span style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:38,fontWeight:700,color:'#0a0a0a',letterSpacing:'-.03em',lineHeight:1 }}>{Number(product.price).toFixed(2)}</span>
                  <span style={{ fontSize:16,fontWeight:700,color:'#374151' }}>{product.price_currency||'EUR'}</span>
                  {product.volume && <span style={{ fontSize:12.5,color:'#94a3b8' }}>/ {product.volume}</span>}
                </div>
                <p style={{ fontSize:10.5,color:'#94a3b8',marginTop:3 }}>Ориентировъчна цена при партньора</p>
              </div>
            )}

            {product.quarantine_days===0 && (
              <div style={{ background:'linear-gradient(90deg,#f0fdf4,#ecfdf5)',border:'1.5px solid #a7f3d0',borderRadius:10,padding:'10px 13px',marginBottom:12,marginTop:12,display:'flex',alignItems:'center',gap:9 }}>
                <div style={{ width:32,height:32,borderRadius:'50%',flexShrink:0,background:'#16a34a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15 }}>✅</div>
                <div>
                  <div style={{ fontSize:10,fontWeight:800,color:'#166534',letterSpacing:'.05em' }}>0 ДНИ КАРАНТИНА</div>
                  <div style={{ fontSize:11.5,color:'#4b5563',marginTop:1,lineHeight:1.4 }}>Пръскаш днес — береш утре.</div>
                </div>
              </div>
            )}
            {product.quarantine_days!==undefined && product.quarantine_days>0 && (
              <div style={{ background:'#fff7ed',border:'1.5px solid #fed7aa',borderRadius:10,padding:'10px 13px',marginBottom:12,marginTop:12,display:'flex',alignItems:'center',gap:9 }}>
                <span style={{ fontSize:20,flexShrink:0 }}>⏱</span>
                <div>
                  <div style={{ fontSize:10,fontWeight:800,color:'#92400e',letterSpacing:'.05em' }}>КАРАНТИНЕН СРОК</div>
                  <div style={{ fontSize:11.5,color:'#78350f',marginTop:1,lineHeight:1.4 }}>{product.quarantine_note||`${product.quarantine_days} дни след пръскане`}</div>
                </div>
              </div>
            )}

            <button onClick={handleBuy} className="af-btn-buy"
              style={{ background:bought?'linear-gradient(135deg,#16a34a,#15803d)':`linear-gradient(135deg,${color},${color}dd)`,boxShadow:bought?'0 8px 28px rgba(22,163,74,.4)':`0 8px 28px ${color}44`,marginBottom:8 }}
              aria-label={`Виж ${product.name} в agroapteki.com`}>
              {bought ? '✓ Пренасочваме те…' : <><span>🛒</span> Виж в AgroApteki <span style={{opacity:.7}}>→</span></>}
            </button>
            <p style={{ fontSize:10.5,color:'#9ca3af',textAlign:'center',marginBottom:12 }}>Ще те пренасочим към agroapteki.com — сигурна поръчка</p>
            <div className="af-trust-row">
              {['💵 Наложен платеж','🚚 Еконт / Спиди','📞 Консултация'].map(t=><span key={t} className="af-trust-b">{t}</span>)}
            </div>
          </div>

          {/* Author */}
          <div className="af-card af-card-sm" style={{ background:'linear-gradient(135deg,#f0fdf4 0%,#fff 100%)',border:'1px solid #d1fae5' }}>
            <div style={{ display:'flex',alignItems:'center',gap:11 }}>
              <div style={{ width:42,height:42,borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,#052e16,#16a34a)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,border:'2px solid rgba(22,163,74,.25)' }}>🌱</div>
              <div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif",fontWeight:700,fontSize:16,color:'#0f172a',lineHeight:1 }}>Denny Angelow</div>
                <div style={{ fontSize:9,color:'#16a34a',fontWeight:800,textTransform:'uppercase',letterSpacing:'.1em',marginTop:3 }}>Агро Консултант</div>
              </div>
              <div style={{ marginLeft:'auto',textAlign:'right' }}>
                {stars(avgRating,11)}
                <div style={{ fontSize:9.5,color:'#64748b',marginTop:2 }}>{avgRating}/5 · {reviewCount}</div>
              </div>
            </div>
            <p style={{ fontSize:12,color:'#4b5563',lineHeight:1.6,marginTop:9 }}>
              Лично проверен — препоръчван на <strong style={{color:'#166534'}}>85K+ последователи</strong> и 800+ стопанства.
            </p>
          </div>

          {/* Related */}
          {related.length>0 && (
            <div className="af-card af-card-sm">
              <p className="af-sec">🔗 Комбинирай с</p>
              <div style={{ display:'flex',flexDirection:'column',gap:7 }}>
                {related.map(rel => (
                  <a key={rel.id} href={`/produkt/${rel.slug}`} className="af-rel" style={{'--rc':rel.color||color} as React.CSSProperties}>
                    {rel.image_url
                      ? <img src={rel.image_url} alt={rel.name} onError={e=>{(e.target as HTMLImageElement).style.display='none'}}
                          style={{ width:40,height:40,objectFit:'contain',borderRadius:8,flexShrink:0,mixBlendMode:'multiply' }} />
                      : <div style={{ width:40,height:40,borderRadius:8,background:'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>{rel.emoji||'🌿'}</div>
                    }
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:12.5,fontWeight:700,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{rel.name}</div>
                      <div style={{ fontSize:10,color:rel.color||color,fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em',marginTop:1 }}>{rel.category_label||rel.subtitle}</div>
                    </div>
                    <span style={{ color:rel.color||color,fontSize:13,flexShrink:0 }}>→</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="af-right">

          {/* Title */}
          <div className="af-title-card">
            <h1 style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(26px,3.5vw,40px)',fontWeight:700,color:'#0a0a0a',lineHeight:1.1,letterSpacing:'-.02em',marginBottom:product.subtitle?7:0 }}>
              {product.name}
            </h1>
            {product.subtitle && <p style={{ fontSize:14.5,color:'#64748b',lineHeight:1.55,marginBottom:12 }}>{product.subtitle}</p>}
            <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
              {stars(avgRating,13)}
              <span style={{ fontSize:12.5,fontWeight:700,color:'#374151' }}>{avgRating}/5</span>
              <span style={{ fontSize:12,color:'#94a3b8' }}>({reviewCount} верифицирани отзива)</span>
              {product.social_proof && <span style={{ fontSize:12,color:'#64748b',fontStyle:'italic' }}>· {product.social_proof}</span>}
            </div>
          </div>

          {/* Tabs */}
          {tabs.length>0 && (
            <>
              <div className="af-tabs-bar" role="tablist">
                {tabs.map(tab => (
                  <button key={tab.id} role="tab" aria-selected={activeTab===tab.id}
                    className={`af-tab${activeTab===tab.id?' active':''}`}
                    onClick={()=>setActiveTab(tab.id)}>
                    <span className="af-tab-icon">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="af-tab-panel" role="tabpanel">

                {/* За продукта */}
                {activeTab==='about' && (
                  <>
                    {product.description && (
                      <div className="af-beginner">
                        <div className="af-beginner-title">🌱 Накратко — за какво служи</div>
                        <p className="af-beginner-text">{product.description}</p>
                      </div>
                    )}
                    {bullets.length>0 && (
                      <div style={{ marginBottom:product.full_content?16:0 }}>
                        <h2 className="af-h2-seo">Основни предимства на {product.name}</h2>
                        {bullets.map((b,i) => (
                          <div key={i} className="af-bullet" style={{ background:`linear-gradient(135deg,${color}0a,transparent)`,border:`1px solid ${color}1e`,color:'#1a2e1a' }}>
                            <span style={{ color,fontWeight:800,flexShrink:0,marginTop:1,fontSize:13 }}>✓</span>{b}
                          </div>
                        ))}
                      </div>
                    )}
                    {product.full_content && (
                      <div style={{ marginTop:bullets.length>0?4:0 }}>
                        <h2 className="af-h2-seo">Подробно описание на {product.name}</h2>
                        {renderFullContent(product.full_content,color)}
                      </div>
                    )}
                    {warnings.length>0 && (
                      <div style={{ background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:13,padding:'15px 18px',marginTop:14 }}>
                        <h2 className="af-h2-seo" style={{ color:'#92400e' }}>Важни предупреждения</h2>
                        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                          {warnings.map((w,i) => (
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
                              {product.vs_competitor.vs.map((row,i) => (
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
                  </>
                )}

                {/* Приложение */}
                {activeTab==='howto' && (
                  <>
                    {howToSteps.length>0 && (
                      <>
                        <h2 className="af-h2-seo">Как да използваш {product.name} — стъпки</h2>
                        {howToSteps.map((step,i) => (
                          <div key={i} className="af-step">
                            <div className="af-step-num" style={{ background:`linear-gradient(135deg,${color},${color}bb)`,boxShadow:`0 3px 10px ${color}44` }}>{i+1}</div>
                            <p style={{ fontSize:14,color:'#374151',lineHeight:1.75,margin:0,paddingTop:4 }}>{step}</p>
                          </div>
                        ))}
                      </>
                    )}
                    {doseTable.length>0 && (
                      <div style={{ marginTop:howToSteps.length>0?18:0 }}>
                        <h2 className="af-h2-seo">Дозировка на {product.name} по култури</h2>
                        <p className="af-sec">📊 Норми на приложение</p>
                        <div style={{ overflowX:'auto',borderRadius:12,border:'1px solid #f1f5f9' }}>
                          <table className="af-dose-table">
                            <thead><tr>
                              <th>Култура / Неприятел</th>
                              <th>Доза</th>
                              <th>Интервал</th>
                            </tr></thead>
                            <tbody>
                              {doseTable.map((row,i) => (
                                <tr key={i}>
                                  <td data-label="Употреба" style={{ fontWeight:600 }}>{row.phase}</td>
                                  <td data-label="Доза" style={{ color,fontWeight:700 }}>{row.dose}</td>
                                  <td data-label="Интервал" style={{ color:'#64748b' }}>{row.interval}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p style={{ fontSize:11,color:'#94a3b8',marginTop:8 }}>* При съмнение се консултирайте с агроном.</p>
                      </div>
                    )}
                  </>
                )}

                {/* Технически */}
                {activeTab==='tech' && (
                  <>
                    <h2 className="af-h2-seo">Технически характеристики на {product.name}</h2>
                    {product.active_substance && (
                      <div className="af-tech-row">
                        <div className="af-tech-label">Активно вещество</div>
                        <div className="af-tech-val">{product.active_substance}</div>
                      </div>
                    )}
                    {product.dosage && (
                      <div className="af-tech-row">
                        <div className="af-tech-label">Дозировка</div>
                        <div className="af-tech-val">{product.dosage}</div>
                      </div>
                    )}
                    {product.quarantine_days!==undefined && (
                      <div className="af-tech-row">
                        <div className="af-tech-label">Карантина</div>
                        <div className="af-tech-val" style={{ color:product.quarantine_days===0?'#166534':'#9a3412',fontWeight:700 }}>
                          {product.quarantine_days===0 ? '✓ 0 дни — бери на следващия ден' : product.quarantine_note||`${product.quarantine_days} дни`}
                        </div>
                      </div>
                    )}
                    {product.volume && (
                      <div className="af-tech-row">
                        <div className="af-tech-label">Опаковка</div>
                        <div className="af-tech-val">{product.volume}</div>
                      </div>
                    )}
                    {product.season && (
                      <div className="af-tech-row">
                        <div className="af-tech-label">Сезон</div>
                        <div className="af-tech-val">{product.season}</div>
                      </div>
                    )}
                    {crops.length>0 && (
                      <div className="af-tech-row" style={{ alignItems:'flex-start' }}>
                        <div className="af-tech-label" style={{ alignSelf:'stretch' }}>Подходящ за</div>
                        <div className="af-tech-val" style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                          {crops.map(crop => (
                            <span key={crop} style={{ fontSize:12,fontWeight:700,color:'#166534',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:20,padding:'3px 10px' }}>🌱 {crop}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {product.quarantine_days!==undefined && product.quarantine_days>0 && (
                      <div style={{ marginTop:12,background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'12px 14px',fontSize:12.5,color:'#78350f',lineHeight:1.7 }}>
                        💡 <strong>Какво означава карантина?</strong> Броят дни след последното пръскане, след които е безопасно да берете. Ако карантината е {product.quarantine_days} дни и пръскате на 1-ви, берете най-рано на {product.quarantine_days+1}-ви.
                      </div>
                    )}
                  </>
                )}

                {/* Въпроси */}
                {activeTab==='faq' && (
                  <>
                    <h2 className="af-h2-seo">Често задавани въпроси за {product.name}</h2>
                    {faqItems.map(({q,a},i) => (
                      <div key={i} className="af-faq-item">
                        <button className="af-faq-btn" onClick={()=>setOpenFaq(openFaq===i?null:i)} aria-expanded={openFaq===i}>
                          <span>{q}</span>
                          <span className={`af-faq-icon${openFaq===i?' open':''}`}>+</span>
                        </button>
                        {openFaq===i && <p className="af-faq-ans">{a}</p>}
                      </div>
                    ))}
                  </>
                )}

              </div>
            </>
          )}

          {/* YouTube */}
          {product.youtube_url && (
            <div className="af-card" style={{ overflow:'hidden',marginBottom:16 }}>
              <div style={{ padding:'16px 20px 8px' }}><p className="af-sec">▶️ Видео ревю</p></div>
              <div className="af-yt-wrap">
                <iframe src={product.youtube_url.replace('watch?v=','embed/')}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen title={`${product.name} видео`} />
              </div>
            </div>
          )}

          {/* Final CTA */}
          <div className="af-final-cta" style={{ background:`linear-gradient(135deg,${color}0e,#fafaf8)`,border:`1.5px solid ${color}20` }}>
            <div style={{ fontSize:38,marginBottom:8,filter:'drop-shadow(0 3px 6px rgba(0,0,0,.12))' }}>{product.emoji||'🌿'}</div>
            <h3 style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:'#0a0a0a',marginBottom:7,lineHeight:1.15 }}>
              Готов да опиташ {product.name}?
            </h3>
            <p style={{ fontSize:13.5,color:'#64748b',lineHeight:1.65,marginBottom:18,maxWidth:380,margin:'0 auto 18px' }}>
              {product.social_proof||`Хиляди фермери вече използват ${product.name} с отлични резултати.`}
            </p>
            <button onClick={handleBuy} className="af-btn-buy"
              style={{ background:`linear-gradient(135deg,${color},${color}dd)`,boxShadow:`0 8px 28px ${color}44`,maxWidth:300,margin:'0 auto' }}>
              🛒 Виж в AgroApteki →
            </button>
            <p style={{ fontSize:10,color:'#b0a89a',marginTop:9 }}>Ще те пренасочим към agroapteki.com</p>
          </div>

        </div>
      </div>

      {/* Mobile sticky */}
      <div className="af-mob-sticky">
        <button onClick={handleBuy} className="af-btn-buy"
          style={{ background:`linear-gradient(135deg,${color},${color}dd)`,boxShadow:`0 -3px 16px ${color}33,0 8px 28px ${color}44` }}
          aria-label={`Купи ${product.name}`}>
          🛒 Виж в AgroApteki →
        </button>
      </div>
    </>
  )
}
