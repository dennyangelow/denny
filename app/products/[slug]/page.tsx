// app/products/[slug]/page.tsx — SERVER COMPONENT v9
// ✅ ПОПРАВКИ спрямо v8:
//   - review_count и avg_rating добавени в PRODUCT_SELECT и Product interface
//   - created_at и updated_at добавени в PRODUCT_SELECT → datePublished/dateModified реални
//   - aggregateRating: САМО с реални данни от БД (review_count > 0 && avg_rating)
//     reviewCount: 1 (hard-coded) е ПРЕМАХНАТ — нарушаваше Google guidelines
//   - FAQPage schema: САМО в page.tsx (server) — премахната от OwnProduktClient
//   - BreadcrumbList: 3 нива (Начало › Продукти › Продукт) за по-добра навигация
//   - Article schema: datePublished от created_at (реална дата, не new Date())

import { Metadata }      from 'next'
import { notFound }      from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import OwnProduktClient  from './OwnProduktClient'

export const revalidate = 60

const BASE_URL    = 'https://dennyangelow.com'
const AUTHOR_NAME = 'Denny Angelow'

// ─── Types ───────────────────────────────────────────────────────────────────
interface SiteSettings {
  shipping_econt:       number
  shipping_speedy:      number
  free_shipping_above:  number
  currency_symbol:      string
  site_phone:           string
  site_email:           string
  urgency_bar_text:     string
  urgency_bar_products: string
}

interface ProductVariant {
  id:              string
  product_id:      string
  label:           string
  size_liters:     number
  price:           number
  compare_price:   number
  price_per_liter: number
  stock:           number
  active:          boolean
  sort_order:      number
}

interface FaqItem     { q: string; a: string }
interface HowItem     { icon: string; title: string; text: string }
interface CropRow     { name: string; leaf: string; soil: string; seed?: string }
interface WhyItem     { icon: string; title: string; text: string }
interface EcoBadge    { label: string; color: 'green' | 'blue' | 'brown' | 'gold' }
interface Testimonial { name: string; location: string; text: string; rating?: number }
interface StatItem    { label: string; value: string; sub?: string }
interface CompItem    { name: string; value: string; pct?: number; note?: string }

interface Product {
  id:              string
  slug:            string
  name:            string
  subtitle?:       string
  description?:    string
  badge?:          string
  emoji?:          string
  image_url?:      string
  image_alt?:      string
  features?:       string[]
  usage_notes?:    string
  category?:       string
  stock:           number
  active:          boolean
  sort_order?:     number
  seo_title?:      string
  seo_description?:string
  seo_keywords?:   string
  how_it_works?:   HowItem[]
  crops?:          CropRow[]
  faq?:            FaqItem[]
  testimonial?:    Testimonial
  why_items?:      WhyItem[]
  eco_badges?:     EcoBadge[]
  certifications?: string[]
  stats?:          StatItem[]
  composition?:    CompItem[]
  composition_ph?: string
  // ✅ Реални данни от БД — задължителни за AggregateRating
  review_count?:   number
  avg_rating?:     number
  // ✅ Реални дати от БД — за Article schema
  created_at?:     string
  updated_at?:     string
  variants:        ProductVariant[]
}

// ─── Settings ────────────────────────────────────────────────────────────────
const SETTINGS_DEFAULTS: SiteSettings = {
  shipping_econt:       5.00,
  shipping_speedy:      5.50,
  free_shipping_above:  60,
  currency_symbol:      '€',
  site_phone:           '+359 876 238 623',
  site_email:           'info@dennyangelow.com',
  urgency_bar_text:     '',
  urgency_bar_products: '🌱 **Atlas Terra** — Органичен биостимулант · 📦 **Безплатна доставка** при 10л+ · 💵 Само наложен платеж',
}

function parseNum(val: string | undefined | null, fallback: number): number {
  if (val == null || val === '') return fallback
  const n = parseFloat(val)
  return isNaN(n) ? fallback : n
}

function buildSettings(rows: { key: string; value: string }[]): SiteSettings {
  const s: Record<string, string> = {}
  rows.forEach(r => { s[r.key] = r.value })
  const econt  = parseNum(s.shipping_econt,      SETTINGS_DEFAULTS.shipping_econt)
  const speedy = parseNum(s.shipping_speedy,     SETTINGS_DEFAULTS.shipping_speedy)
  const free   = parseNum(s.free_shipping_above, SETTINGS_DEFAULTS.free_shipping_above)
  const sym    = s.currency_symbol || SETTINGS_DEFAULTS.currency_symbol
  let urgencyHome = s.urgency_bar_text || ''
  if (urgencyHome) {
    urgencyHome = urgencyHome
      .replace(/\{free_shipping\}/g,       `${free} ${sym}`)
      .replace(/над \d+(?:\.\d+)? €/g,    `над ${free} ${sym}`)
      .replace(/над \d+(?:\.\d+)? лв\./g, `над ${free} ${sym}`)
  }
  const urgencyProducts = s.urgency_bar_products?.trim()
    ? s.urgency_bar_products : SETTINGS_DEFAULTS.urgency_bar_products
  return {
    shipping_econt: econt, shipping_speedy: speedy, free_shipping_above: free,
    currency_symbol: sym,
    site_phone:  s.site_phone  || SETTINGS_DEFAULTS.site_phone,
    site_email:  s.site_email  || SETTINGS_DEFAULTS.site_email,
    urgency_bar_text:     urgencyHome,
    urgency_bar_products: urgencyProducts,
  }
}

// ─── DB Select ───────────────────────────────────────────────────────────────
// ✅ review_count, avg_rating, created_at, updated_at добавени
const PRODUCT_SELECT = [
  'id', 'slug', 'name', 'subtitle', 'description', 'badge', 'emoji',
  'image_url', 'image_alt',
  'features', 'usage_notes', 'category', 'stock', 'active', 'sort_order',
  'seo_title', 'seo_description', 'seo_keywords',
  'how_it_works', 'crops', 'faq', 'testimonial',
  'why_items', 'eco_badges', 'certifications',
  'stats', 'composition', 'composition_ph',
  'review_count', 'avg_rating',
  'created_at', 'updated_at',
].join(', ')

// ─── Data fetching ────────────────────────────────────────────────────────────
async function getPageData(slug: string): Promise<{
  product: Product; related: Product[]; outOfStock: boolean; settings: SiteSettings
} | null> {
  const [settingsRes, productRes, variantsRes, allProductsRes] = await Promise.allSettled([
    supabaseAdmin.from('settings').select('key, value'),
    supabaseAdmin.from('products').select(PRODUCT_SELECT).eq('slug', slug).eq('active', true).single(),
    supabaseAdmin.from('product_variants').select('*').eq('active', true).order('sort_order'),
    supabaseAdmin.from('products').select(PRODUCT_SELECT).eq('active', true).order('sort_order'),
  ])

  const settingsRows = settingsRes.status === 'fulfilled'
    ? (settingsRes.value.data ?? []) as { key: string; value: string }[]
    : []
  const settings = buildSettings(settingsRows)

  if (productRes.status === 'rejected' || !productRes.value.data) return null
  const rawProduct = productRes.value.data as any

  const allVariants: ProductVariant[] = variantsRes.status === 'fulfilled'
    ? (variantsRes.value.data ?? []) as ProductVariant[]
    : []

  const product: Product = {
    ...rawProduct,
    variants: allVariants.filter(v => v.product_id === rawProduct.id),
  }

  const allVariantMap = allVariants.reduce<Record<string, ProductVariant[]>>((acc, v) => {
    if (!acc[v.product_id]) acc[v.product_id] = []
    acc[v.product_id].push(v)
    return acc
  }, {})

  const rawAll: any[] = allProductsRes.status === 'fulfilled'
    ? (allProductsRes.value.data ?? []) : []

  const related: Product[] = rawAll
    .filter(p => p.slug !== slug)
    .map(p => ({ ...p, variants: allVariantMap[p.id] ?? [] }))

  const outOfStock =
    product.stock === 0 ||
    (product.variants.length > 0 && product.variants.every(v => v.stock === 0))

  return { product, related, outOfStock, settings }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getPageData(params.slug)
  if (!data) return { title: 'Продукт не е намерен' }
  const { product, settings } = data
  const sym   = settings.currency_symbol
  const minV  = product.variants.filter(v => v.active && v.stock > 0).sort((a, b) => a.price - b.price)[0]
  const price = minV ? `${minV.price.toFixed(2)} ${sym}` : ''
  const title = product.seo_title || `${product.name} — Органичен биостимулант | Denny Angelow`
  const description = product.seo_description
    || `${product.name} — ${product.subtitle || 'Органичен биостимулант Atlas Terra'}. ${price ? `От ${price}. ` : ''}Бърза доставка, наложен платеж. Безплатна при 10л+.`
  const keywords = product.seo_keywords
    ? product.seo_keywords.split(',').map(k => k.trim()).filter(Boolean)
    : ['atlas terra', 'биостимулант', 'органичен тор', 'хуминови киселини']

  return {
    title,
    description,
    keywords,
    alternates: { canonical: `${BASE_URL}/products/${product.slug}` },
    openGraph: {
      title, description,
      url:      `${BASE_URL}/products/${product.slug}`,
      siteName: 'Denny Angelow',
      locale:   'bg_BG',
      type:     'website',
      images: product.image_url
        ? [{ url: product.image_url, alt: product.image_alt || product.name, width: 800, height: 800 }]
        : [],
    },
    twitter: {
      card: 'summary_large_image', title, description,
      images: product.image_url ? [product.image_url] : [],
    },
    robots: {
      index:     true,
      follow:    true,
      googleBot: {
        index:               true,
        follow:              true,
        'max-snippet':       -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
  }
}

// ─── Static params ────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const { data } = await supabaseAdmin.from('products').select('slug').eq('active', true)
  return (data ?? []).map((p: { slug: string }) => ({ slug: p.slug }))
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function OwnProduktPage({ params }: { params: { slug: string } }) {
  const data = await getPageData(params.slug)
  if (!data) notFound()
  const { product, related, outOfStock, settings } = data

  const canonicalUrl    = `${BASE_URL}/products/${product.slug}`
  const sym             = settings.currency_symbol
  const currencyCode    = sym === '€' ? 'EUR' : 'BGN'
  const priceValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  // ✅ Реални дати от БД — Article schema няма да флуктуира при всеки render
  const datePublished = product.created_at
    ? product.created_at.split('T')[0]
    : '2026-01-01'
  const dateModified = product.updated_at
    ? product.updated_at.split('T')[0]
    : new Date().toISOString().split('T')[0]

  // Всички активни варианти за schema
  const activeVariants = product.variants.filter(v => v.active)

  // ✅ AggregateRating — САМО с реални данни от БД
  // Никога hard-coded reviewCount — нарушава Google guidelines и спира rich results
  const hasRealRating =
    typeof product.review_count === 'number' && product.review_count > 0 &&
    typeof product.avg_rating   === 'number' && product.avg_rating   > 0

  const aggregateRating = hasRealRating ? {
    aggregateRating: {
      '@type':      'AggregateRating',
      ratingValue:   product.avg_rating!.toFixed(1),
      reviewCount:   product.review_count!,
      bestRating:    5,
      worstRating:   1,
    },
  } : {}

  // ── Schema.org: Product ───────────────────────────────────────────────────
  const productSchema = activeVariants.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'Product',
    name:        product.name,
    description: product.description || product.subtitle,
    image:       product.image_url ? [product.image_url] : [],
    url:         canonicalUrl,
    sku:         product.slug,
    brand: {
      '@type': 'Brand',
      name:    'Atlas Terra',
      url:     BASE_URL,
    },
    // Всеки вариант → отделен Offer с точна цена и наличност
    offers: activeVariants.map(v => ({
      '@type':         'Offer',
      name:             v.label,
      price:            v.price.toFixed(2),
      priceCurrency:   currencyCode,
      availability:    v.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      priceValidUntil,
      url:             canonicalUrl,
      seller: {
        '@type': 'Organization',
        name:    AUTHOR_NAME,
        url:     BASE_URL,
      },
    })),
    ...aggregateRating,
  } : null

  // ── Schema.org: Article (E-E-A-T) ─────────────────────────────────────────
  const articleSchema = {
    '@context':   'https://schema.org',
    '@type':      'Article',
    headline:      product.seo_title || product.name,
    description:   product.seo_description || product.description,
    image:         product.image_url ? [product.image_url] : [],
    url:           canonicalUrl,
    inLanguage:   'bg-BG',
    // ✅ Реални дати — не new Date() при всеки render
    datePublished,
    dateModified,
    author: {
      '@type':  'Person',
      name:      AUTHOR_NAME,
      url:       BASE_URL,
      jobTitle: 'Агро Консултант',
    },
    publisher: {
      '@type': 'Organization',
      name:     AUTHOR_NAME,
      url:      BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url:     `${BASE_URL}/og-image.jpg`,
        width:   1200,
        height:  630,
      },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    about: product.category || 'Органичен биостимулант',
  }

  // ── Schema.org: FAQPage ───────────────────────────────────────────────────
  // ✅ САМО ТУК — премахната от OwnProduktClient за да няма дублиране
  const faqItems  = Array.isArray(product.faq) ? product.faq : []
  const faqSchema = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: faqItems.map(({ q, a }: FaqItem) => ({
      '@type': 'Question',
      name:     q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  } : null

  // ── Schema.org: HowTo ────────────────────────────────────────────────────
  const howItems    = Array.isArray(product.how_it_works) ? product.how_it_works : []
  const howToSchema = howItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'HowTo',
    name:        `Как да използваш ${product.name}`,
    description: product.description || product.subtitle,
    image:       product.image_url ? [product.image_url] : [],
    step:        howItems.map((item: HowItem, i: number) => ({
      '@type':   'HowToStep',
      position:   i + 1,
      name:       item.title,
      text:       item.text,
    })),
  } : null

  // ── Schema.org: BreadcrumbList ────────────────────────────────────────────
  // ✅ 3 нива — Начало › Продукти › Продукт (съответства на реалния URL)
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Начало',   item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Продукти', item: `${BASE_URL}/produkti` },
      { '@type': 'ListItem', position: 3, name: product.name, item: canonicalUrl },
    ],
  }

  return (
    <>
      {productSchema && (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      )}
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      {faqSchema && (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
      {howToSchema && (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      )}
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <OwnProduktClient
        product={product}
        related={related}
        outOfStock={outOfStock}
        initialSettings={settings}
      />
    </>
  )
}
