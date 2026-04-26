// app/page.tsx  ←  SERVER COMPONENT (без 'use client')
// v3 — SEO подобрения:
//   ✅ Atlas Terra (собствени продукти) — пълна Product schema с цена, наличност, variants
//   ✅ image_alt за всички снимки — взима се от БД (products.image_alt, special_sections.image_alt/logo_alt)
//   ✅ Affiliate линкове — добавен rel="nofollow sponsored"
//   ✅ Hero avatar alt — взима се от settings (author_name)
//   ✅ FAQ → FAQPage schema директно в server component

import { Metadata } from 'next'
import { CDN, AFF } from '@/lib/marketing-data'
import { HeaderClient } from '@/components/client/HeaderClient'
import { HandbooksPanel } from '@/components/client/HandbooksPanel'
import { CartSystem } from '@/components/client/CartSystem'
import { FaqSection } from '@/components/client/FaqSection'
import { FadeIn } from '@/components/marketing/FadeIn'
import { SafeImg } from '@/components/client/SafeImg'
import { AffiliateSection, CategoryLinksSection } from '@/components/client/AffiliateSection'
import { SpecialSectionButton } from '@/components/client/SpecialSectionButton'
import './homepage.css'

export const revalidate = 0

const BASE_URL = 'https://dennyangelow.com'

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
  image_alt?: string // [SEO] ново
  description?: string; downloads_count?: number; avg_rating?: number; reviews_count?: number
}

interface ProductVariant {
  id: string; product_id: string; label: string
  size_liters: number; price: number; compare_price: number
  price_per_liter: number; stock: number; active: boolean
}

interface AtlasProduct {
  id: string; name: string; subtitle: string; desc: string
  badge: string; emoji: string; img: string
  // [SEO] нови полета
  image_alt: string
  seo_title: string
  seo_description: string
  seo_keywords: string
  price: number; comparePrice: number; priceLabel: string
  features: string[]; variants?: ProductVariant[]
}

interface AffiliateProduct {
  id: string; slug: string; name: string; subtitle: string
  description: string; bullets: string[]; image_url: string
  image_alt: string // [SEO] ново
  affiliate_url: string; partner: string; emoji: string
  badge_text: string; tag_text: string; color: string
  badge_color: string; category_label: string
  seo_title?: string; seo_description?: string; seo_keywords?: string
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
  image_alt: string // [SEO] ново
  logo_alt: string  // [SEO] ново
  active: boolean; sort_order: number
  partner?: string
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
  { slug: 'super-domati',            title: 'Тайните на Едрите Домати',    subtitle: 'Над 6 000 изтеглени', emoji: '🍅', color: '#dc2626', bg: 'linear-gradient(135deg,#dc2626,#b91c1c)', badge: 'Домати', image_alt: 'Безплатен наръчник за отглеждане на едри домати' },
  { slug: 'krastavici-visoki-dobivy', title: 'Краставици за Високи Добиви', subtitle: 'Новост',              emoji: '🥒', color: '#16a34a', bg: 'linear-gradient(135deg,#16a34a,#166534)', badge: 'Краставици', image_alt: 'Безплатен наръчник за краставици с рекордни добиви' },
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
      { data: clicksRows,          error: e12 },
    ] = await Promise.all([
      supabase.from('settings').select('key,value'),
      supabase.from('products').select('*').eq('active', true).order('sort_order'),
      supabase.from('product_variants').select('*').eq('active', true).order('sort_order'),
      supabase.from('affiliate_products').select('*').eq('active', true).order('sort_order'),
      supabase.from('category_links').select('*').eq('active', true).order('sort_order'),
      supabase.from('testimonials').select('*').order('sort_order').limit(9),
      supabase.from('promo_banners').select('*').eq('active', true).order('sort_order'),
      supabase.from('faq').select('*').eq('active', true).order('sort_order'),
      supabase.from('naruchnici').select('*').eq('active', true).order('sort_order'),
      supabase.from('special_sections').select('*').eq('active', true).order('sort_order'),
      supabase.from('faq_categories').select('*').order('sort_order'),
      supabase.from('affiliate_clicks').select('product_slug').limit(5000),
    ])

    ;[e1,e2,e3,e4,e5,e6,e7,e8,e9,e10,e11,e12].forEach((e, i) => {
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
        id:           p.id || p.slug,
        name:         p.name,
        subtitle:     p.subtitle || '',
        desc:         p.description || '',
        badge:        p.badge || 'Хит',
        emoji:        p.emoji || '🌿',
        img:          p.image_url || '',
        // [SEO] нови полета от БД
        image_alt:       p.image_alt       || `${p.name} — ${p.subtitle || 'биостимулатор Atlas Terra'}`,
        seo_title:       p.seo_title       || '',
        seo_description: p.seo_description || '',
        seo_keywords:    p.seo_keywords    || '',
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
      // [SEO] alt с fallback
      image_alt:      p.image_alt      || `${p.name} — ${p.category_label || p.subtitle || 'агро продукт'}`,
      seo_title:      p.seo_title      || null,
      seo_description:p.seo_description|| null,
      seo_keywords:   p.seo_keywords   || null,
    }))

    // ── Top 6 affiliate products by click count ──────────────────────────────
    // Брои кликовете по slug и сортира низходящо → взима топ 6
    const clickCountMap: Record<string, number> = {}
    ;(clicksRows || []).forEach((row: any) => {
      if (row.product_slug) {
        clickCountMap[row.product_slug] = (clickCountMap[row.product_slug] || 0) + 1
      }
    })

    // Сортира всички активни продукти по брой кликове (най-много → най-малко)
    const affiliateProductsSortedByClicks = [...affiliateProducts].sort((a, b) => {
      const ca = clickCountMap[a.slug] || 0
      const cb = clickCountMap[b.slug] || 0
      return cb - ca
    })
    // Топ 6 за началната страница — ако няма кликове, взима първите 6 по sort_order
    const top6AffiliateProducts = affiliateProductsSortedByClicks.slice(0, 6)

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
          // [SEO] alt от БД с fallback
          image_alt: n.image_alt || `${n.title} — безплатен PDF наръчник от Denny Angelow`,
          description:    n.description || '',
          downloads_count: n.downloads_count || 0,
          avg_rating:      n.avg_rating || null,
          reviews_count:   n.reviews_count || null,
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
      // [SEO] alt от БД с fallback
      image_alt:   s.image_alt   || s.title || '',
      logo_alt:    s.logo_alt    || `${s.title} лого`,
      active:      s.active !== false,
      sort_order:  s.sort_order  || 0,
      partner:     s.partner     || null,
    }))

    // ── FAQ ────────────────────────────────────────────────────────
    const faqCategories: FaqCategory[] = faqCategoryRows?.length ? (faqCategoryRows as FaqCategory[]) : DEFAULT_FAQ_CATEGORIES
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
      settings, atlasProducts, affiliateProducts, top6AffiliateProducts,
      categoryLinks, promoBanners,
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
      faq, faqCategories, handbooks, specialSections,
    }
  } catch (err) {
    console.error('[getPageData] fatal:', err)
    return {
      settings:          DEFAULT_SETTINGS,
      atlasProducts:     [],
      affiliateProducts: [],
      top6AffiliateProducts: [],
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

// ─── SEO Defaults ──────────────────────────────────────────────────────────────
const SEO_DEFAULTS = {
  title:             'Denny Angelow — Домати, Краставици, Торове и Агро Наръчници',
  description:       'Безплатни PDF наръчници за домати и краставици. Биостимулатори Atlas Terra, Ginegar найлон. Над 6 500 фермери вече използват съветите на Дени Ангелов — агро консултант с 8+ години опит.',
  keywords:          'домати, отглеждане на домати, торене на домати, болести по домати, мана по домати, Tuta absoluta, върхово гниене на домати, домати в оранжерия, наръчник за домати, краставици, отглеждане на краставици, торене на краставици, наръчник за краставици, Atlas Terra, биостимулатори, органично торене, течни торове, хуминови киселини, аминокиселини за растения, NPK торове, Амалгерол, Калитех, Кристалон зелен, Прев-Голд, Ридомил Голд, Синейс 480, мана по растения, трипс по домати, белокрилки, акари, фунгицид за домати, инсектицид биологичен, без карантина, оранжерия, найлон за оранжерия, Ginegar, израелски найлон, полиетилен за оранжерия, поливни системи, капково напояване, земеделие България, агро консултант, Denny Angelow, безплатен агро наръчник, рекордна реколта, органично земеделие, биологично земеделие, фермери България',
  og_title:          'Denny Angelow — Безплатни Наръчници за Домати и Краставици',
  og_description:    'Изтегли безплатно и научи как да отгледаш едри, здрави домати и краставици. Над 6 500 фермери вече го използват.',
  og_image:          '/og-image.jpg',
  og_image_alt:      'Denny Angelow — Агро Наръчници за Домати и Краставици',
  twitter_title:     'Denny Angelow — Безплатни Агро Наръчници',
  twitter_description: 'Домати, краставици, торене, болести, оранжерии. Изтегли безплатно.',
  twitter_creator:   '@dennyangelow',
  author_name:       'Denny Angelow',
  author_job:        'Агро Консултант',
  site_name:         'Denny Angelow',
  locale:            'bg_BG',
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata(): Promise<Metadata> {
  const { handbooks, affiliateProducts, settings } = await getPageData()

  const s = settings as any

  const narKeywords  = handbooks.map(n => n.title)
  const prodKeywords = affiliateProducts.map(p => p.name)
  const prodSeoKw    = affiliateProducts.flatMap(p =>
    p.seo_keywords?.split(',').map(k => k.trim()).filter(Boolean) || []
  )
  const baseKeywords = (s.seo_keywords || SEO_DEFAULTS.keywords)
    .split(',').map((k: string) => k.trim()).filter(Boolean)

  const totalDownloads = handbooks.reduce((sum, n) => sum + (n.downloads_count || 0), 0)
  const displayCount   = totalDownloads > 0 ? totalDownloads.toLocaleString('bg') : '6 500'

  const title       = s.seo_title       || SEO_DEFAULTS.title
  const description = (s.seo_description || SEO_DEFAULTS.description).replace('{count}', displayCount)
  const ogTitle       = s.og_title         || SEO_DEFAULTS.og_title
  const ogDescription = (s.og_description  || SEO_DEFAULTS.og_description).replace('{count}', displayCount)
  const ogImage       = s.og_image
    ? (s.og_image.startsWith('http') ? s.og_image : `${BASE_URL}${s.og_image}`)
    : `${BASE_URL}${SEO_DEFAULTS.og_image}`
  const ogImageAlt    = s.og_image_alt     || SEO_DEFAULTS.og_image_alt
  const twTitle       = s.twitter_title    || SEO_DEFAULTS.twitter_title
  const twDescription = s.twitter_description || SEO_DEFAULTS.twitter_description
  const twCreator     = s.twitter_creator  || SEO_DEFAULTS.twitter_creator
  const siteName      = s.site_name        || SEO_DEFAULTS.site_name
  const locale        = s.locale           || SEO_DEFAULTS.locale

  return {
    title,
    description,
    keywords: [...new Set([...baseKeywords, ...narKeywords, ...prodKeywords, ...prodSeoKw])].filter(Boolean),
    authors:  [{ name: s.author_name || SEO_DEFAULTS.author_name, url: BASE_URL }],
    creator:   s.author_name || SEO_DEFAULTS.author_name,
    publisher: s.site_name   || SEO_DEFAULTS.site_name,
    alternates: { canonical: BASE_URL },
    openGraph: {
      title:       ogTitle,
      description: ogDescription,
      url:         BASE_URL,
      siteName,
      locale,
      type:        'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogImageAlt }],
    },
    twitter: {
      card:        'summary_large_image',
      title:       twTitle,
      description: twDescription,
      images:      [ogImage],
      creator:     twCreator,
    },
    robots: {
      index: true, follow: true,
      googleBot: {
        index: true, follow: true,
        'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1,
      },
    },
    verification: {
      ...(s.google_site_verification ? { google: s.google_site_verification } : {}),
    },
  }
}

// ─── SERVER COMPONENT ──────────────────────────────────────────────────────────
export default async function HomePage() {
  const {
    settings, atlasProducts, affiliateProducts, top6AffiliateProducts,
    categoryLinks, promoBanners, testimonials, faq, faqCategories, handbooks, specialSections,
  } = await getPageData()

  const trustItems  = safeJson<{ icon: string; text: string; sub?: string }[]>(settings.trust_strip_items, [])
  const socialItems = safeJson<{ number: string; label: string }[]>(settings.social_proof_items, [])
  const totalDownloads = handbooks.reduce((s, n) => s + (n.downloads_count || 0), 0)

  // [SEO] author name за alt текст на hero аватара
  const authorName = (settings as any).author_name || SEO_DEFAULTS.author_name

  // ── Schema: CollectionPage ────────────────────────────────────────────────
  const collectionPageSchema = {
    '@context': 'https://schema.org',
    '@type':    'CollectionPage',
    name:       'Безплатни Агро Наръчници — Denny Angelow',
    description: 'Колекция от безплатни PDF наръчници за отглеждане на домати, краставици и зеленчуци в България.',
    url:         BASE_URL,
    inLanguage:  'bg',
    author: { '@type': 'Person', name: 'Denny Angelow', url: BASE_URL, jobTitle: 'Агро Консултант' },
    ...(totalDownloads > 0 ? {
      interactionStatistic: {
        '@type':              'InteractionCounter',
        interactionType:      'https://schema.org/DownloadAction',
        userInteractionCount: totalDownloads,
      },
    } : {}),
  }

  // ── Schema: ItemList — Наръчници ─────────────────────────────────────────
  const naruchnikListSchema = {
    '@context':    'https://schema.org',
    '@type':       'ItemList',
    name:          'Безплатни PDF Наръчници от Denny Angelow',
    description:   'Всички безплатни агро наръчници за домати, краставици и зеленчуци',
    url:           BASE_URL,
    numberOfItems: handbooks.length,
    itemListElement: handbooks.map((n, i) => ({
      '@type':    'ListItem',
      position:    i + 1,
      url:         `${BASE_URL}/naruchnik/${n.slug}`,
      name:        n.title,
      item: {
        '@type':             'Book',
        name:                 n.title,
        description:          n.description || '',
        url:                  `${BASE_URL}/naruchnik/${n.slug}`,
        image:                n.image_url || '',
        inLanguage:          'bg',
        isAccessibleForFree:  true,
        genre:               'Agriculture / Gardening',
        datePublished:       '2024-01-01',
        author:    { '@type': 'Person',       name: 'Denny Angelow', url: BASE_URL, jobTitle: 'Агро Консултант' },
        publisher: { '@type': 'Organization', name: 'Denny Angelow', url: BASE_URL },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'BGN', availability: 'https://schema.org/InStock' },
        ...(n.avg_rating && n.reviews_count ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: n.avg_rating, reviewCount: n.reviews_count, bestRating: 5, worstRating: 1,
          },
        } : {}),
        ...(n.downloads_count ? {
          interactionStatistic: {
            '@type':              'InteractionCounter',
            interactionType:      'https://schema.org/DownloadAction',
            userInteractionCount: n.downloads_count,
          },
        } : {}),
      },
    })),
  }

  // ── Schema: ItemList — Афилиейт продукти ─────────────────────────────────
  const productListSchema = affiliateProducts.length > 0 ? {
    '@context':    'https://schema.org',
    '@type':       'ItemList',
    name:          'Препоръчани Агро Продукти от Denny Angelow',
    description:   'Торове, биостимулатори и препарати препоръчани от агро консултант Denny Angelow',
    url:           BASE_URL,
    numberOfItems: affiliateProducts.length,
    itemListElement: affiliateProducts.map((p, i) => ({
      '@type':    'ListItem',
      position:    i + 1,
      name:        p.name,
      url:         p.affiliate_url || BASE_URL,
      item: {
        '@type':      'Product',
        name:          p.name,
        description:   p.seo_description || p.description || '',
        image:         p.image_url || '',
        url:           p.affiliate_url || BASE_URL,
        ...(p.seo_keywords ? { keywords: p.seo_keywords } : {}),
        brand: { '@type': 'Brand', name: p.partner || 'Agroapteki' },
        review: {
          '@type': 'Review',
          reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
          author: { '@type': 'Person', name: 'Denny Angelow', url: BASE_URL, jobTitle: 'Агро Консултант' },
          reviewBody: `Препоръчан от Denny Angelow — агро консултант с 8+ години опит в отглеждането на зеленчуци.`,
        },
        offers: {
          '@type':        'Offer',
          availability:   'https://schema.org/InStock',
          priceCurrency:  'BGN',
          seller: { '@type': 'Organization', name: 'Agroapteki', url: 'https://agroapteki.com' },
        },
      },
    })),
  } : null

  // ── [SEO] Schema: ItemList — Atlas Terra собствени продукти ──────────────
  // Пълна Product schema с реални цени, наличност и варианти
  const atlasProductsSchema = atlasProducts.length > 0 ? {
    '@context':    'https://schema.org',
    '@type':       'ItemList',
    name:          'Atlas Terra — Биостимулатори от Denny Angelow',
    description:   'Официален дистрибутор на Atlas Terra биостимулатори за земеделие в България',
    url:           `${BASE_URL}#atlas`,
    numberOfItems: atlasProducts.length,
    itemListElement: atlasProducts.map((p, i) => {
      // Взимаме най-ниската цена от вариантите (ако има)
      const activeVariants = (p.variants || []).filter(v => v.active && v.stock > 0)
      const minPrice = activeVariants.length > 0
        ? Math.min(...activeVariants.map(v => v.price))
        : p.price
      const maxPrice = activeVariants.length > 0
        ? Math.max(...activeVariants.map(v => v.price))
        : p.price
      const inStock = activeVariants.length > 0
        ? activeVariants.some(v => v.stock > 0)
        : (p.price !== null)

      return {
        '@type':    'ListItem',
        position:    i + 1,
        name:        p.name,
        url:         `${BASE_URL}#atlas`,
        item: {
          '@type':      'Product',
          name:          p.seo_title || p.name,
          description:   p.seo_description || p.desc || p.subtitle || '',
          image:         p.img || '',
          url:           `${BASE_URL}#atlas`,
          ...(p.seo_keywords ? { keywords: p.seo_keywords } : {}),
          brand: {
            '@type': 'Brand',
            name:    'Atlas Terra',
            url:     'https://atlasagro.eu',
          },
          manufacturer: {
            '@type': 'Organization',
            name:    'Atlas Agro',
            url:     'https://atlasagro.eu',
          },
          review: {
            '@type': 'Review',
            reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
            author: { '@type': 'Person', name: 'Denny Angelow', url: BASE_URL, jobTitle: 'Агро Консултант' },
            reviewBody: p.desc || `${p.name} — препоръчан биостимулатор от Denny Angelow за домати и краставици.`,
          },
          // Ако има варианти — AggregateOffer с минимална и максимална цена
          // Ако няма — единичен Offer
          ...(activeVariants.length > 1 ? {
            offers: {
              '@type':          'AggregateOffer',
              lowPrice:          minPrice?.toFixed(2),
              highPrice:         maxPrice?.toFixed(2),
              priceCurrency:    'EUR',
              offerCount:        activeVariants.length,
              availability:     inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              seller: {
                '@type': 'Organization',
                name:    'Denny Angelow',
                url:     BASE_URL,
              },
              offers: activeVariants.map(v => ({
                '@type':       'Offer',
                name:           v.label,
                price:          v.price.toFixed(2),
                priceCurrency: 'EUR',
                availability:  v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                seller: { '@type': 'Organization', name: 'Denny Angelow', url: BASE_URL },
              })),
            },
          } : {
            offers: {
              '@type':       'Offer',
              price:          (minPrice || 0).toFixed(2),
              priceCurrency: 'EUR',
              availability:  inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              seller: { '@type': 'Organization', name: 'Denny Angelow', url: BASE_URL },
            },
          }),
        },
      }
    }),
  } : null

  // ── [SEO] FAQPage schema директно в server component ─────────────────────
  const faqPageSchema = faq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: faq.map(f => ({
      '@type':          'Question',
      name:              f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text:    f.answer,
      },
    })),
  } : null

  return (
    <>
      {/* ── SEO Schema Scripts ── */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(naruchnikListSchema) }} />
      {productListSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productListSchema) }} />
      )}
      {/* [SEO] Atlas Terra Product schema */}
      {atlasProductsSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(atlasProductsSchema) }} />
      )}
      {/* [SEO] FAQPage schema */}
      {faqPageSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema) }} />
      )}

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
        <div className="hero-leaf hero-leaf--tl" />
        <div className="hero-leaf hero-leaf--br" />
        <div className="hero-grain" />

        <div className="hero-inner">
          <div className="hero-left">

            {/* Trust badge */}
            <div className="trust-badge-new">
              <div className="tb-shimmer-top" />
              <div className="tb-avatar-wrap">
                {/* [SEO] alt текст с author name */}
                <SafeImg
                  src={`${CDN}/687aa8144659d_504368576_24540238958894103_5234342802938640767_n.jpg`}
                  alt={`${authorName} — агро консултант с 8+ години опит`}
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

            <div className="hero-divider" />

            {settings.hero_subtitle && (
              <p className="hero-subtitle-text">{parseBold(settings.hero_subtitle)}</p>
            )}

            {settings.hero_warning && (
              <div className="hero-warning">
                <span className="hero-warning-icon">⚠️</span>
                <span>{settings.hero_warning}</span>
              </div>
            )}

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
            {trustItems.map(({ icon, text, sub }) => (
              <div key={`clone-${text}`} className="trust-item trust-item-clone" aria-hidden="true">
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
          <CategoryLinksSection links={categoryLinks} />
        </section>
      )}

      {/* ══ ATLAS TERRA ════════════════════════════════════════════════════════ */}
      {atlasProducts.length > 0 && (
        <section id="atlas" className="atlas-section-wrap" style={{ background: 'linear-gradient(180deg, #f9fafb 0%, #ffffff 100%)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(22,163,74,.04) 1px, transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

          <div className="atlas-inner-wrap" style={{ maxWidth: 1160, margin: '0 auto', position: 'relative' }}>
            <FadeIn>
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

                <div className="atlas-chips-grid">
                  {[
                    { icon: '🏭', text: 'Произведено в България' },
                    { icon: '🌿', text: 'Сертифицирано еко' },
                    { icon: '🔬', text: 'Разработено от учени' },
                    { icon: '📊', text: 'Безплатен анализ при 60л+' },
                  ].map(item => (
                    <div key={item.text} className="atlas-chip">
                      <span style={{ fontSize: 15 }}>{item.icon}</span>
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

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
              />
            </div>

            {/* Featured promo banners */}
            {promoBanners.filter(b => b.display_style === 'featured').length > 0 && (
              <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {promoBanners.filter(b => b.display_style === 'featured').map((banner) => {
                  const parts    = (banner.message || '').split(/\|\|/)
                  const mainText = parts[0]?.trim() || banner.message
                  const subText  = parts[1]?.trim() || ''
                  const parseBoldLocal = (t: string) =>
                    t.split(/\*\*(.*?)\*\*/g).map((p, j) =>
                      j % 2 === 1 ? <strong key={j} style={{ fontWeight: 800 }}>{p}</strong> : <span key={j}>{p}</span>
                    )
                  return (
                    <FadeIn key={banner.id}>
                      <div style={{
                        background:   banner.color,
                        borderRadius: 16,
                        overflow:     'hidden',
                        position:     'relative',
                        boxShadow:    `0 4px 20px ${banner.color}55`,
                        border:       '1px solid rgba(255,255,255,0.2)',
                        minHeight:    90,
                      }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.5), rgba(255,255,255,0.1))', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', right: -50, top: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', right: 40, bottom: -70, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', left: -20, bottom: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%, rgba(255,255,255,0.03) 100%)', pointerEvents: 'none' }} />

                        <div style={{ padding: '18px 22px 16px', position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: subText ? 8 : 0 }}>
                            <div style={{
                              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                              background: 'rgba(255,255,255,0.18)',
                              backdropFilter: 'blur(12px)',
                              border: '1.5px solid rgba(255,255,255,0.28)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 22,
                              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                            }}>{banner.icon}</div>

                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: banner.text_color, lineHeight: 1.4, letterSpacing: '-0.01em' }}>
                                {parseBoldLocal(mainText)}
                              </div>
                            </div>
                          </div>

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
                <div style={{ height: 3, background: 'linear-gradient(90deg, #d1fae5, #16a34a, #d1fae5)', position: 'absolute', top: 0, left: 0, right: 0 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0, padding: '14px 20px 12px' }}>
                  {[
                    { icon: '🚚', text: `Безплатна доставка над ${settings.free_shipping_above} ${settings.currency_symbol} (за Atlas Terra)`, color: '#16a34a' },
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

      {/* [SEO] AffiliateSection — rel="nofollow sponsored" се прилага в компонента.
          Ако AffiliateSection рендерира <a href={affiliate_url}>, увери се, че има:
          rel="nofollow sponsored noopener" target="_blank"
          Виж бележките в края на файла. */}
      <div className="affiliate-section-wrap">
        <AffiliateSection products={top6AffiliateProducts} allProducts={affiliateProducts} />
      </div>

      {/* ══ СПЕЦИАЛНИ СЕКЦИИ ═══════════════════════════════════════════════════ */}
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
                    <SpecialSectionButton
                      href={sec.button_url}
                      text={sec.button_text}
                      slug={sec.slug || sec.id}
                      partner={sec.partner || 'ginegar'}
                    />
                  )}
                </div>

                <div className="ginegar-img-wrap">
                  <div style={{ position: 'absolute', inset: -24, background: 'radial-gradient(circle, rgba(22,163,74,0.18), transparent 70%)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }} />

                  {/* [SEO] alt текст от БД */}
                  {sec.image_url && sec.image_url.startsWith('http') && (
                    <img
                      src={sec.image_url}
                      alt={sec.image_alt || sec.title}
                      style={{ width: '100%', maxWidth: 260, borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1, display: 'block', objectFit: 'contain' }}
                    />
                  )}

                  {/* [SEO] logo alt от БД */}
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
                        alt={sec.logo_alt || `${sec.title} лого`}
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

      {/* ══ TESTIMONIALS ═══════════════════════════════════════════════════════ */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="testimonials-section" style={{ backgroundColor: '#f7f7f5' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <FadeIn>
              <div className="section-head">
                <span className="s-tag" style={{ color: '#059669' }}>Отзиви</span>
                <h2 className="s-title" style={{ color: '#111827' }}>Какво казват фермерите</h2>
                <p className="s-desc" style={{ color: '#6b7280' }}>
                  Реални резултати от реални хора — без филтри
                </p>
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
              {testimonials.map((t: Testimonial, i: number) => {
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

                      <div className="testimonial-stars">
                        {Array.from({ length: t.rating || 5 }).map((_, j) => (
                          <span key={j} className="star" aria-hidden="true">★</span>
                        ))}
                        <span className="testimonial-verified">✓ Верифициран</span>
                      </div>

                      <blockquote style={{ margin: 0 }}>
                        <p className="testimonial-text">„{t.text}"</p>
                      </blockquote>

                      {t.product && (
                        <span className="testimonial-product-badge">🌿 {t.product}</span>
                      )}

                      <div className="testimonial-author">
                        {t.avatar_url ? (
                          /* [SEO] alt с name */
                          <img src={t.avatar_url} alt={`${t.name} — отзив за Denny Angelow`} className="testimonial-avatar" loading="lazy" />
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
              {/* [SEO] rel="nofollow sponsored" на всички affiliate/partner линкове */}
              {[
                { label: '🌿 AgroApteki.bg', href: `https://agroapteki.com/${AFF}` },
                { label: '🏡 Oranjeriata.bg', href: 'https://oranjeriata.com/' },
                { label: '🌱 AtlasAgro.eu',   href: 'https://atlasagro.eu/' },
              ].map(l => (
                <a key={l.label} href={l.href} target="_blank" rel="nofollow sponsored noopener" className="footer-link">{l.label}</a>
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

// ─── БЕЛЕЖКА ЗА AffiliateSection ─────────────────────────────────────────────
// В компонента AffiliateSection всеки линк към affiliate_url трябва да има:
//   rel="nofollow sponsored noopener" target="_blank"
// Пример:
//   <a href={p.affiliate_url} rel="nofollow sponsored noopener" target="_blank">
//     <img src={p.image_url} alt={p.image_alt} ... />
//   </a>
// Ако нямаш достъп до AffiliateSection.tsx, качи го и ще го поправим.
