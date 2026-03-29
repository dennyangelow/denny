// app/page.tsx  ←  SERVER COMPONENT (без 'use client')
// Всички данни се зареждат тук на сървъра → нулева CLS, мигновено съдържание

import { Suspense } from 'react'
import { CDN, AFF } from '@/lib/marketing-data'
import { HeaderClient } from '@/components/client/HeaderClient'
import { HandbooksPanel } from '@/components/client/HandbooksPanel'
import { CartSystem } from '@/components/client/CartSystem'
import { FaqSection } from '@/components/client/FaqSection'
import { FadeIn } from '@/components/marketing/FadeIn'
import { SafeImg } from '@/components/client/SafeImg'
import './homepage.css'

// ─── Типове ────────────────────────────────────────────────────────────────────
interface SiteSettings {
  hero_title: string; hero_subtitle: string; hero_warning: string
  shipping_price: number; shipping_econt: number; shipping_speedy: number; free_shipping_above: number
  site_email: string; site_phone: string; whatsapp_number: string
  urgency_bar_text: string; trust_strip_items: string
  social_proof_items: string; footer_about_text: string
  cta_title: string; cta_subtitle: string
  ginegar_section_title: string; ginegar_section_desc: string
  currency: string; currency_symbol: string
}
interface Handbook { slug: string; title: string; subtitle: string; emoji: string; color: string; bg: string; badge: string }
interface ProductVariant { id: string; product_id: string; label: string; size_liters: number; price: number; compare_price: number; price_per_liter: number; stock: number; active: boolean }
interface AtlasProduct { id: string; name: string; subtitle: string; desc: string; badge: string; emoji: string; img: string; price: number; comparePrice: number; priceLabel: string; features: string[]; variants?: ProductVariant[] }
interface AffiliateProduct { id: string; slug: string; name: string; subtitle: string; description: string; bullets: string[]; image_url: string; affiliate_url: string; partner: string; emoji: string; badge_text: string; tag_text: string; color: string; badge_color: string; category_label: string }
interface CategoryLink { id: string; slug: string; label: string; href: string; emoji: string; partner: string | null; color?: string }
interface Testimonial { id: string; name: string; location: string; text: string; stars: number; avatar: string }
interface FaqItem { id: string; question: string; answer: string; sort_order: number; category: string }

// ─── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: SiteSettings = {
  hero_title: 'Искаш едри, здрави и сочни домати?',
  hero_subtitle: 'Без болести, без гниене и без загубена реколта. С правилната грижа и нужните продукти можеш да отгледаш здрави и продуктивни растения, без излишни усилия.',
  hero_warning: 'Не рискувай да изхвърлиш продукцията си, само защото нямаш нужната информация навреме.',
  shipping_price: 5.99, shipping_econt: 5.00, shipping_speedy: 5.50, free_shipping_above: 60,
  currency: 'EUR', currency_symbol: '€',
  site_email: 'support@dennyangelow.com', site_phone: '+359 876238623', whatsapp_number: '359876238623',
  urgency_bar_text: '🎁 **2 безплатни наръчника** — Домати & Краставици · 🚚 **Безплатна доставка** над 60 лв. · 💵 Само наложен платеж',
  trust_strip_items: JSON.stringify([
    { icon: '🌱', text: 'Органични продукти' }, { icon: '🚚', text: 'Еконт · Спиди до вратата' },
    { icon: '💵', text: 'Само наложен платеж' }, { icon: '📞', text: 'Лична консултация' }, { icon: '⭐', text: '5-звездни отзиви' },
  ]),
  social_proof_items: JSON.stringify([{ number: '6 000+', label: 'изтеглени' }, { number: '85K', label: 'последователи' }, { number: '100%', label: 'органично' }]),
  footer_about_text: 'Помагам на фермери да отглеждат по-здрави растения с проверени органични методи.',
  cta_title: 'Изтегли И Двата Наръчника Напълно Безплатно',
  cta_subtitle: 'Над 6 000 фермери вече ги изтеглиха. Вземи **и двата безплатно** — тайните за едри домати и рекордни краставици.',
  ginegar_section_title: 'Ginegar — Качествен Найлон за Оранжерии',
  ginegar_section_desc: 'Световен стандарт за здравина, светлина и дълъг живот.',
}
const DEFAULT_HANDBOOKS: Handbook[] = [
  { slug: 'super-domati', title: 'Тайните на Едрите Домати', subtitle: 'Над 6 000 изтеглени', emoji: '🍅', color: '#dc2626', bg: 'linear-gradient(135deg,#dc2626,#b91c1c)', badge: 'Домати' },
  { slug: 'krastavici-visoki-dobivy', title: 'Краставици за Високи Добиви', subtitle: 'Новост', emoji: '🥒', color: '#16a34a', bg: 'linear-gradient(135deg,#16a34a,#166534)', badge: 'Краставици' },
]
const CAT_COLORS: Record<string, string> = { agroapteki: '#16a34a', oranjeriata: '#0369a1', atlasagro: '#7c3aed', default: '#374151' }

// ─── Helpers ───────────────────────────────────────────────────────────────────
function parseBold(text: string) {
  return text.split(/\*\*(.*?)\*\*/g).map((p, i) =>
    i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>
  )
}

// ─── Data fetching (SERVER SIDE — директно от Supabase) ───────────────────────
async function getPageData() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const [
      { data: settingsRows },
      { data: productsRows },
      { data: variantsRows },
      { data: affiliateRows },
      { data: categoryRows },
      { data: testimonialRows },
      { data: faqRows },
      { data: handbookRows },
    ] = await Promise.all([
      supabase.from('settings').select('key,value'),
      supabase.from('products').select('*').eq('active', true).order('sort_order'),
      supabase.from('product_variants').select('*').eq('active', true).order('sort_order'),
      supabase.from('affiliate_products').select('*').eq('active', true).order('sort_order'),
      supabase.from('category_links').select('*').eq('active', true).order('sort_order'),
      supabase.from('testimonials').select('*').order('sort_order').limit(9),
      supabase.from('faq').select('*').order('sort_order'),
      supabase.from('naruchnici').select('*').eq('active', true).order('sort_order'),
    ])

    // Settings
    let settings = { ...DEFAULT_SETTINGS }
    if (settingsRows?.length) {
      const s: Record<string, string> = {}
      settingsRows.forEach((row: { key: string; value: string }) => { s[row.key] = row.value })
      settings = {
        ...settings,
        ...(s.hero_title && { hero_title: s.hero_title }),
        ...(s.hero_subtitle && { hero_subtitle: s.hero_subtitle }),
        ...(s.hero_warning && { hero_warning: s.hero_warning }),
        ...(s.shipping_price && { shipping_price: parseFloat(s.shipping_price) }),
        ...(s.free_shipping_above && { free_shipping_above: parseFloat(s.free_shipping_above) }),
        ...(s.site_email && { site_email: s.site_email }),
        ...(s.site_phone && { site_phone: s.site_phone }),
        ...(s.whatsapp_number && { whatsapp_number: s.whatsapp_number }),
        ...(s.urgency_bar_text && { urgency_bar_text: s.urgency_bar_text }),
        ...(s.trust_strip_items && { trust_strip_items: s.trust_strip_items }),
        ...(s.social_proof_items && { social_proof_items: s.social_proof_items }),
        ...(s.footer_about_text && { footer_about_text: s.footer_about_text }),
        ...(s.cta_title && { cta_title: s.cta_title }),
        ...(s.cta_subtitle && { cta_subtitle: s.cta_subtitle }),
        ...(s.ginegar_section_title && { ginegar_section_title: s.ginegar_section_title }),
        ...(s.ginegar_section_desc && { ginegar_section_desc: s.ginegar_section_desc }),
        ...(s.shipping_econt  && { shipping_econt:  parseFloat(s.shipping_econt) }),
        ...(s.shipping_speedy && { shipping_speedy: parseFloat(s.shipping_speedy) }),
        // shipping_price = по-малкото от econt/speedy (за CartSystem)
        ...((s.shipping_econt || s.shipping_speedy) && {
          shipping_price: Math.min(
            s.shipping_econt  ? parseFloat(s.shipping_econt)  : 999,
            s.shipping_speedy ? parseFloat(s.shipping_speedy) : 999,
          )
        }),
        ...(s.currency        && { currency:        s.currency }),
        ...(s.currency_symbol && { currency_symbol: s.currency_symbol }),
      }
    }

    const atlasProducts: AtlasProduct[] = (productsRows || []).map((p: any) => {
      const productVariants: ProductVariant[] = (variantsRows || [])
        .filter((v: any) => v.product_id === p.id && v.active !== false)
        .map((v: any) => ({
          id: v.id,
          product_id: v.product_id,
          label: v.label,
          size_liters: parseFloat(v.size_liters),
          price: parseFloat(v.price),
          compare_price: parseFloat(v.compare_price || v.price),
          price_per_liter: parseFloat(v.price_per_liter || (v.price / v.size_liters).toFixed(2)),
          stock: v.stock || 0,
          active: v.active !== false,
        }))
      const baseVariant = productVariants[0]
      return {
        id: p.id || p.slug, name: p.name, subtitle: p.subtitle || '', desc: p.description || '',
        badge: p.badge || 'Хит', emoji: p.emoji || '🌿', img: p.image_url || '',
        price: baseVariant ? baseVariant.price : parseFloat(p.price),
        comparePrice: baseVariant ? baseVariant.compare_price : parseFloat(p.compare_price || p.price),
        priceLabel: baseVariant ? baseVariant.price.toFixed(2)  + ' €' : parseFloat(p.price).toFixed(2) + ' €',
        features: p.features || [],
        variants: productVariants,
      }
    })

    const affiliateProducts: AffiliateProduct[] = (affiliateRows || []).map((p: any) => ({
      ...p,
      bullets: p.bullets || p.features || [],
      emoji: p.emoji || '',
      badge_text: p.badge_text || p.badge || '',
      badge_color: p.badge_color || p.color || '',
      category_label: p.category_label || p.subtitle || '',
      tag_text: p.tag_text || '',
      color: p.color || '#16a34a',
    }))
    const categoryLinks: CategoryLink[] = (categoryRows || []).map((c: any) => ({
      ...c,
      emoji: c.emoji || c.icon || '🌿',
      href: c.href || c.link || '#',
      slug: c.slug || c.id,
      color: c.color || CAT_COLORS[c.partner || 'default'] || CAT_COLORS.default,
    }))
    const testimonials: Testimonial[] = testimonialRows || []
    const faq: FaqItem[] = faqRows || []
    const handbooks: Handbook[] = handbookRows?.length
      ? handbookRows.map((n: any) => ({
          slug: n.slug, title: n.title, subtitle: n.subtitle || '',
          emoji: n.emoji || (n.category === 'domati' ? '🍅' : '🌿'),
          color: n.color || (n.category === 'domati' ? '#dc2626' : '#16a34a'),
          bg: n.bg || (n.category === 'domati' ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,#16a34a,#166534)'),
          badge: n.badge || n.category,
        }))
      : DEFAULT_HANDBOOKS

    return { settings, atlasProducts, affiliateProducts, categoryLinks, testimonials, faq, handbooks }
  } catch (err) {
    console.error('[getPageData] Supabase error:', err)
    return {
      settings: DEFAULT_SETTINGS, atlasProducts: [], affiliateProducts: [],
      categoryLinks: [], testimonials: [], faq: [], handbooks: DEFAULT_HANDBOOKS,
    }
  }
}

// ─── SERVER COMPONENT ──────────────────────────────────────────────────────────
export default async function HomePage() {
  const { settings, atlasProducts, affiliateProducts, categoryLinks, testimonials, faq, handbooks } = await getPageData()

  const trustItems: { icon: string; text: string }[] = (() => { try { return JSON.parse(settings.trust_strip_items) } catch { return [] } })()
  const socialItems: { number: string; label: string }[] = (() => { try { return JSON.parse(settings.social_proof_items) } catch { return [] } })()
  const ginegarProduct = affiliateProducts.find(p => p.partner !== 'agroapteki')

  return (
    <>
      <style suppressHydrationWarning>{`.hb-input::placeholder{color:rgba(255,255,255,.45)}.hb-input{color:#fff!important}.hb-input:focus{border-color:#86efac!important;outline:none}`}</style>

      {/* URGENCY BAR */}
      <div className="urgency-bar">{parseBold(settings.urgency_bar_text)}</div>

      {/* HEADER — client само за scroll + cart */}
      <HeaderClient shippingPrice={settings.shipping_price} freeShippingAbove={settings.free_shipping_above} />

      {/* ══ HERO ══ */}
      <section className="hero">
        <div className="hero-dots" />
        <div className="hero-blob hero-blob--tr" />
        <div className="hero-blob hero-blob--bl" />
        <div className="hero-inner">
          <div className="hero-left">
            <div className="trust-badge">
              <img src={`${CDN}/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg`} alt="Denny" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.5)', flexShrink: 0 }} />
              <span>@dennyangelow · {socialItems.find(s => s.label === 'последователи')?.number || '85K'}+ последователи · 8+ год. практика</span>
              <span className="live-dot" />
            </div>
            <h1 className="hero-title">{settings.hero_title}</h1>
            {settings.hero_subtitle && (
              <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 16, lineHeight: 1.7, margin: '14px 0 18px', maxWidth: 520 }}>
                {parseBold(settings.hero_subtitle)}
              </p>
            )}
            {settings.hero_warning && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: 10, padding: '11px 15px', marginBottom: 18 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                <span style={{ color: '#fca5a5', fontSize: 14, lineHeight: 1.55 }}>{settings.hero_warning}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
              {socialItems.map(({ number, label }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ color: '#86efac', fontWeight: 900, fontSize: 20, fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>{number}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Наръчници панел — client (форма) */}
          <div className="hero-right">
            <HandbooksPanel handbooks={handbooks} />
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <div className="trust-strip">
        {trustItems.map(({ icon, text }) => (
          <div key={text} className="trust-item"><span>{icon}</span><span>{text}</span></div>
        ))}
      </div>

      {/* CATEGORIES */}
      {categoryLinks.length > 0 && (
        <section id="kategorii" className="section-wrap">
          <FadeIn>
            <div className="section-head">
              <span className="s-tag">Магазин</span>
              <h2 className="s-title">Всичко за Твоята Градина</h2>
              <p className="s-desc">Избери категорията, която те интересува</p>
            </div>
          </FadeIn>
          <div className="categories-grid">
            {categoryLinks.map((c, i) => {
              const color = CAT_COLORS[c.partner || 'default'] || CAT_COLORS.default
              return (
                <FadeIn key={c.slug} delay={i * 55}>
                  <a href={c.href} target="_blank" rel="noopener noreferrer" className="cat-card cat-card--hover"
                    data-partner={c.partner} data-slug={c.slug}
                    style={{ '--cat-color': color } as React.CSSProperties}>
                    <span style={{ fontSize: 20, background: color + '18', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.emoji}</span>
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{c.label}</span>
                    <span style={{ color, fontSize: 16, opacity: 0.7 }}>→</span>
                  </a>
                </FadeIn>
              )
            })}
          </div>
        </section>
      )}

      {/* AFFILIATE PRODUCTS */}
      {affiliateProducts.length > 0 && (
        <section id="produkti" className="section-wrap" style={{ paddingTop: 0 }}>
          <FadeIn>
            <div className="section-head">
              <span className="s-tag">Препоръчани продукти</span>
              <h2 className="s-title">Проверени от Практиката</h2>
              <p className="s-desc">Продуктите, които лично използвам и препоръчвам</p>
            </div>
          </FadeIn>
          <div className="products-grid">
            {affiliateProducts.filter(p => p.partner === 'agroapteki').map((p, i) => {
              const cardColor = p.color || CAT_COLORS[p.partner] || '#16a34a'
              const badgeColor = p.badge_color || cardColor
              return (
                <FadeIn key={p.id} delay={i * 60}>
                  <div className="product-card" style={{ '--card-color': cardColor } as React.CSSProperties}>
                    <div style={{ position: 'relative', background: '#f8f9fa', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 20px 0' }}>
                      {p.badge_text && (
                        <div style={{ position: 'absolute', top: 14, left: 14, background: badgeColor, color: '#fff', fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 30, zIndex: 2 }}>{p.badge_text}</div>
                      )}
                      {p.tag_text && (
                        <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.95)', color: '#374151', fontSize: 11.5, fontWeight: 700, padding: '5px 11px', borderRadius: 30, zIndex: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {p.emoji && <span style={{ fontSize: 13 }}>{p.emoji}</span>}{p.tag_text}
                        </div>
                      )}
                      <SafeImg src={p.image_url} alt={p.name} fallbackEmoji={p.emoji || '🌿'} style={{ width: '100%', maxHeight: 180, objectFit: 'contain', display: 'block' }} />
                    </div>
                    <div style={{ padding: '18px 22px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {p.category_label && (
                        <div style={{ fontSize: 11, fontWeight: 800, color: cardColor, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p.emoji && <span style={{ fontSize: 13 }}>{p.emoji}</span>}{p.category_label}
                        </div>
                      )}
                      <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 10px', lineHeight: 1.2 }}>{p.name}</h3>
                      <p style={{ fontSize: 13.5, color: '#6b7280', lineHeight: 1.65, marginBottom: 14, fontStyle: 'italic', flex: 0 }}>„{p.description}"</p>
                      {p.bullets?.length > 0 && (
                        <ul style={{ margin: '0 0 20px', padding: 0, listStyle: 'none', flex: 1 }}>
                          {p.bullets.slice(0, 3).map((b, j) => (
                            <li key={j} style={{ fontSize: 13, color: '#374151', padding: '5px 0', display: 'flex', gap: 9, alignItems: 'flex-start', borderBottom: '1px solid #f5f5f5' }}>
                              <span style={{ background: cardColor, color: '#fff', width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>{b}
                            </li>
                          ))}
                        </ul>
                      )}
                      <a href={p.affiliate_url} target="_blank" rel="noopener noreferrer" data-partner={p.partner} data-slug={p.slug}
                        style={{ display: 'block', textAlign: 'center', background: cardColor, color: '#fff', padding: '13px 20px', borderRadius: 12, textDecoration: 'none', fontWeight: 800, fontSize: 14.5, marginTop: 'auto' }}>
                        Прочети повече →
                      </a>
                    </div>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </section>
      )}

      {/* СПЕЦИАЛЕН ПАРТНЬОРСКИ ПРОДУКТ */}
      {ginegarProduct && (
        <section id="ginegar" className="ginegar-section">
          <div className="ginegar-glow" />
          <div className="ginegar-dots" />
          <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <FadeIn>
              <div className="ginegar-inner">
                <div className="ginegar-text">
                  <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '6px 16px', borderRadius: 30, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'inline-block', marginBottom: 16 }}>🏕️ ИЗРАЕЛСКА ТЕХНОЛОГИЯ</span>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#fff', fontSize: 'clamp(26px, 3.5vw, 38px)', margin: '0 0 14px', fontWeight: 800, lineHeight: 1.15 }}>{settings.ginegar_section_title || ginegarProduct.name}</h2>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.8, marginBottom: 22 }}>{settings.ginegar_section_desc || ginegarProduct.description}</p>
                  <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none' }}>
                    {ginegarProduct.bullets.map(f => (
                      <li key={f} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, padding: '7px 0', display: 'flex', gap: 11, borderBottom: '1px solid rgba(255,255,255,0.07)', alignItems: 'flex-start' }}>
                        <span style={{ background: '#16a34a', color: '#fff', width: 17, height: 17, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  <a href={ginegarProduct.affiliate_url} target="_blank" rel="noopener noreferrer" data-partner={ginegarProduct.partner} data-slug={ginegarProduct.slug} className="ginegar-btn">
                    👉 Разгледай фолиата на Ginegar
                  </a>
                </div>
                <div className="ginegar-img-wrap">
                  <div style={{ position: 'absolute', inset: -16, background: 'radial-gradient(circle, rgba(22,163,74,0.22), transparent 70%)', borderRadius: '50%' }} />
                  <img src={ginegarProduct.image_url} alt={ginegarProduct.name} style={{ width: '100%', maxWidth: 260, borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', position: 'relative' }} />
                </div>
              </div>
            </FadeIn>
          </div>
        </section>
      )}

      {/* ATLAS TERRA SECTION */}
{atlasProducts.length > 0 && (
  <section id="atlas" style={{ 
    padding: '60px 0', // Намален падниг за по-добро събиране на екран
    backgroundColor: '#ffffff',
    position: 'relative'
  }}>
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
      
      <FadeIn>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          {/* Малък, елегантен Badge */}
          <div style={{ 
            display: 'inline-block',
            background: '#f0fdf4', 
            color: '#16a34a', 
            fontSize: 12, 
            fontWeight: 700, 
            padding: '4px 12px', 
            borderRadius: 6,
            marginBottom: 12,
            border: '1px solid #dcfce7'
          }}>
            🏭 ДИРЕКТНО ОТ ПРОИЗВОДИТЕЛЯ
          </div>

          <h2 style={{ 
            fontSize: 'clamp(28px, 4vw, 42px)', 
            fontWeight: 900, 
            color: '#111827', 
            letterSpacing: '-0.03em', // По-сбито за по-модерен вид
            lineHeight: 1.1,
            marginBottom: 16
          }}>
            Atlas Terra — Професионална Серия
          </h2>
          
          <p style={{ 
            fontSize: 17, 
            color: '#4b5563', 
            maxWidth: 650, 
            margin: '0 auto',
            lineHeight: 1.5,
            fontWeight: 450 // Малко по-плътен текст за лесно четене
          }}>
            Три специализирани формули за здрава почва и максимален добив. 
            Използвани от професионални агрономи, вече достъпни за твоята градина.
          </p>
        </div>
      </FadeIn>

      {/* Продуктите - CartSystem трябва да е с Grid 3 колони */}
      <div style={{ 
        marginTop: 20,
        position: 'relative',
        zIndex: 10
      }}>
        <CartSystem
          atlasProducts={atlasProducts}
          shippingPrice={settings.shipping_price}
          freeShippingAbove={settings.free_shipping_above}
          siteEmail={settings.site_email}
          sitePhone={settings.site_phone}
        />
      </div>

      {/* Сбита информация под продуктите */}
      <FadeIn>
        <div style={{ 
          marginTop: 30, 
          padding: '20px',
          borderRadius: 20,
          background: '#f9fafb',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '24px',
          border: '1px solid #f3f4f6'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', fontWeight: 600 }}>
            <span style={{ fontSize: 18 }}>🚚</span> Безплатна доставка над {settings.free_shipping_above} €
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', fontWeight: 600 }}>
            <span style={{ fontSize: 18 }}>🛡️</span> Плащане при доставка
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', fontWeight: 600 }}>
            <span style={{ fontSize: 18 }}>⚡</span> Експресна пратка (1-2 дни)
          </div>
        </div>
      </FadeIn>
    </div>
  </section>
)}




      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="section-wrap" style={{ backgroundColor: '#ffffff' }}>
          <FadeIn>
            <div className="section-head">
              <span className="s-tag" style={{ color: '#059669' }}>Отзиви</span>
              <h2 className="s-title" style={{ color: '#111827' }}>Какво казват фермерите</h2>
              <p className="s-desc" style={{ color: '#4b5563' }}>Реални резултати от реални хора — без филтри</p>
            </div>
          </FadeIn>
          <div className="testimonials-grid">
            {testimonials.map((t, i) => (
              <FadeIn key={t.id} delay={i * 80}>
                <article className="testimonial-card">
                  <div style={{ display: 'flex', gap: 4, marginBottom: 16 }} aria-label={`Оценка: ${t.stars} от 5 звезди`}>
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <span key={j} aria-hidden="true" style={{ color: '#f59e0b', fontSize: 18 }}>★</span>
                    ))}
                  </div>
                  <blockquote style={{ margin: 0, flexGrow: 1 }}>
                    <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 24 }}>„{t.text}"</p>
                  </blockquote>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
                    <div style={{ fontSize: 28, lineHeight: 1 }}>{t.avatar}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>📍 {t.location}</div>
                    </div>
                  </div>
                </article>
              </FadeIn>
            ))}
          </div>
        </section>
      )}

      {/* FAQ — client (tabs + accordion) */}
      {faq.length > 0 && <FaqSection faq={faq} />}

      {/* SECOND CTA */}
      <section className="cta-section">
        <div className="cta-dots" />
        <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative', textAlign: 'center' }}>
          <FadeIn>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 14, fontSize: 40 }}>
              <span>🍅</span><span>🥒</span>
            </div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#fff', fontSize: 'clamp(26px, 4vw, 38px)', margin: '0 0 12px', fontWeight: 800 }}>
              {settings.cta_title}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
              {parseBold(settings.cta_subtitle)}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, margin: '0 auto' }}>
              {handbooks.map(hb => (
                <a key={hb.slug} href={`/naruchnik/${hb.slug}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, background: hb.color, color: '#fff', padding: '14px 22px', borderRadius: 14, textDecoration: 'none', fontWeight: 800, fontSize: 15, boxShadow: `0 6px 24px ${hb.color}55`, transition: 'all .2s' }}>
                  <span style={{ fontSize: 22 }}>{hb.emoji}</span>
                  <span style={{ flex: 1 }}>{hb.title}</span>
                  <span style={{ fontSize: 18, opacity: 0.8 }}>↓</span>
                </a>
              ))}
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 18 }}>🔒 Без спам · Без регистрация · Директно сваляне</p>
          </FadeIn>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="site-footer">
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 28, marginBottom: 36, textAlign: 'left' }}>
            <div>
              <div style={{ fontSize: 26, marginBottom: 8 }}>🍅</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, color: '#fff', fontWeight: 700, marginBottom: 4 }}>Denny Angelow</div>
              <div style={{ fontSize: 10, color: '#86efac', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Агро Консултант</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{settings.footer_about_text}</p>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Наръчници</div>
              {handbooks.map(hb => (
                <a key={hb.slug} href={`/naruchnik/${hb.slug}`} className="footer-link">{hb.emoji} {hb.title}</a>
              ))}
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Партньори</div>
              {[
                { label: '🌿 AgroApteki.bg', href: `https://agroapteki.com/${AFF}` },
                { label: '🏡 Oranjeriata.bg', href: 'https://oranjeriata.com/' },
                { label: '🌱 AtlasAgro.eu', href: 'https://atlasagro.eu/' },
              ].map(l => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener" className="footer-link">{l.label}</a>
              ))}
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Контакт</div>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
                📧 <a href={`mailto:${settings.site_email}`} style={{ color: '#86efac', fontWeight: 600, textDecoration: 'none' }}>{settings.site_email}</a>
              </p>
              {settings.site_phone && (
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
                  📞 <a href={`tel:${settings.site_phone}`} style={{ color: '#86efac', fontWeight: 600, textDecoration: 'none' }}>{settings.site_phone}</a>
                </p>
              )}
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>Пон–Пет, 9:00–17:00 ч.</p>
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 18 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>© 2025–2026 Denny Angelow · Всички права запазени</div>
            <a href="/admin" style={{ color: 'rgba(255,255,255,0.15)', textDecoration: 'none', fontSize: 11 }}>Admin</a>
          </div>
        </div>
      </footer>
    </>
  )
}
