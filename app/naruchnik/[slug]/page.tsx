// app/naruchnik/[slug]/page.tsx — v10 FIXED
// ПОПРАВКИ:
//   ✅ Използва supabaseAdmin от @/lib/supabase (не директен import на supabase-js)
//   ✅ Exports Naruchnik interface за NaruchnikClient

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import NaruchnikClient from './NaruchnikClient'

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
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────
async function getAllNaruchnici(): Promise<Naruchnik[]> {
  try {
    const { data } = await supabaseAdmin
      .from('naruchnici')
      .select('*')
      .eq('active', true)
      .order('sort_order')
    return (data as Naruchnik[]) || []
  } catch {
    return []
  }
}

async function getNaruchnik(slug: string): Promise<{ nar: Naruchnik | null; others: Naruchnik[] }> {
  const all = await getAllNaruchnici()
  const nar = all.find(n => n.slug === slug) || null
  const others = all.filter(n => n.slug !== slug).slice(0, 3)
  return { nar, others }
}

// ─── Static params (SSG) ──────────────────────────────────────────────────────
export async function generateStaticParams() {
  const all = await getAllNaruchnici()
  return all.map(n => ({ slug: n.slug }))
}

// ─── SEO Metadata ─────────────────────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const { nar } = await getNaruchnik(params.slug)
  if (!nar) return { title: 'Наръчник не е намерен' }

  const title = nar.meta_title
    || `${nar.title} — Безплатен PDF Наръчник | Denny Angelow`

  const description = nar.meta_description
    || nar.description
    || `Изтегли безплатно "${nar.title}" — практично ръководство за по-здрави растения и рекордна реколта. ${nar.subtitle || ''} Над ${nar.downloads_count || 6000} фермери вече го изтеглиха.`

  const canonicalUrl = `https://dennyangelow.com/naruchnik/${nar.slug}`

  return {
    title,
    description,
    keywords: [
      nar.title, 'наръчник', 'безплатен PDF', 'градина',
      'земеделие', 'органично', 'реколта', 'торене',
      nar.category || '', 'Denny Angelow',
    ].filter(Boolean),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Denny Angelow',
      locale: 'bg_BG',
      type: 'article',
      images: nar.cover_image_url
        ? [{ url: nar.cover_image_url, width: 1200, height: 630, alt: `${nar.title} — безплатен PDF наръчник от Denny Angelow` }]
        : [],
      publishedTime: '2024-01-01T00:00:00Z',
      authors: ['https://dennyangelow.com'],
    },
    twitter: {
      card: 'summary_large_image', title, description,
      images: nar.cover_image_url ? [nar.cover_image_url] : [],
      creator: '@dennyangelow',
    },
    robots: {
      index: true, follow: true,
      googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
    },
  }
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default async function NaruchnikPage({ params }: { params: { slug: string } }) {
  const { nar, others } = await getNaruchnik(params.slug)
  if (!nar) notFound()

  const canonicalUrl   = `https://dennyangelow.com/naruchnik/${nar.slug}`
  const downloadsCount = nar.downloads_count || 6000
  const avgRating      = nar.avg_rating      || 4.9
  const reviewsCount   = nar.reviews_count   || 847

  // FAQ entries — dynamic от Supabase или fallback
  const faqEntries = [
    {
      q: nar.faq_q1 || `Наистина ли е безплатен наръчникът "${nar.title}"?`,
      a: nar.faq_a1 || `Да, наръчникът "${nar.title}" е напълно безплатен. Просто въведи своето ime, имейл и телефон и PDF-ът се изтегля автоматично.`,
    },
    {
      q: nar.faq_q2 || `Какво съдържа наръчникът "${nar.title}"?`,
      a: nar.faq_a2 || `Наръчникът съдържа: пълен календар за торене и третиране, органични методи за борба с болести, съвети за двоен добив от декар и грешките, които унищожават реколтата.`,
    },
    ...(nar.faq_q3 && nar.faq_a3 ? [{ q: nar.faq_q3, a: nar.faq_a3 }] : []),
  ]

  // ── Schema.org JSON-LD ────────────────────────────────────────────────────
  const bookSchema = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: nar.title,
    description: nar.description || nar.subtitle,
    author: {
      '@type': 'Person',
      name: 'Denny Angelow',
      url: 'https://dennyangelow.com',
      jobTitle: 'Агро Консултант',
      description: nar.author_bio || 'Агро консултант с над 10 години опит в отглеждането на зеленчуци и подпомагането на фермери.',
    },
    inLanguage: 'bg',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'BGN', availability: 'https://schema.org/InStock' },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: avgRating, reviewCount: reviewsCount, bestRating: 5, worstRating: 1 },
    url: canonicalUrl,
    image: nar.cover_image_url,
    genre: 'Agriculture / Gardening',
    datePublished: '2024-01-01',
    publisher: { '@type': 'Organization', name: 'Denny Angelow', url: 'https://dennyangelow.com' },
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqEntries.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Начало',    item: 'https://dennyangelow.com' },
      { '@type': 'ListItem', position: 2, name: 'Наръчници', item: 'https://dennyangelow.com/naruchnici' },
      { '@type': 'ListItem', position: 3, name: nar.title,   item: canonicalUrl },
    ],
  }

  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Denny Angelow',
    url: 'https://dennyangelow.com',
    jobTitle: 'Агро Консултант',
    description: nar.author_bio || 'Агро консултант, помага на фермери да отглеждат по-здрави растения и да постигат рекордна реколта.',
    sameAs: ['https://dennyangelow.com'],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />

      <NaruchnikClient
        nar={nar}
        others={others}
        faqEntries={faqEntries}
        downloadsCount={downloadsCount}
        avgRating={avgRating}
        reviewsCount={reviewsCount}
      />
    </>
  )
}
