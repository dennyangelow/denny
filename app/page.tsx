// app/page.tsx  ←  SERVER COMPONENT (без 'use client')
// Всички данни се зареждат тук на сървъра → нулева CLS, мигновено съдържание

import { CDN, AFF } from '@/lib/marketing-data'
import { HeaderClient } from '@/components/client/HeaderClient'
import { HandbooksPanel } from '@/components/client/HandbooksPanel'
import { CartSystem } from '@/components/client/CartSystem'
import { FaqSection } from '@/components/client/FaqSection'
import { FadeIn } from '@/components/marketing/FadeIn'
import { SafeImg } from '@/components/client/SafeImg'
import './homepage.css'

// revalidate = 0 → страницата винаги е свежа (ISR on-demand чрез revalidatePath)
// Ако искаш леко кеширане сложи 30, но 0 гарантира мигновени промени от admin
export const revalidate = 0

// ─── Типове ────────────────────────────────────────────────────────────────────
interface SiteSettings {
  hero_title: string
  hero_subtitle: string
  hero_warning: string
  shipping_price: number
  shipping_econt: number
  shipping_speedy: number
  free_shipping_above: number
  site_email: string
  site_phone: string
  whatsapp_number: string
  urgency_bar_text: string
  trust_strip_items: string
  social_proof_items: string
  footer_about_text: string
  cta_title: string
  cta_subtitle: string
  currency: string
  currency_symbol: string
}

interface Handbook {
  slug: string; title: string; subtitle: string
  emoji: string; color: string; bg: string; badge: string; image_url?: string
}

interface ProductVariant {
  id: string; product_id: string; label: string
  size_liters: number; price: number; compare_price: number
  price_per_liter: number; stock: number; active: boolean
}

interface AtlasProduct {
  id: string; name: string; subtitle: string; desc: string
  badge: string; emoji: string; img: string
  price: number; comparePrice: number; priceLabel: string
  features: string[]; variants?: ProductVariant[]
}

interface AffiliateProduct {
  id: string; slug: string; name: string; subtitle: string
  description: string; bullets: string[]; image_url: string
  affiliate_url: string; partner: string; emoji: string
  badge_text: string; tag_text: string; color: string
  badge_color: string; category_label: string
}

interface CategoryLink {
  id: string; slug: string; label: string
  href: string; emoji: string; partner: string | null; color?: string
}

interface Testimonial {
  id: string
  name: string
  location?: string
  text: string
  rating: number
  avatar_url?: string
  product?: string
  review_date?: string
}

interface FaqItem {
  id: string; question: string; answer: string
  sort_order: number; category: string; active: boolean
}

interface FaqCategory {
  id: string; slug: string; label: string; icon: string; sort_order: number
}

interface PromoBanner {
  id: string
  message: string
  icon: string
  color: string
  text_color: string
  active: boolean
  display_style?: 'bar' | 'featured'
}

interface SpecialSection {
  id: string; slug: string
  title: string; subtitle: string; description: string
  badge_text: string; button_text: string; button_url: string
  bullets: string[]; image_url: string; logo_url: string
  active: boolean; sort_order: number
}

// ─── Defaults ──────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS: SiteSettings = {
  hero_title:          'Искаш едри, здрави и сочни домати?',
  hero_subtitle:       'Без болести, без гниене и без загубена реколта. С правилната грижа и нужните продукти можеш да отгледаш здрави и продуктивни растения, без излишни усилия.',
  hero_warning:        'Не рискувай да изхвърлиш продукцията си, само защото нямаш нужната информация навреме.',
  shipping_price:      5.00,
  shipping_econt:      5.00,
  shipping_speedy:     5.50,
  free_shipping_above: 60,
  currency:            'EUR',
  currency_symbol:     '€',
  site_email:          'support@dennyangelow.com',
  site_phone:          '+359 876238623',
  whatsapp_number:     '359876238623',
  urgency_bar_text:    '🎁 **2 безплатни наръчника** — Домати & Краставици · 🚚 **Безплатна доставка** над 60 € · 💵 Само наложен платеж',
  trust_strip_items:   JSON.stringify([
    { icon: '📗', text: 'Безплатни наръчници', sub: 'Домати & Краставици' },
    { icon: '🚚', text: 'Еконт · Спиди', sub: 'Доставка до вратата' },
    { icon: '💵', text: 'Наложен платеж', sub: 'Плащате при получаване' },
    { icon: '📞', text: 'Лична консултация', sub: 'Безплатна помощ' },
    { icon: '⭐', text: '5-звездни отзиви', sub: 'Доволни клиенти' },
  ]),
  social_proof_items:  JSON.stringify([
    { number: '6 000+', label: 'изтеглени' },
    { number: '85K',    label: 'последователи' },
    { number: '100%',   label: 'органично' },
  ]),
  footer_about_text:   'Помагам на фермери да отглеждат по-здрави растения с проверени органични методи.',
  cta_title:           'Изтегли И Двата Наръчника Напълно Безплатно',
  cta_subtitle:        'Над 6 000 фермери вече ги изтеглиха. Вземи **и двата безплатно** — тайните за едри домати и рекордни краставици.',
}

const DEFAULT_HANDBOOKS: Handbook[] = [
  { slug: 'super-domati',            title: 'Тайните на Едрите Домати',    subtitle: 'Над 6 000 изтеглени', emoji: '🍅', color: '#dc2626', bg: 'linear-gradient(135deg,#dc2626,#b91c1c)', badge: 'Домати' },
  { slug: 'krastavici-visoki-dobivy', title: 'Краставици за Високи Добиви', subtitle: 'Новост',              emoji: '🥒', color: '#16a34a', bg: 'linear-gradient(135deg,#16a34a,#166534)', badge: 'Краставици' },
]

const DEFAULT_FAQ_CATEGORIES: FaqCategory[] = [
  { id: 'atlas',     slug: 'atlas',     label: 'Atlas Terra',        icon: '🌱', sort_order: 1 },
  { id: 'affiliate', slug: 'affiliate', label: 'Афилиейт & Ginegar', icon: '🏕️', sort_order: 2 },
  { id: 'delivery',  slug: 'delivery',  label: 'Доставка & Мен',     icon: '🚚', sort_order: 3 },
]

const CAT_COLORS: Record<string, string> = {
  agroapteki:  '#16a34a',
  oranjeriata: '#0369a1',
  atlasagro:   '#7c3aed',
  default:     '#374151',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function parseBold(text: string) {
  return text.split(/\*\*(.*?)\*\*/g).map((p, i) =>
    i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>
  )
}

function safeJson<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) } catch { return fallback }
}

// ─── Data fetching ─────────────────────────────────────────────────────────────
async function getPageData() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const [
      { data: settingsRows,        error: e1 },
      { data: productsRows,        error: e2 },
      { data: variantsRows,        error: e3 },
      { data: affiliateRows,       error: e4 },
      { data: categoryRows,        error: e5 },
      { data: testimonialRows,     error: e6 },
      { data: promoBannersRows,    error: e11 },
      { data: faqRows,             error: e7 },
      { data: handbookRows,        error: e8 },
      { data: specialSectionsRows, error: e9 },
      { data: faqCategoryRows,     error: e10 },
    ] = await Promise.all([
      supabase.from('settings').select('key,value'),
      supabase.from('products').select('*').eq('active', true).order('sort_order'),
      supabase.from('product_variants').select('*').eq('active', true).order('sort_order'),
      supabase.from('affiliate_products').select('*').eq('active', true).order('sort_order'),
      supabase.from('category_links').select('*').eq('active', true).order('sort_order'),
      supabase.from('testimonials').select('*').order('sort_order').limit(9),
      supabase.from('promo_banners').select('*').eq('active', true).order('sort_order'),
      // Зареждаме само активните FAQ въпроси за публичната страница
      supabase.from('faq').select('*').eq('active', true).order('sort_order'),
      supabase.from('naruchnici').select('*').eq('active', true).order('sort_order'),
      supabase.from('special_sections').select('*').eq('active', true).order('sort_order'),
      // ✅ НОВО: зареждаме faq_categories
      supabase.from('faq_categories').select('*').order('sort_order'),
    ])

    // Log грешки без да счупваме страницата
    ;[e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11].forEach((e, i) => {
      if (e) console.error(`[getPageData] query ${i + 1} error:`, e.message)
    })

    // ── Settings ──────────────────────────────────────────────────────────────
    let settings = { ...DEFAULT_SETTINGS }
    if (settingsRows?.length) {
      const s: Record<string, string> = {}
      settingsRows.forEach((row: { key: string; value: string }) => { s[row.key] = row.value })

      const num = (k: string) => s[k] !== undefined ? parseFloat(s[k]) : undefined

      settings = {
        ...settings,
        ...(s.hero_title         && { hero_title:         s.hero_title }),
        ...(s.hero_subtitle      && { hero_subtitle:      s.hero_subtitle }),
        ...(s.hero_warning       && { hero_warning:       s.hero_warning }),
        ...(s.site_email         && { site_email:         s.site_email }),
        ...(s.site_phone         && { site_phone:         s.site_phone }),
        ...(s.whatsapp_number    && { whatsapp_number:    s.whatsapp_number }),
        ...(s.urgency_bar_text   && { urgency_bar_text:   s.urgency_bar_text }),
        ...(s.trust_strip_items  && { trust_strip_items:  s.trust_strip_items }),
        ...(s.social_proof_items && { social_proof_items: s.social_proof_items }),
        ...(s.footer_about_text  && { footer_about_text:  s.footer_about_text }),
        ...(s.cta_title          && { cta_title:          s.cta_title }),
        ...(s.cta_subtitle       && { cta_subtitle:       s.cta_subtitle }),
        ...(s.currency           && { currency:           s.currency }),
        ...(s.currency_symbol    && { currency_symbol:    s.currency_symbol }),
        ...(num('shipping_econt')      !== undefined && { shipping_econt:      num('shipping_econt')! }),
        ...(num('shipping_speedy')     !== undefined && { shipping_speedy:     num('shipping_speedy')! }),
        ...(num('free_shipping_above') !== undefined && { free_shipping_above: num('free_shipping_above')! }),
        // shipping_price = min(econt, speedy) — за CartSystem
        ...((s.shipping_econt || s.shipping_speedy) && {
          shipping_price: Math.min(
            s.shipping_econt  ? parseFloat(s.shipping_econt)  : 999,
            s.shipping_speedy ? parseFloat(s.shipping_speedy) : 999,
          ),
        }),
      }
    }

    // ── Atlas products ────────────────────────────────────────────────────────
    const atlasProducts: AtlasProduct[] = (productsRows || []).map((p: any) => {
      const variants: ProductVariant[] = (variantsRows || [])
        .filter((v: any) => v.product_id === p.id)
        .map((v: any) => ({
          id: v.id, product_id: v.product_id, label: v.label,
          size_liters:     parseFloat(v.size_liters),
          price:           parseFloat(v.price),
          compare_price:   parseFloat(v.compare_price || v.price),
          price_per_liter: parseFloat(v.price_per_liter || (v.price / v.size_liters).toFixed(2)),
          stock:  v.stock  || 0,
          active: v.active !== false,
        }))
      const base = variants[0]
      return {
        id: p.id || p.slug, name: p.name, subtitle: p.subtitle || '',
        desc: p.description || '', badge: p.badge || 'Хит',
        emoji: p.emoji || '🌿', img: p.image_url || '',
        price:        base ? base.price         : parseFloat(p.price),
        comparePrice: base ? base.compare_price : parseFloat(p.compare_price || p.price),
        priceLabel:   base
          ? `${base.price.toFixed(2)} ${settings.currency_symbol}`
          : `${parseFloat(p.price).toFixed(2)} ${settings.currency_symbol}`,
        features: p.features || [],
        variants,
      }
    })

    // ── Affiliate products ────────────────────────────────────────────────────
    const affiliateProducts: AffiliateProduct[] = (affiliateRows || []).map((p: any) => ({
      ...p,
      bullets:        Array.isArray(p.bullets) ? p.bullets : (p.features || []),
      emoji:          p.emoji          || '',
      badge_text:     p.badge_text     || p.badge || '',
      badge_color:    p.badge_color    || p.color || '',
      category_label: p.category_label || p.subtitle || '',
      tag_text:       p.tag_text       || '',
      color:          p.color          || '#16a34a',
    }))

    // ── Category links ────────────────────────────────────────────────────────
    const categoryLinks: CategoryLink[] = (categoryRows || []).map((c: any) => ({
      ...c,
      emoji: c.emoji || c.icon || '🌿',
      href:  c.href  || c.link || '#',
      slug:  c.slug  || c.id,
      color: c.color || CAT_COLORS[c.partner || 'default'] || CAT_COLORS.default,
    }))

    // ── Handbooks ─────────────────────────────────────────────────────────────
    const handbooks: Handbook[] = handbookRows?.length
      ? handbookRows.map((n: any) => ({
          slug:     n.slug,
          title:    n.title,
          subtitle: n.subtitle || '',
          emoji:    n.emoji || (n.category === 'domati' ? '🍅' : '🌿'),
          color:    n.color || (n.category === 'domati' ? '#dc2626' : '#16a34a'),
          bg:       n.bg    || (n.category === 'domati'
            ? 'linear-gradient(135deg,#dc2626,#b91c1c)'
            : 'linear-gradient(135deg,#16a34a,#166534)'),
          badge:     n.badge || n.category,
          image_url: n.cover_image_url || '',
        }))
      : DEFAULT_HANDBOOKS

    // ── Special sections ──────────────────────────────────────────────────────
    const specialSections: SpecialSection[] = (specialSectionsRows || []).map((s: any) => ({
      id:          s.id,
      slug:        s.slug        || '',
      title:       s.title       || '',
      subtitle:    s.subtitle    || '',
      description: s.description || '',
      badge_text:  s.badge_text  || '',
      button_text: s.button_text || '👉 Разгледай',
      button_url:  s.button_url  || '#',
      bullets:     Array.isArray(s.bullets) ? s.bullets : [],
      image_url:   s.image_url   || '',
      logo_url:    s.logo_url    || '',
      active:      s.active !== false,
      sort_order:  s.sort_order  || 0,
    }))

    // ── FAQ categories ────────────────────────────────────────────────────────
    const faqCategories: FaqCategory[] =
      faqCategoryRows?.length
        ? (faqCategoryRows as FaqCategory[])
        : DEFAULT_FAQ_CATEGORIES

    // ── FAQ items (само активни) ──────────────────────────────────────────────
    const faq: FaqItem[] = (faqRows || []).map((f: any) => ({
      id:         f.id,
      question:   f.question,
      answer:     f.answer,
      category:   f.category,
      sort_order: f.sort_order,
      active:     f.active !== false,
    }))

    const promoBanners: PromoBanner[] = (promoBannersRows || []).filter((b: any) => {
      const now = new Date()
      const starts = b.starts_at ? new Date(b.starts_at) : null
      const ends   = b.ends_at   ? new Date(b.ends_at)   : null
      return (!starts || starts <= now) && (!ends || ends >= now)
    })

    return {
      settings, atlasProducts, affiliateProducts,
      categoryLinks,
      promoBanners,
      testimonials: (testimonialRows || []).map((t: any) => ({
        id:          t.id,
        name:        t.name        || '',
        location:    t.location    || '',
        text:        t.text        || '',
        rating:      t.rating      || 5,
        avatar_url:  t.avatar_url  || '',
        product:     t.product     || '',
        review_date: t.review_date || '',
      })),
      faq,
      faqCategories,
      handbooks, specialSections,
    }
  } catch (err) {
    console.error('[getPageData] fatal:', err)
    return {
      settings:          DEFAULT_SETTINGS,
      atlasProducts:     [],
      affiliateProducts: [],
      categoryLinks:     [],
      promoBanners:      [],
      testimonials:      [],
      faq:               [],
      faqCategories:     DEFAULT_FAQ_CATEGORIES,
      handbooks:         DEFAULT_HANDBOOKS,
      specialSections:   [],
    }
  }
}

// ─── SERVER COMPONENT ──────────────────────────────────────────────────────────
export default async function HomePage() {
  const {
    settings, atlasProducts, affiliateProducts,
    categoryLinks, promoBanners, testimonials, faq, faqCategories, handbooks, specialSections,
  } = await getPageData()

  const trustItems  = safeJson<{ icon: string; text: string; sub?: string }[]>(settings.trust_strip_items, [])
  const socialItems = safeJson<{ number: string; label: string }[]>(settings.social_proof_items, [])

  return (
    <>
      <style suppressHydrationWarning>{`
        .hb-input::placeholder { color: rgba(255,255,255,.45) }
        .hb-input { color: #fff !important }
        .hb-input:focus { border-color: #86efac !important; outline: none }
      `}</style>

      {/* ── URGENCY BAR ────────────────────────────────────────────────────── */}
      <div className="urgency-bar">{parseBold(settings.urgency_bar_text)}</div>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <HeaderClient
        shippingPrice={settings.shipping_price}
        freeShippingAbove={settings.free_shipping_above}
      />

      {/* ══ HERO ═══════════════════════════════════════════════════════════════ */}
      <section className="hero">
        {/* Декоративни елементи */}
        <div className="hero-leaf hero-leaf--tl" />
        <div className="hero-leaf hero-leaf--br" />
        <div className="hero-grain" />

        <div className="hero-inner">
          <div className="hero-left">

            {/* Trust badge */}
            <div className="trust-badge-new">
              <div className="tb-shimmer-top" />
              <div className="tb-avatar-wrap">
                <SafeImg
                  src={`${CDN}/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg`}
                  alt="Denny Angelow"
                  className="tb-avatar-img"
                  fallbackEmoji="🌿"
                />
                <div className="tb-avatar-fallback">DA</div>
                <div>
                  <div className="tb-handle">@dennyangelow</div>
                  <div className="tb-handle-sub">Агро Консултант</div>
                </div>
              </div>
              <div className="tb-stats">
                <div className="tb-stat">
                  <div className="tb-stat-num">{socialItems.find(s => s.label === 'последователи')?.number || '85K'}+</div>
                  <div className="tb-stat-label">последователи</div>
                </div>
                <div className="tb-stat">
                  <div className="tb-stat-num">{socialItems.find(s => s.label === 'изтеглени')?.number || '6 000'}+</div>
                  <div className="tb-stat-label">изтеглени</div>
                </div>
                <div className="tb-stat">
                  <div className="tb-stat-num">8+ год.</div>
                  <div className="tb-stat-label">опит</div>
                </div>
              </div>
              <div className="tb-live">
                <span className="tb-dot" />
                <span className="tb-live-label">Live</span>
              </div>
            </div>

            {/* Заглавие */}
            <h1 className="hero-title">{settings.hero_title}</h1>

            {/* Разделител */}
            <div className="hero-divider" />

            {/* Subtitle */}
            {settings.hero_subtitle && (
              <p className="hero-subtitle-text">{parseBold(settings.hero_subtitle)}</p>
            )}

            {/* Warning */}
            {settings.hero_warning && (
              <div className="hero-warning">
                <span className="hero-warning-icon">⚠️</span>
                <span>{settings.hero_warning}</span>
              </div>
            )}

            {/* Какво ще научиш */}
            <div className="hero-learn">
              <div className="hero-learn-title">{"📖 От наръчниците ще научиш:"}</div>
              <div className="hero-learn-grid">
                <div className="hero-learn-item">
                  <span className="hero-learn-icon" style={{ background: '#fef3c7' }}>{"📅"}</span>
                  <span>{"Кога и как да садиш и третираш"}</span>
                </div>
                <div className="hero-learn-item">
                  <span className="hero-learn-icon" style={{ background: '#dcfce7' }}>{"🌿"}</span>
                  <span>{"Кои торове дават реален резултат"}</span>
                </div>
                <div className="hero-learn-item">
                  <span className="hero-learn-icon" style={{ background: '#fee2e2' }}>{"🛡️"}</span>
                  <span>{"Как да предпазиш от болести"}</span>
                </div>
                <div className="hero-learn-item">
                  <span className="hero-learn-icon" style={{ background: '#e0f2fe' }}>{"💧"}</span>
                  <span>{"Напояване и поливен режим"}</span>
                </div>
                <div className="hero-learn-item">
                  <span className="hero-learn-icon" style={{ background: '#f3e8ff' }}>{"🪴"}</span>
                  <span>{"Подвързване и оформяне на стъблото"}</span>
                </div>
                <div className="hero-learn-item">
                  <span className="hero-learn-icon" style={{ background: '#dcfce7' }}>{"🏆"}</span>
                  <span>{"Стъпки за рекордна реколта"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-right">
            <HandbooksPanel handbooks={handbooks} />
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ────────────────────────────────────────────────────── */}
      {trustItems.length > 0 && (
        <div className="trust-strip">
          <div className="trust-strip-inner">
            {trustItems.map(({ icon, text, sub }) => (
              <div key={text} className="trust-item">
                <div className="trust-item-icon-bg">
                  <span className="trust-item-icon">{icon}</span>
                </div>
                <div className="trust-item-text">
                  <span className="trust-item-label">{text}</span>
                  {sub && <span className="trust-item-sub">{sub}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ CATEGORIES ═════════════════════════════════════════════════════════ */}
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
                  <a
                    href={c.href} target="_blank" rel="noopener noreferrer"
                    className="cat-card cat-card--hover"
                    data-partner={c.partner} data-slug={c.slug}
                    style={{ '--cat-color': color } as React.CSSProperties}
                  >
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

      {/* ══ AFFILIATE PRODUCTS ═════════════════════════════════════════════════ */}
      {affiliateProducts.filter(p => p.partner === 'agroapteki').length > 0 && (
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
              const cardColor  = p.color       || CAT_COLORS[p.partner] || '#16a34a'
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
                      <a
                        href={p.affiliate_url} target="_blank" rel="noopener noreferrer"
                        data-partner={p.partner} data-slug={p.slug}
                        style={{ display: 'block', textAlign: 'center', background: cardColor, color: '#fff', padding: '13px 20px', borderRadius: 12, textDecoration: 'none', fontWeight: 800, fontSize: 14.5, marginTop: 'auto' }}
                      >
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



      {/* ══ ATLAS TERRA ════════════════════════════════════════════════════════ */}
      {atlasProducts.length > 0 && (
        <section id="atlas" style={{ padding: '72px 0 60px', background: 'linear-gradient(180deg, #f9fafb 0%, #ffffff 100%)', position: 'relative', overflow: 'hidden' }}>
          {/* Subtle background pattern */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(22,163,74,.04) 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

          <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
            <FadeIn>
              {/* Section label */}
              <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #d1fae5', color: '#065f46', fontSize: 11, fontWeight: 800, padding: '6px 16px', borderRadius: 100, marginBottom: 18, boxShadow: '0 2px 8px rgba(22,163,74,.10)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                  Директно от производителя
                </div>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px, 4.5vw, 52px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 16 }}>
                  Atlas Terra — Професионална Серия
                </h2>
                <p style={{ fontSize: 16, color: '#4b5563', maxWidth: 600, margin: '0 auto 24px', lineHeight: 1.7 }}>
                  Три специализирани биостимулаторни формули, разработени от <strong>български учени</strong>. Сертифицирани за екологично земеделие — Екосхема 3.
                </p>

                {/* Trust indicators row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                  {[
                    { icon: '🏭', text: 'Произведено в България' },
                    { icon: '🌿', text: 'Сертифицирано еко' },
                    { icon: '🔬', text: 'Разработено от учени' },
                    { icon: '📊', text: 'Безплатен анализ при 60л+' },
                  ].map(item => (
                    <div key={item.text} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 100, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, color: '#374151', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                      <span style={{ fontSize: 15 }}>{item.icon}</span>
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* ── BAR PROMO BANNERS — елегантни ленти под заглавието ── */}
            {promoBanners.filter(b => b.display_style !== 'featured').length > 0 && (
              <FadeIn>
                <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {promoBanners.filter(b => b.display_style !== 'featured').map((banner) => (
                    <div key={banner.id} style={{
                      background: banner.color,
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'stretch',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: `0 3px 14px ${banner.color}44`,
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}>
                      <div style={{ width: 3, background: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)', pointerEvents: 'none' }} />

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', flex: 1, position: 'relative' }}>
                        <span style={{ fontSize: 18, flexShrink: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}>{banner.icon}</span>
                        <span style={{ fontSize: 13.5, color: banner.text_color, fontWeight: 500, lineHeight: 1.45, flex: 1 }}>
                          {(banner.message || '').split(/\*\*(.*?)\*\*/g).map((p, j) =>
                            j % 2 === 1
                              ? <strong key={j} style={{ fontWeight: 800 }}>{p}</strong>
                              : <span key={j}>{p}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </FadeIn>
            )}

            <div style={{ position: 'relative', zIndex: 10 }}>
              <CartSystem
                atlasProducts={atlasProducts}
                shippingPrice={settings.shipping_price}
                freeShippingAbove={settings.free_shipping_above}
                siteEmail={settings.site_email}
                sitePhone={settings.site_phone}
                currencySymbol={settings.currency_symbol}
              />
            </div>

            {/* Featured promo banners — луксозни карти под продуктите */}
            {promoBanners.filter(b => b.display_style === 'featured').length > 0 && (
              <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                {promoBanners.filter(b => b.display_style === 'featured').map(banner => {
                  const parseBoldLocal = (text: string) =>
                    text.split(/\*\*(.*?)\*\*/g).map((p, i) =>
                      i % 2 === 1
                        ? <strong key={i} style={{ color: banner.text_color, fontWeight: 900 }}>{p}</strong>
                        : <span key={i}>{p}</span>
                    )
                  const parts = banner.message.split('\n')
                  const mainText = parts[0] || banner.message
                  const subText  = parts.slice(1).join('\n') || ''
                  return (
                    <FadeIn key={banner.id}>
                      <div style={{
                        background: banner.color,
                        borderRadius: 20,
                        padding: 0,
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: `0 12px 40px ${banner.color}55, 0 2px 8px rgba(0,0,0,0.08)`,
                        border: '1px solid rgba(255,255,255,0.18)',
                      }}>
                        {/* Top gradient accent */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.5), rgba(255,255,255,0.1))', pointerEvents: 'none' }} />
                        {/* Decorative circles */}
                        <div style={{ position: 'absolute', right: -50, top: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', right: 40, bottom: -70, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', left: -20, bottom: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
                        {/* Shimmer */}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(255,255,255,0.03) 100%)', pointerEvents: 'none' }} />

                        <div style={{ padding: '18px 22px 16px', position: 'relative' }}>
                          {/* Header row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: subText ? 8 : 0 }}>
                            {/* Icon */}
                            <div style={{
                              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                              background: 'rgba(255,255,255,0.18)',
                              backdropFilter: 'blur(12px)',
                              border: '1.5px solid rgba(255,255,255,0.28)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 22,
                              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                            }}>{banner.icon}</div>

                            {/* Main text */}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: banner.text_color, lineHeight: 1.4, letterSpacing: '-0.01em' }}>
                                {parseBoldLocal(mainText)}
                              </div>
                            </div>
                          </div>

                          {/* Sub text */}
                          {subText && (
                            <div style={{
                              marginLeft: 58,
                              fontSize: 12,
                              color: banner.text_color,
                              opacity: 0.68,
                              lineHeight: 1.5,
                              fontStyle: 'italic',
                            }}>
                              {parseBoldLocal(subText)}
                            </div>
                          )}
                        </div>
                      </div>
                    </FadeIn>
                  )
                })}
              </div>
            )}

            {/* Bottom trust strip — елегантна лента */}
            <FadeIn>
              <div style={{
                marginTop: 20,
                borderRadius: 18,
                background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
                overflow: 'hidden',
                position: 'relative',
              }}>
                {/* Top accent line */}
                <div style={{ height: 3, background: 'linear-gradient(90deg, #d1fae5, #16a34a, #d1fae5)', position: 'absolute', top: 0, left: 0, right: 0 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0, padding: '14px 20px 12px' }}>
                  {[
                    { icon: '🚚', text: `Безплатна доставка над ${settings.free_shipping_above} ${settings.currency_symbol}`, color: '#16a34a' },
                    { icon: '💵', text: 'Плащане при доставка', color: '#2563eb' },
                    { icon: '⚡', text: 'Експресна пратка 1–2 дни', color: '#d97706' },
                    { icon: '📞', text: 'Лична консултация безплатно', color: '#7c3aed' },
                  ].map((item, idx) => (
                    <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px', position: 'relative' }}>
                      {idx > 0 && <div style={{ position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 1, background: '#e5e7eb' }} />}
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: item.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <span style={{ fontSize: 12.5, color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </section>
      )}

      {/* ══ СПЕЦИАЛНИ СЕКЦИИ (от special_sections таблица) ═══════════════════ */}
      {specialSections.map(sec => (
        <section key={sec.slug} id={sec.slug} className="ginegar-section">
          <div className="ginegar-glow" />
          <div className="ginegar-dots" />
          <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <FadeIn>
              <div className="ginegar-inner">

                <div className="ginegar-text">
                  {sec.badge_text && (
                    <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '6px 16px', borderRadius: 30, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'inline-block', marginBottom: 16 }}>
                      {sec.badge_text}
                    </span>
                  )}
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#fff', fontSize: 'clamp(26px, 3.5vw, 38px)', margin: '0 0 14px', fontWeight: 800, lineHeight: 1.15 }}>
                    {sec.title}
                  </h2>
                  {sec.subtitle && (
                    <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
                      {sec.subtitle}
                    </p>
                  )}
                  {sec.description && (
                    <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.8, marginBottom: sec.bullets.length > 0 ? 22 : 28 }}>
                      {sec.description}
                    </p>
                  )}
                  {sec.bullets.length > 0 && (
                    <ul style={{ margin: '0 0 28px', padding: 0, listStyle: 'none' }}>
                      {sec.bullets.map((f, bi) => (
                        <li key={bi} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, padding: '7px 0', display: 'flex', gap: 11, borderBottom: '1px solid rgba(255,255,255,0.07)', alignItems: 'flex-start' }}>
                          <span style={{ background: '#16a34a', color: '#fff', width: 17, height: 17, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  {sec.button_url && sec.button_text && (
                    <a href={sec.button_url} target="_blank" rel="noopener noreferrer" className="ginegar-btn">
                      {sec.button_text}
                    </a>
                  )}
                </div>

                <div className="ginegar-img-wrap">
                  {/* Decorative glow — always behind */}
                  <div style={{ position: 'absolute', inset: -24, background: 'radial-gradient(circle, rgba(22,163,74,0.18), transparent 70%)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }} />

                  {/* Главна снимка */}
                  {sec.image_url && sec.image_url.startsWith('http') && (
                    <img
                      src={sec.image_url}
                      alt={sec.title}
                      style={{ width: '100%', maxWidth: 260, borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1, display: 'block', objectFit: 'contain' }}
                    />
                  )}

                  {/* Лого — бяла елегантна карта за четимост */}
                  {sec.logo_url && sec.logo_url.startsWith('http') && (
                    <div style={{
                      marginTop: 12,
                      position: 'relative',
                      zIndex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#ffffff',
                      borderRadius: 18,
                      padding: '14px 28px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
                    }}>
                      <SafeImg
                        src={sec.logo_url}
                        alt={`${sec.title} logo`}
                        fallbackEmoji=""
                        style={{ height: 52, width: 'auto', maxWidth: 180, objectFit: 'contain', display: 'block' }}
                      />
                    </div>
                  )}
                </div>

              </div>
            </FadeIn>
          </div>
        </section>
      ))}

      {testimonials.length > 0 && (
        <section id="testimonials" style={{ backgroundColor: '#f7f7f5', padding: '72px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <FadeIn>
              <div className="section-head">
                <span className="s-tag" style={{ color: '#059669' }}>Отзиви</span>
                <h2 className="s-title" style={{ color: '#111827' }}>Какво казват фермерите</h2>
                <p className="s-desc" style={{ color: '#6b7280' }}>
                  Реални резултати от реални хора — без филтри
                </p>
                {/* Rating summary pill */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 100, padding: '9px 20px', marginTop: 20, boxShadow: '0 2px 10px rgba(0,0,0,.06)', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {[1,2,3,4,5].map(n => <span key={n} style={{ color: '#f59e0b', fontSize: 15 }}>★</span>)}
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 15, color: '#111' }}>5.0</span>
                  <span style={{ color: '#e5e7eb' }}>|</span>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>{testimonials.length} верифицирани отзива</span>
                  <span style={{ fontSize: 11, color: '#059669', fontWeight: 700, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 100, padding: '2px 10px' }}>✓ Проверени</span>
                </div>
              </div>
            </FadeIn>

            <div className="testimonials-grid">
              {testimonials.map((t, i) => {
                // Colorful avatars based on first letter
                const avatarPalette: Record<string, string> = {
                  А:'#2563eb',Б:'#7c3aed',В:'#db2777',Г:'#ea580c',Д:'#16a34a',
                  Е:'#0891b2',Ж:'#dc2626',З:'#65a30d',И:'#4f46e5',К:'#b45309',
                  Л:'#0d9488',М:'#9333ea',Н:'#c2410c',О:'#1d4ed8',П:'#15803d',
                  Р:'#7e22ce',С:'#be123c',Т:'#0369a1',У:'#a16207',Ф:'#166534',
                  Х:'#9f1239',Ц:'#1e40af',Ч:'#6d28d9',Ш:'#b91c1c',Щ:'#0f766e',
                  default:'#374151',
                }
                const firstLetter = (t.name?.[0] || '').toUpperCase()
                const avatarBg = avatarPalette[firstLetter] || avatarPalette.default

                return (
                  <FadeIn key={t.id} delay={i * 70}>
                    <article className="testimonial-card">
                      <span className="testimonial-quote-mark" aria-hidden="true">"</span>

                      {/* Stars + verified */}
                      <div className="testimonial-stars">
                        {Array.from({ length: t.rating || 5 }).map((_, j) => (
                          <span key={j} className="star" aria-hidden="true">★</span>
                        ))}
                        <span className="testimonial-verified">✓ Верифициран</span>
                      </div>

                      {/* Review text */}
                      <blockquote style={{ margin: 0 }}>
                        <p className="testimonial-text">„{t.text}"</p>
                      </blockquote>

                      {/* Product badge */}
                      {t.product && (
                        <span className="testimonial-product-badge">🌿 {t.product}</span>
                      )}

                      {/* Author */}
                      <div className="testimonial-author">
                        {t.avatar_url ? (
                          <img src={t.avatar_url} alt={t.name} className="testimonial-avatar" loading="lazy" />
                        ) : (
                          <div className="testimonial-avatar-fallback" style={{ background: avatarBg }}>
                            {firstLetter || '?'}
                          </div>
                        )}
                        <div>
                          <div className="testimonial-author-name">{t.name}</div>
                          <div className="testimonial-author-meta">
                            {t.location && <span className="testimonial-location">📍 {t.location}</span>}
                            {t.location && t.review_date && <span className="testimonial-meta-dot" />}
                            {t.review_date && <span className="testimonial-date">{t.review_date}</span>}
                          </div>
                        </div>
                      </div>
                    </article>
                  </FadeIn>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══ FAQ ════════════════════════════════════════════════════════════════ */}
      {/* ✅ Подаваме и faqCategories за да се показват табовете с категории */}
      {faq.length > 0 && <FaqSection faq={faq} categories={faqCategories} />}

     

      {/* ══ FOOTER ═════════════════════════════════════════════════════════════ */}
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
                { label: '🌱 AtlasAgro.eu',   href: 'https://atlasagro.eu/' },
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
              {settings.whatsapp_number && (
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
                  💬 <a href={`https://wa.me/${settings.whatsapp_number}`} target="_blank" rel="noopener" style={{ color: '#86efac', fontWeight: 600, textDecoration: 'none' }}>WhatsApp</a>
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
