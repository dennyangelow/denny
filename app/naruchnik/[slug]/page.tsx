// app/naruchnik/[slug]/page.tsx — v8
// Server Component — SEO оптимизиран с generateMetadata + generateStaticParams

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import NaruchnikClient from './NaruchnikClient'

interface Naruchnik {
  id: string; slug: string; title: string; subtitle?: string
  description?: string; cover_image_url?: string; pdf_url?: string
  category?: string; active: boolean
}

// ─── Supabase helper ─────────────────────────────────────────────────────────
async function getAllNaruchnici(): Promise<Naruchnik[]> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data } = await supabase
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

// ─── Static params (SSG) ─────────────────────────────────────────────────────
export async function generateStaticParams() {
  const all = await getAllNaruchnici()
  return all.map(n => ({ slug: n.slug }))
}

// ─── SEO Metadata ────────────────────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const { nar } = await getNaruchnik(params.slug)
  if (!nar) return { title: 'Наръчник не е намерен' }

  const title = `${nar.title} — Безплатен PDF Наръчник | Denny Angelow`
  const description = nar.description
    || `Изтегли безплатно "${nar.title}" — практично ръководство за по-здрави растения и рекордна реколта. ${nar.subtitle || ''}`

  return {
    title,
    description,
    keywords: [
      nar.title,
      'наръчник',
      'безплатен PDF',
      'градина',
      'земеделие',
      'органично',
      'реколта',
      'торене',
      nar.category || '',
    ].filter(Boolean),

    // Canonical + alternates
    alternates: {
      canonical: `https://dennyangelow.com/naruchnik/${nar.slug}`,
    },

    // Open Graph
    openGraph: {
      title,
      description,
      url: `https://dennyangelow.com/naruchnik/${nar.slug}`,
      siteName: 'Denny Angelow',
      locale: 'bg_BG',
      type: 'article',
      images: nar.cover_image_url
        ? [{ url: nar.cover_image_url, width: 800, height: 600, alt: nar.title }]
        : [],
      publishedTime: new Date().toISOString(),
      authors: ['Denny Angelow'],
    },

    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: nar.cover_image_url ? [nar.cover_image_url] : [],
    },

    // Robots — full indexing + snippets
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
  }
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default async function NaruchnikPage({ params }: { params: { slug: string } }) {
  const { nar, others } = await getNaruchnik(params.slug)
  if (!nar) notFound()

  // ── Schema.org structured data ────────────────────────────────────────────
  // Book schema — helps Google show rich results
  const bookSchema = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: nar.title,
    description: nar.description || nar.subtitle,
    author: {
      '@type': 'Person',
      name: 'Denny Angelow',
      url: 'https://dennyangelow.com',
    },
    inLanguage: 'bg',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BGN',
      availability: 'https://schema.org/InStock',
    },
    url: `https://dennyangelow.com/naruchnik/${nar.slug}`,
    image: nar.cover_image_url,
    genre: 'Agriculture / Gardening',
    datePublished: '2024-01-01',
    publisher: {
      '@type': 'Organization',
      name: 'Denny Angelow',
      url: 'https://dennyangelow.com',
    },
  }

  // FAQPage schema — targets featured snippets
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Наистина ли е безплатен наръчникът "${nar.title}"?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Да, наръчникът "${nar.title}" е напълно безплатен. Просто въведи своето име, имейл и телефон и PDF-ът се изтегля автоматично.`,
        },
      },
      {
        '@type': 'Question',
        name: `Какво съдържа наръчникът "${nar.title}"?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Наръчникът съдържа: пълен календар за торене и третиране, органични методи за борба с болести, съвети за двоен добив от декар и грешките, които унищожават реколтата.`,
        },
      },
    ],
  }

  // BreadcrumbList schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Начало', item: 'https://dennyangelow.com' },
      { '@type': 'ListItem', position: 2, name: 'Наръчници', item: 'https://dennyangelow.com/naruchnici' },
      { '@type': 'ListItem', position: 3, name: nar.title, item: `https://dennyangelow.com/naruchnik/${nar.slug}` },
    ],
  }

  return (
    <>
      {/* Structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* All interactive UI is in Client Component */}
      <NaruchnikClient nar={nar} others={others} />
    </>
  )
}
