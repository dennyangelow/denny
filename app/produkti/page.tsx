// app/produkti/page.tsx — v3
// ✅ Lazy loading: prop initialVisible=6 → ProduktCatalogClient зарежда +6 при scroll
// ✅ SEO: пълни метатагове, OG image, twitter:card, googleBot directives
// ✅ JSON-LD: BreadcrumbList + ItemList + Product schema за топ 12

import { Metadata }              from 'next'
import { supabaseAdmin }         from '@/lib/supabase'
import type { AffiliateProduct } from '@/lib/affiliate'
import { ProduktCatalogClient }  from './ProduktCatalogClient'
import '../homepage.css'
import './produkti.css'

export const revalidate = 60

const BASE_URL   = 'https://dennyangelow.com'
const OG_IMAGE   = `${BASE_URL}/og/produkti.jpg`  // 1200×630 jpg → /public/og/produkti.jpg
const PAGE_TITLE = 'Всички Продукти — Проверени от Практиката | Denny Angelow'
const PAGE_DESC  =
  'Пълен каталог с биостимулатори, торове, фунгициди и инсектициди — лично тествани от ' +
  'агро консултант Denny Angelow. Точни дози, карантини и препоръки за домати, лозя, ' +
  'краставици и всички основни земеделски култури.'

/* ─── Metadata ────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title:       PAGE_TITLE,
  description: PAGE_DESC,
  keywords: [
    'биостимулатори', 'торове за домати', 'фунгицид за домати', 'инсектицид',
    'Амалгерол', 'Калитех', 'Ридомил Голд', 'Синейс', 'Кристалон', 'Прев-Голд',
    'органично торене', 'растителна защита', 'Denny Angelow', 'агро консултант',
    'защита от мана', 'биологичен инсектицид', 'NPK тор',
  ],
  alternates: {
    canonical: `${BASE_URL}/produkti`,
    languages: { 'bg-BG': `${BASE_URL}/produkti` },
  },
  openGraph: {
    title:       PAGE_TITLE,
    description: PAGE_DESC,
    url:         `${BASE_URL}/produkti`,
    siteName:    'Denny Angelow',
    locale:      'bg_BG',
    type:        'website',
    images: [{
      url:    OG_IMAGE,
      width:  1200,
      height: 630,
      alt:    'Препоръчани агро продукти — Denny Angelow',
    }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       PAGE_TITLE,
    description: PAGE_DESC,
    images:      [OG_IMAGE],
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

/* ─── Data ────────────────────────────────────────────────────────── */
async function getAllProducts(): Promise<AffiliateProduct[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .select('*')
      .eq('active', true)
      .order('sort_order')
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('[produkti/page] getAllProducts:', err)
    return []
  }
}

/* ─── JSON-LD ─────────────────────────────────────────────────────── */
function buildBreadcrumb() {
  return {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Начало',   item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Продукти', item: `${BASE_URL}/produkti` },
    ],
  }
}

function buildItemList(products: AffiliateProduct[]) {
  return {
    '@context':    'https://schema.org',
    '@type':       'ItemList',
    name:          'Препоръчани агро продукти — Denny Angelow',
    description:   PAGE_DESC,
    url:           `${BASE_URL}/produkti`,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({
      '@type':     'ListItem',
      position:    i + 1,
      name:        p.name,
      url:         `${BASE_URL}/produkt/${p.slug}`,
      image:       p.image_url ?? undefined,
      description: p.description || p.subtitle,
    })),
  }
}

// Product schema само за топ 12 — Google индексира предимно видимите above-the-fold
function buildProductSchemas(products: AffiliateProduct[]) {
  return products.slice(0, 12).map(p => ({
    '@context':  'https://schema.org',
    '@type':     'Product',
    name:        p.name,
    description: p.description || p.subtitle,
    image:       p.image_url ?? undefined,
    url:         `${BASE_URL}/produkt/${p.slug}`,
    sku:         p.slug,
    brand:       { '@type': 'Brand', name: 'Denny Angelow' },
    ...(p.price ? {
      offers: {
        '@type':       'Offer',
        price:          Number(p.price).toFixed(2),
        priceCurrency: p.price_currency || 'EUR',
        availability:  'https://schema.org/InStock',
        url:           `${BASE_URL}/produkt/${p.slug}`,  // Fix: canonical URL, не affiliate
        seller:        { '@type': 'Organization', name: 'Denny Angelow' },
      },
    } : {}),
    ...(p.rating && p.review_count ? {
      aggregateRating: {
        '@type':      'AggregateRating',
        ratingValue:  Number(p.rating),
        reviewCount:  p.review_count,
        bestRating:   5,
        worstRating:  1,
      },
    } : {}),
  }))
}

/* ─── Page ────────────────────────────────────────────────────────── */
export default async function ProduktiPage() {
  const products   = await getAllProducts()
  const categories = Array.from(
    new Set(products.map(p => p.category_label).filter(Boolean))
  ) as string[]

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumb()) }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildItemList(products)) }} />
      {buildProductSchemas(products).map((schema, i) => (
        <script key={i} type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}

      {/*
        initialVisible=6  → първите 6 карти SSR-рендирани (above-the-fold)
        При scroll до sentinel-a → +6 при всяко задействане
        При filter/search → reset до initialVisible и отново lazy
      */}
      <ProduktCatalogClient
        products={products}
        categories={categories}
        initialVisible={6}
      />
    </>
  )
}
