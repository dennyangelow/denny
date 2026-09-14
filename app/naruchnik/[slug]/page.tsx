// app/naruchnik/[slug]/page.tsx — v16
// ✅ ПОПРАВКИ спрямо v15:
//   - ПРЕМАХНАТИ фалшивите fallback-и `|| 4.9` / `|| 847` / `|| 6000` —
//     отиваха БЕЗ проверка направо в Book schema (aggregateRating/
//     interactionStatistic), т.е. Google получаваше измислени 4.9★/847
//     отзива/6000 сваляния за всеки наръчник без реални попълнени данни.
//   - Рейтингът/отзивите вече идват от новата обединена `reviews` таблица
//     (lib/reviews.ts), не от nar.avg_rating/nar.reviews_count (които бяха
//     ръчно въведени, силно завишени числа спрямо реалните тестимониали).
//   - interactionStatistic (сваляния) вече взима РЕАЛНИЯ tracked брояч
//     `nar.downloads`, не маркетинговото `downloads_count` — схема данните
//     трябва да са верни, за разлика от показания на екрана маркетинг текст.
//   - aggregateRating/interactionStatistic вече се включват в schema-та
//     САМО ако има реални данни (hasRealRating / downloads > 0) — никога
//     повече фабрикувани стойности.

import { Metadata }      from 'next'
import { notFound }      from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import NaruchnikClient   from './NaruchnikClient'
import type { Testimonial } from './NaruchnikClient'
import { buildImageList } from '@/lib/images'
import { getSettings } from '@/lib/settings'
import { getHeaderCartConfig } from '@/lib/header-cart'
// ✅ НОВО — обединената reviews система
import { getReviews, getAggregateRating, hasRealRating } from '@/lib/reviews'

export const revalidate = 3600

export interface Naruchnik {
  id:            string
  slug:          string
  title:         string
  subtitle?:     string
  description?:  string
  cover_image_url?: string
  image_alt?:    string
  // ✅ Допълнителни снимки (галерия) — cover_image_url остава главна/hero снимка
  gallery_urls?: (string | { url: string; alt?: string })[]
  pdf_url?:      string
  category?:     string
  active:        boolean
  meta_title?:   string
  meta_description?: string
  faq_q1?: string; faq_a1?: string
  faq_q2?: string; faq_a2?: string
  faq_q3?: string; faq_a3?: string
  // ✅ Неограничен FAQ списък — приоритетен пред старите faq_q1-3 полета
  faq?: { q: string; a: string }[]
  content_body?: string
  author_bio?:   string
  // ⚠️ reviews_count/avg_rating остават в схемата за обратна съвместимост
  // (стари данни/UI), но вече НЕ се ползват за schema.org markup — виж
  // getAggregateRating() по-долу вместо тях.
  reviews_count?: number
  avg_rating?:   number
  downloads?:      number  // ✅ реален tracked брояч
  downloads_count?: number // ⚠️ маркетингово число, показвано на екрана — виж бележка при NaruchnikClient извикването
  created_at?:   string
  updated_at?:   string
  testimonials?: Testimonial[]
}

const BASE_URL    = 'https://dennyangelow.com'
const AUTHOR_NAME = 'Denny Angelow'
const FALLBACK_OG = `${BASE_URL}/og-image.jpg`

async function getAllNaruchnici(): Promise<Naruchnik[]> {
  try {
    const { data } = await supabaseAdmin
      .from('naruchnici')
      .select('*')
      .eq('active', true)
      .order('sort_order')
    return (data as Naruchnik[]) || []
  } catch { return [] }
}

async function getNaruchnik(slug: string): Promise<{ nar: Naruchnik | null; others: Naruchnik[] }> {
  const all    = await getAllNaruchnici()
  const nar    = all.find(n => n.slug === slug) || null
  const others = all.filter(n => n.slug !== slug).slice(0, 3)
  return { nar, others }
}

export async function generateStaticParams() {
  const all = await getAllNaruchnici()
  return all.map(n => ({ slug: n.slug }))
}

// ✅ ПОПРАВКА: params е Promise в Next.js 15
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const { nar }  = await getNaruchnik(slug)
  if (!nar) return { title: 'Наръчник не е намерен' }

  const title       = nar.meta_title || `${nar.title} — Безплатен PDF Наръчник | Denny Angelow`
  const description = nar.meta_description || nar.description
    || `Изтегли безплатно "${nar.title}" — практично ръководство за по-здрави растения и рекордна реколта.`
  const canonicalUrl = `${BASE_URL}/naruchnik/${nar.slug}`
  const allImages = buildImageList(nar.cover_image_url, nar.image_alt, nar.gallery_urls, `${nar.title} — PDF наръчник`)
  // ✅ Fallback OG image — никога нямаме празен images[]
  const ogImage = allImages[0]?.url || FALLBACK_OG

  const keywords = [
    nar.title,
    nar.category && `наръчник за ${nar.category}`,
    nar.category && `отглеждане на ${nar.category}`,
    nar.category && `торене на ${nar.category}`,
    nar.category && `болести по ${nar.category}`,
    nar.category,
    'наръчник', 'безплатен PDF', 'безплатен наръчник',
    'градина', 'земеделие', 'органично', 'реколта',
    AUTHOR_NAME, 'агро консултант',
  ].filter(Boolean) as string[]

  const publishedTime = nar.created_at
    ? new Date(nar.created_at).toISOString()
    : '2024-01-01T00:00:00Z'

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical:  canonicalUrl,
      languages:  { 'bg-BG': canonicalUrl }, // ✅ hreflang на всяка страница
    },
    openGraph: {
      title, description,
      url:           canonicalUrl,
      siteName:      'Denny Angelow',
      locale:        'bg_BG',
      type:          'article',
      images: allImages.length > 0
        ? allImages.map(img => ({ url: img.url, width: 1200, height: 630, alt: img.alt }))
        : [{ url: ogImage, width: 1200, height: 630, alt: `${nar.title} — PDF наръчник` }],
      publishedTime,
      authors: [BASE_URL],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      [ogImage], // ✅ винаги има image
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

// ✅ ПОПРАВКА: params е Promise в Next.js 15
export default async function NaruchnikPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug }        = await params
  // ✅ Паралелни заявки — наръчник + settings + реални отзиви/рейтинг
  const [{ nar, others }, settings] = await Promise.all([
    getNaruchnik(slug),
    getSettings(),
  ])
  if (!nar) notFound()

  const [realReviews, aggregateRatingData] = await Promise.all([
    getReviews('handbook', nar.id),
    getAggregateRating('handbook', nar.id),
  ])

  const headerCart = getHeaderCartConfig(settings, 'naruchnik')

  const canonicalUrl   = `${BASE_URL}/naruchnik/${nar.slug}`
  // ⚠️ downloads_count е маркетингово число, ръчно въведено в admin панела —
  // остава за екрана (виж бележка при NaruchnikClient по-долу), но НЕ отива
  // в schema.org markup — там ползваме само реалния tracked брояч.
  const downloadsCount = nar.downloads_count || 0
  const realDownloads  = nar.downloads || 0

  const allImages       = buildImageList(nar.cover_image_url, nar.image_alt, nar.gallery_urls, `${nar.title} — PDF наръчник`)
  const ogImage         = allImages[0]?.url || `${BASE_URL}/og-image.jpg`

  const datePublished = nar.created_at
    ? new Date(nar.created_at).toISOString().split('T')[0]
    : '2024-01-01'
  const dateModified = nar.updated_at
    ? new Date(nar.updated_at).toISOString().split('T')[0]
    : datePublished

  const legacyFaq = [
    ...(nar.faq_q1 && nar.faq_a1 ? [{ q: nar.faq_q1, a: nar.faq_a1 }] : []),
    ...(nar.faq_q2 && nar.faq_a2 ? [{ q: nar.faq_q2, a: nar.faq_a2 }] : []),
    ...(nar.faq_q3 && nar.faq_a3 ? [{ q: nar.faq_q3, a: nar.faq_a3 }] : []),
  ]
  const newFaq = Array.isArray(nar.faq) ? nar.faq.filter(f => f.q?.trim() && f.a?.trim()) : []
  // ✅ Новият списък е приоритетен; старите въпроси се добавят само ако не са дублирани
  const seenQ = new Set(newFaq.map(f => f.q.trim()))
  const faqEntries = [...newFaq, ...legacyFaq.filter(f => !seenQ.has(f.q.trim()))]

  // ✅ Реалните отзиви от новата таблица заместват nar.testimonials/
  // FALLBACK_TESTIMONIALS (виж NaruchnikClient.tsx фикса) — ако няма нито
  // един реален одобрен отзив, подаваме празен масив, НЕ измислени хора.
  const testimonials: Testimonial[] = realReviews.map(r => ({
    name:     r.author_name,
    location: r.author_location || '',
    text:     r.text,
    stars:    r.rating,
  }))

  // ── Book schema ───────────────────────────────────────────────────────────
  const bookSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type':    'Book',
    name:        nar.title,
    description: nar.description || nar.subtitle,
    url:         canonicalUrl,
    image:       allImages.length > 0 ? allImages.map(img => img.url) : ogImage,
    inLanguage:  'bg',
    isAccessibleForFree: true,
    genre:       'Agriculture / Gardening',
    datePublished,
    dateModified,
    author: {
      '@type':    'Person',
      name:        AUTHOR_NAME,
      url:         BASE_URL,
      jobTitle:   'Агро Консултант',
      description: nar.author_bio || 'Агро консултант с дългогодишен опит в отглеждането на зеленчуци.',
    },
    publisher: {
      '@type': 'Organization',
      name:     AUTHOR_NAME,
      url:      BASE_URL,
    },
    offers: {
      '@type':       'Offer',
      price:          '0',
      priceCurrency: 'BGN',
      availability:  'https://schema.org/InStock',
    },
  }

  // ✅ aggregateRating — САМО ако има реални одобрени отзиви (не фалшив fallback)
  if (hasRealRating(aggregateRatingData)) {
    bookSchema.aggregateRating = {
      '@type':      'AggregateRating',
      ratingValue:   aggregateRatingData.avg,
      reviewCount:   aggregateRatingData.count,
      bestRating:    5,
      worstRating:   1,
    }
  }

  // ✅ interactionStatistic — САМО ако имаме реален tracked брой сваляния
  // (не маркетинговото downloads_count)
  if (realDownloads > 0) {
    bookSchema.interactionStatistic = {
      '@type':              'InteractionCounter',
      interactionType:      'https://schema.org/DownloadAction',
      userInteractionCount: realDownloads,
    }
  }

  // ── Article schema (E-E-A-T) ──────────────────────────────────────────────
  const articleSchema = {
    '@context':   'https://schema.org',
    '@type':      'Article',
    headline:      nar.meta_title || nar.title,
    description:   nar.meta_description || nar.description,
    image:         allImages.length > 0 ? allImages.map(img => img.url) : ogImage,
    url:           canonicalUrl,
    inLanguage:   'bg-BG',
    datePublished,
    dateModified,
    // ✅ speakable — AI четат тези части за отговори
    speakable: {
      '@type':    'SpeakableSpecification',
      cssSelector: ['h1', 'h2', '.nar-subtitle', '.nar-desc'],
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
    about: nar.category
      ? { '@type': 'Thing', name: nar.category }
      : { '@type': 'Thing', name: 'Земеделие' },
  }

  // ── FAQ schema ────────────────────────────────────────────────────────────
  const faqSchema = faqEntries.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    '@id':       canonicalUrl,   // ✅ canonical entity ID → решава "Дублиращо се поле FAQPage"
    url:          canonicalUrl,
    mainEntity: faqEntries.map(({ q, a }) => ({
      '@type': 'Question',
      name:     q.trim(),
      acceptedAnswer: { '@type': 'Answer', text: a.trim() },
    })),
  } : null

  // ── Breadcrumb schema ─────────────────────────────────────────────────────
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Начало',  item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: nar.title, item: canonicalUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bookSchema) }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      {faqSchema && (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <NaruchnikClient
        nar={nar}
        others={others}
        faqEntries={faqEntries}
        testimonials={testimonials}
        downloadsCount={downloadsCount}
        avgRating={aggregateRatingData.avg}
        reviewsCount={aggregateRatingData.count}
        images={allImages}
        headerCart={headerCart}
        settings={settings}
      />
    </>
  )
}
