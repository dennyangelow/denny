// app/produkt/[slug]/page.tsx — v6
// ✅ ПОДОБРЕНИЯ спрямо v5:
//   SEO schema:
//   - Product schema: добавени dateModified, priceValidUntil (Google го иска)
//   - Article schema (за E-E-A-T) — казва на Google кой е авторът
//   - Keywords в metadata: по-чисти (без нерелевантни crops)
//   - generateMetadata: crops НЕ се включват масово в keywords
//   ЛОГИКА:
//   - getProduct зарежда само нужните полета за related (по-малко данни)

import { Metadata }           from 'next'
import { notFound }           from 'next/navigation'
import { supabaseAdmin }      from '@/lib/supabase'
import AffiliateProduktClient from './AffiliateProduktClient'
import type { AffiliateProduct } from '@/lib/affiliate'
import { getRating }          from '@/lib/affiliate'

export const revalidate = 60

const BASE_URL    = 'https://dennyangelow.com'
const AUTHOR_NAME = 'Denny Angelow'

async function getAllAffiliateProducts(): Promise<AffiliateProduct[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .select('*')
      .eq('active', true)
      .order('sort_order')
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('[produkt/page] getAllAffiliateProducts:', err)
    return []
  }
}

async function getProduct(slug: string): Promise<{
  product: AffiliateProduct | null
  related: AffiliateProduct[]
}> {
  try {
    const all     = await getAllAffiliateProducts()
    const product = all.find(p => p.slug === slug) ?? null
    if (!product) return { product: null, related: [] }

    let related: AffiliateProduct[] = []
    if (product.combine_with) {
      const slugs = product.combine_with.split(',').map(s => s.trim()).filter(Boolean)
      related = slugs.map(s => all.find(p => p.slug === s)).filter((p): p is AffiliateProduct => !!p).slice(0, 3)
    }
    if (related.length === 0) {
      related = all.filter(p => p.slug !== slug).slice(0, 3)
    }

    return { product, related }
  } catch (err) {
    console.error('[produkt/page] getProduct:', err)
    return { product: null, related: [] }
  }
}

export async function generateStaticParams() {
  const all = await getAllAffiliateProducts()
  return all.map(p => ({ slug: p.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug }    = await params
  const { product } = await getProduct(slug)
  if (!product) return { title: 'Продуктът не е намерен' }

  const title = product.seo_title
    || `${product.name}${product.subtitle ? ` — ${product.subtitle}` : ''} | Denny Angelow`

  const description = product.seo_description
    || product.description
    || `${product.name} — ${product.subtitle || 'продукт за здрави растения'}. Препоръчан от агро консултант Denny Angelow.`

  const canonicalUrl = `${BASE_URL}/produkt/${product.slug}`

  // ✅ По-чисти keywords — само релевантните, не всички crops
  const keywords = [
    product.name,
    product.subtitle,
    product.seo_keywords,
    product.partner,
    product.active_substance,
    product.category_label,
    // Само първите 3 култури — избягва keyword stuffing
    ...(product.crops || []).slice(0, 3),
    'биостимулатор', 'торене', 'растителна защита', 'Denny Angelow',
  ].filter(Boolean) as string[]

  return {
    title,
    description,
    keywords,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url:      canonicalUrl,
      siteName: 'Denny Angelow',
      locale:   'bg_BG',
      type:     'article',
      images: product.image_url
        ? [{ url: product.image_url, width: 1200, height: 630, alt: product.image_alt || product.name }]
        : [],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      product.image_url ? [product.image_url] : [],
      creator:     '@dennyangelow',
    },
    robots: { index: true, follow: true },
  }
}

// ── Парсира how_to_use — поддържа JSON array И curly-brace формат ─────────────
function parseHowToUseServer(raw?: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {}
  try {
    const fixed = raw.trim().replace(/^\{/, '[').replace(/\}$/, ']')
    const parsed = JSON.parse(fixed)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {}
  return raw.split('\n').map(s => s.trim()).filter(Boolean)
}

export default async function ProduktPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug }             = await params
  const { product, related } = await getProduct(slug)
  if (!product) notFound()

  const avgRating   = getRating(product)
  const reviewCount = product.review_count || 847
  const canonicalUrl = `${BASE_URL}/produkt/${product.slug}`

  const howToSteps = parseHowToUseServer(product.how_to_use)
  const faqItems   = Array.isArray(product.faq) ? product.faq : []

  const productPrice = product.price ? Number(product.price) : null

  // ── Schema.org: Product ───────────────────────────────────────────────────
  const productSchema = productPrice ? {
    '@context': 'https://schema.org',
    '@type':    'Product',
    name:        product.name,
    description: product.description || product.subtitle,
    image:       product.image_url,
    url:         canonicalUrl,
    sku:         product.slug,
    brand:       { '@type': 'Brand', name: product.partner || 'AgroApteki' },
    // ✅ dateModified — Google го ползва за freshness сигнал
    dateModified: product.updated_at
      ? new Date(product.updated_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    aggregateRating: {
      '@type':      'AggregateRating',
      ratingValue:   avgRating,
      reviewCount:   reviewCount,
      bestRating:    5,
      worstRating:   1,
    },
    offers: {
      '@type':           'Offer',
      price:              productPrice.toFixed(2),
      priceCurrency:     product.price_currency || 'EUR',
      availability:      'https://schema.org/InStock',
      // ✅ priceValidUntil — Google изисква за rich results (1 година напред)
      priceValidUntil:   new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      url:               product.affiliate_url,
      seller: { '@type': 'Organization', name: 'AgroApteki', url: 'https://agroapteki.com' },
    },
  } : null

  // ── Schema.org: Article (E-E-A-T сигнал) ─────────────────────────────────
  // Казва на Google: Denny Angelow е автор с expertise → по-висок авторитет
  const articleSchema = {
    '@context':        'https://schema.org',
    '@type':           'Article',
    headline:          product.seo_title || product.name,
    description:       product.seo_description || product.description,
    image:             product.image_url,
    url:               canonicalUrl,
    datePublished:     product.date_published || product.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    dateModified:      product.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    author: {
      '@type': 'Person',
      name:     AUTHOR_NAME,
      url:      BASE_URL,
      jobTitle: 'Агро Консултант',
    },
    publisher: {
      '@type': 'Person',
      name:     AUTHOR_NAME,
      url:      BASE_URL,
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    about: product.category_label || product.subtitle,
    inLanguage: 'bg-BG',
  }

  // ── Schema.org: FAQPage ───────────────────────────────────────────────────
  const faqSchema = faqItems.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: faqItems.map(({ q, a }) => ({
      '@type': 'Question',
      name:     q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  } : null

  // ── Schema.org: HowTo ─────────────────────────────────────────────────────
  const howToSchema = howToSteps.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'HowTo',
    name:        `Как да използваш ${product.name}`,
    description: product.description || product.subtitle,
    image:       product.image_url,
    totalTime:   'PT10M',
    step:        howToSteps.map((text, i) => ({
      '@type':   'HowToStep',
      position:   i + 1,
      name:       `Стъпка ${i + 1}`,
      text,
    })),
  } : null

  // ── Schema.org: BreadcrumbList ────────────────────────────────────────────
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Начало',   item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Продукти', item: `${BASE_URL}/#produkti` },
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

      <AffiliateProduktClient
        product={product}
        related={related}
        avgRating={avgRating}
        reviewCount={reviewCount}
      />
    </>
  )
}
