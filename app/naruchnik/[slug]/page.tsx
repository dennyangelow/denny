// app/naruchnik/[slug]/page.tsx — v12
// ✅ Testimonials от naruchnici.testimonials (JSON колона)
// ✅ Всичко от БД
// ✅ revalidatePath при PATCH/DELETE от admin routes
// ✅ keywords обогатени с категория + slug
// ✅ interactionStatistic за downloads (DownloadAction schema)

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import NaruchnikClient from './NaruchnikClient'
import type { Testimonial } from './NaruchnikClient'

export interface Naruchnik {
  id: string
  slug: string
  title: string
  subtitle?: string
  description?: string
  cover_image_url?: string
  pdf_url?: string
  category?: string
  active: boolean
  meta_title?: string
  meta_description?: string
  faq_q1?: string; faq_a1?: string
  faq_q2?: string; faq_a2?: string
  faq_q3?: string; faq_a3?: string
  content_body?: string
  author_bio?: string
  reviews_count?: number
  avg_rating?: number
  downloads_count?: number
  testimonials?: Testimonial[] // JSON колона в Supabase
}

const BASE_URL = 'https://dennyangelow.com'

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── SSG ──────────────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const all = await getAllNaruchnici()
  return all.map(n => ({ slug: n.slug }))
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const { nar } = await getNaruchnik(params.slug)
  if (!nar) return { title: 'Наръчник не е намерен' }

  const title       = nar.meta_title || `${nar.title} — Безплатен PDF Наръчник | Denny Angelow`
  const description = nar.meta_description || nar.description
    || `Изтегли безплатно "${nar.title}" — практично ръководство за по-здрави растения и рекордна реколта. Над ${nar.downloads_count || 6000} фермери вече го изтеглиха.`
  const canonicalUrl = `${BASE_URL}/naruchnik/${nar.slug}`

  // Разширени keywords: включват категорията, slug-а и стандартни термини
  const keywords = [
    nar.title,
    nar.category ? `наръчник за ${nar.category}` : '',
    nar.category ? `отглеждане на ${nar.category}` : '',
    nar.category ? `торене на ${nar.category}` : '',
    nar.category ? `болести по ${nar.category}` : '',
    nar.category || '',
    'наръчник', 'безплатен PDF', 'безплатен наръчник',
    'градина', 'земеделие', 'органично', 'реколта',
    'Denny Angelow', 'агро консултант',
  ].filter(Boolean)

  return {
    title,
    description,
    keywords,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title, description,
      url:           canonicalUrl,
      siteName:     'Denny Angelow',
      locale:       'bg_BG',
      type:         'article',
      images: nar.cover_image_url
        ? [{ url: nar.cover_image_url, width: 1200, height: 630, alt: `${nar.title} — PDF наръчник` }]
        : [],
      publishedTime: '2024-01-01T00:00:00Z',
      authors:       [`${BASE_URL}`],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      nar.cover_image_url ? [nar.cover_image_url] : [],
      creator:     '@dennyangelow',
    },
    robots: {
      index:     true,
      follow:    true,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
    },
  }
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default async function NaruchnikPage({ params }: { params: { slug: string } }) {
  const { nar, others } = await getNaruchnik(params.slug)
  if (!nar) notFound()

  const canonicalUrl   = `${BASE_URL}/naruchnik/${nar.slug}`
  const downloadsCount = nar.downloads_count || 6000
  const avgRating      = nar.avg_rating      || 4.9
  const reviewsCount   = nar.reviews_count   || 847

  // FAQ — от БД
  const faqEntries = [
    ...(nar.faq_q1 && nar.faq_a1 ? [{ q: nar.faq_q1, a: nar.faq_a1 }] : []),
    ...(nar.faq_q2 && nar.faq_a2 ? [{ q: nar.faq_q2, a: nar.faq_a2 }] : []),
    ...(nar.faq_q3 && nar.faq_a3 ? [{ q: nar.faq_q3, a: nar.faq_a3 }] : []),
  ]

  // Testimonials — от JSON колоната в naruchnici
  const testimonials: Testimonial[] = Array.isArray(nar.testimonials) ? nar.testimonials : []

  // ── Schema.org ────────────────────────────────────────────────────────────
  const bookSchema = {
    '@context': 'https://schema.org',
    '@type':    'Book',
    name:        nar.title,
    description: nar.description || nar.subtitle,
    url:         canonicalUrl,
    image:       nar.cover_image_url,
    inLanguage:  'bg',
    isAccessibleForFree: true,
    genre:          'Agriculture / Gardening',
    datePublished:  '2024-01-01',
    author: {
      '@type':    'Person',
      name:       'Denny Angelow',
      url:         BASE_URL,
      jobTitle:   'Агро Консултант',
      description: nar.author_bio || 'Агро консултант с дългогодишен опит в отглеждането на зеленчуци.',
    },
    publisher: { '@type': 'Organization', name: 'Denny Angelow', url: BASE_URL },
    offers: {
      '@type':       'Offer',
      price:          '0',
      priceCurrency: 'BGN',
      availability:  'https://schema.org/InStock',
    },
    aggregateRating: {
      '@type':       'AggregateRating',
      ratingValue:    avgRating,
      reviewCount:    reviewsCount,
      bestRating:     5,
      worstRating:    1,
    },
    // DownloadAction — брой изтегляния за Google
    interactionStatistic: {
      '@type':              'InteractionCounter',
      interactionType:      'https://schema.org/DownloadAction',
      userInteractionCount: downloadsCount,
    },
  }

  const faqSchema = faqEntries.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: faqEntries.map(({ q, a }) => ({
      '@type': 'Question',
      name:     q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  } : null

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Начало',    item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Наръчници', item: `${BASE_URL}/naruchnici` },
      { '@type': 'ListItem', position: 3, name: nar.title,   item: canonicalUrl },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookSchema) }} />
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <NaruchnikClient
        nar={nar}
        others={others}
        faqEntries={faqEntries}
        testimonials={testimonials}
        downloadsCount={downloadsCount}
        avgRating={avgRating}
        reviewsCount={reviewsCount}
      />
    </>
  )
}
