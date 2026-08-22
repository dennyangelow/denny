// app/produkti/page.tsx — v6
// ✅ ПОПРАВКИ спрямо v5:
//   - getClickCounts() заменен с get_top_affiliate_clicks RPC (същата функция като homepage)
//   - RPC филтрира partner='category' — категорийните кликове ВЕЧЕ НЕ замърсяват sort-а
//   - RPC брои само последните 90 дни (days_back=90)
//   - Колоната вече се казва "click_count" (не "count") — обновен ClickCountRow тип
//   - Резултатът е идентичен с homepage → продуктите се нареждат еднакво и на двете места

import { Metadata }              from 'next'
import { supabaseAdmin }         from '@/lib/supabase'
import type { AffiliateProduct } from '@/lib/affiliate'
import { ProduktCatalogClient }  from './ProduktCatalogClient'
import { DeferredStylesheet }    from '@/components/client/DeferredStylesheet'
import '../homepage.css'
// ✅ produkti.css вече съдържа само hero/search/filters/grid/card/skeleton
//    (critical). Долната част (A-Я списък, bottom CTA, load-more, empty
//    state) е в public/css/produkti-deferred.css — зарежда се асинхронно
//    по-долу, не блокира render-а.
import './produkti.css'

export const revalidate = 300

const BASE_URL   = 'https://dennyangelow.com'
const OG_IMAGE   = `${BASE_URL}/og/produkti.jpg`
const PAGE_TITLE = 'Всички Продукти — Проверени от Практиката | Denny Angelow'
const PAGE_DESC  =
  'Пълен каталог с биостимулатори, торове, фунгициди и инсектициди — лично тествани от ' +
  'агро консултант Denny Angelow. Точни дози, карантини и препоръки за домати, лозя, ' +
  'краставици и всички основни земеделски култури.'

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
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Препоръчани агро продукти — Denny Angelow' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       PAGE_TITLE,
    description: PAGE_DESC,
    images:      [OG_IMAGE],
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

// ── Тип за RPC резултата ─────────────────────────────────────────────────────
// ✅ ВАЖНО: колоната се казва "click_count" (не "count") в новата RPC функция
interface ClickCountRow {
  product_slug: string
  click_count:  number
}

// ── Взима брой кликове чрез RPC (идентично с homepage) ──────────────────────
// ✅ ПОПРАВКА: ползва get_top_affiliate_clicks RPC вместо директна заявка
//   - автоматично изключва partner='category' кликове
//   - брои само последните 90 дни
//   - резултатът е 100% идентичен с homepage → еднакво наредени продукти
async function getClickCounts(): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('get_top_affiliate_clicks', {
        limit_count: 999,  // всички продукти
        days_back:   90,   // последните 90 дни
      })

    if (error) {
      console.error('[produkti/page] getClickCounts RPC грешка:', error)
      return {}
    }

    const counts: Record<string, number> = {}
    for (const row of (data as ClickCountRow[]) || []) {
      if (row.product_slug) {
        counts[row.product_slug] = Number(row.click_count) || 0
      }
    }
    return counts
  } catch (err) {
    console.error('[produkti/page] getClickCounts:', err)
    return {}
  }
}

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

function buildProductSchemas(products: AffiliateProduct[]) {
  return products.slice(0, 12).map(p => ({
    '@context':  'https://schema.org',
    '@type':     'Product',
    name:        p.name,
    description: p.description || p.subtitle,
    image:       p.image_url ?? undefined,
    url:         `${BASE_URL}/produkt/${p.slug}`,
    sku:         p.slug,
    brand:       { '@type': 'Brand', name: p.partner || 'AgroApteki' },
    ...(p.price ? {
      offers: {
        '@type':       'Offer',
        price:          Number(p.price).toFixed(2),
        priceCurrency: p.price_currency || 'EUR',
        availability:  'https://schema.org/InStock',
        url:           `${BASE_URL}/produkt/${p.slug}`,
        seller:        { '@type': 'Organization', name: p.partner || 'AgroApteki' },
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

export default async function ProduktiPage() {
  // ✅ Паралелни заявки — по-бързо
  const [products, clickCounts] = await Promise.all([
    getAllProducts(),
    getClickCounts(),  // ✅ вече ползва RPC — идентично с homepage
  ])

  const categories = Array.from(
    new Set(products.map(p => p.category_label).filter(Boolean))
  ) as string[]

  // ✅ Сортираме по кликове за default view (популярни най-отгоре)
  const sortedByClicks = [...products].sort((a, b) => {
    const ca = clickCounts[a.slug] || 0
    const cb = clickCounts[b.slug] || 0
    return cb - ca  // DESC — най-кликвани първи
  })

  return (
    <>
      {/* ── Deferred (below-the-fold) CSS — не блокира LCP/FCP ── */}
      <DeferredStylesheet href="/css/produkti-deferred.css" />

      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumb()) }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildItemList(sortedByClicks)) }} />
      {buildProductSchemas(sortedByClicks).map((schema, i) => (
        <script key={i} type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}

      <ProduktCatalogClient
        products={products}              // оригинален ред (sort_order) — за "По ред"
        sortedByClicks={sortedByClicks}  // ✅ наредени по кликове — за "Популярни"
        clickCounts={clickCounts}        // ✅ за показване на badge с брой кликове
        categories={categories}
        initialVisible={12}
        initialSort="popular"            // ✅ default: популярни
      />
    </>
  )
}
