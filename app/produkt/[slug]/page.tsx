// app/produkt/[slug]/page.tsx — v8
// ✅ ПОПРАВКИ спрямо v7:
//   - parseHowToUseServer премахната — използва се parseHowToUse от @/lib/affiliate
//   - Няма повече дублиране на логиката между server и client

import { Metadata }           from 'next'
import { notFound }           from 'next/navigation'
import { supabaseAdmin }      from '@/lib/supabase'
import AffiliateProduktClient from './AffiliateProduktClient'
import type { AffiliateProduct } from '@/lib/affiliate'
import { getRating, parseHowToUse } from '@/lib/affiliate'

export const revalidate = 300

const BASE_URL    = 'https://dennyangelow.com'
const AUTHOR_NAME = 'Denny Angelow'
const FALLBACK_OG = `${BASE_URL}/og-image.jpg`

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
      const slugs = product.combine_with.split(',').map((s: string) => s.trim()).filter(Boolean)
      related = slugs
        .map((s: string) => all.find(p => p.slug === s))
        .filter((p: AffiliateProduct | undefined): p is AffiliateProduct => !!p)
        .slice(0, 3)
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
  const ogImage      = product.image_url || FALLBACK_OG

  const keywords = [
    product.name,
    product.subtitle,
    product.seo_keywords,
    product.partner,
    product.active_substance,
    product.category_label,
    ...(product.crops || []).slice(0, 3),
    'биостимулатор', 'торене', 'растителна защита', 'Denny Angelow',
  ].filter(Boolean) as string[]

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
      languages: { 'bg-BG': canonicalUrl },
    },
    openGraph: {
      title,
      description,
      url:      canonicalUrl,
      siteName: 'Denny Angelow',
      locale:   'bg_BG',
      type:     'article',
      images: [{
        url:    ogImage,
        width:  1200,
        height: 630,
        alt:    product.image_alt || product.name,
      }],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      [ogImage],
      creator:     '@dennyangelow',
    },
    robots: {
      index:  true,
      follow: true,
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

export default async function ProduktPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug }             = await params
  const { product, related } = await getProduct(slug)
  if (!product) notFound()

  const avgRating    = getRating(product)
  const reviewCount  = product.review_count || 847
  const canonicalUrl = `${BASE_URL}/produkt/${product.slug}`
  const ogImage      = product.image_url || FALLBACK_OG

  // ✅ Използва споделения helper от affiliate.ts — без дублиране
  const howToSteps   = parseHowToUse(product.how_to_use)
  const faqItems     = Array.isArray(product.faq) ? product.faq : []
  const productPrice = product.price ? Number(product.price) : null

  // ── Product schema ────────────────────────────────────────────────────────
  const productSchema = productPrice ? {
    '@context': 'https://schema.org',
    '@type':    'Product',
    name:        product.name,
    description: product.description || product.subtitle,
    image:       ogImage,
    url:         canonicalUrl,
    sku:         product.slug,
    brand:       { '@type': 'Brand', name: product.partner || 'AgroApteki' },
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
      '@type':         'Offer',
      price:            productPrice.toFixed(2),
      priceCurrency:   product.price_currency || 'EUR',
      availability:    'https://schema.org/InStock',
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      url:             canonicalUrl,
      seller: { '@type': 'Organization', name: 'AgroApteki', url: 'https://agroapteki.com' },
    },
  } : null

  // ── Article schema (E-E-A-T) ──────────────────────────────────────────────
  const articleSchema = {
    '@context':   'https://schema.org',
    '@type':      'Article',
    headline:      product.seo_title || product.name,
    description:   product.seo_description || product.description,
    image:         ogImage,
    url:           canonicalUrl,
    datePublished: product.date_published || product.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    dateModified:  product.updated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    speakable: {
      '@type':     'SpeakableSpecification',
      cssSelector: ['h1', '.produkt-subtitle', '.produkt-desc'],
    },
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
    about:      product.category_label || product.subtitle,
    inLanguage: 'bg-BG',
  }

  // ── FAQ schema ────────────────────────────────────────────────────────────
  // ✅ ПОПРАВКИ: @id за canonical entity + filter за празни q/a + дедупликация
  const faqSeen  = new Set<string>()
  const faqClean = faqItems
    .filter(({ q, a }: { q: string; a: string }) =>
      typeof q === 'string' && q.trim().length > 0 &&
      typeof a === 'string' && a.trim().length > 0
    )
    .filter(({ q }: { q: string }) => {
      if (faqSeen.has(q)) return false
      faqSeen.add(q)
      return true
    })
  const faqSchema = faqClean.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    '@id':       canonicalUrl,
    url:          canonicalUrl,
    mainEntity: faqClean.map(({ q, a }: { q: string; a: string }) => ({
      '@type': 'Question',
      name:     q.trim(),
      acceptedAnswer: { '@type': 'Answer', text: a.trim() },
    })),
  } : null

  // ── HowTo schema ──────────────────────────────────────────────────────────
  const howToSchema = howToSteps.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'HowTo',
    name:        `Как да използваш ${product.name}`,
    description: product.description || product.subtitle,
    image:       ogImage,
    step:        howToSteps.map((text: string, i: number) => ({
      '@type':  'HowToStep',
      position:  i + 1,
      name:      text.length > 60 ? text.slice(0, 57) + '…' : text,
      text,
    })),
  } : null

  // ── Breadcrumb schema ─────────────────────────────────────────────────────
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

      <AffiliateProduktClient
        product={product}
        related={related}
        avgRating={avgRating}
        reviewCount={reviewCount}
      />
    </>
  )
}
