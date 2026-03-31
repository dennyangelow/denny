// app/naruchnik/[slug]/page.tsx — v7
// Server Component — SEO оптимизиран с generateMetadata + директно сваляне

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import NaruchnikClient from './NaruchnikClient'

interface Naruchnik {
  id: string; slug: string; title: string; subtitle?: string
  description?: string; cover_image_url?: string; pdf_url?: string
  category?: string; active: boolean
}

const CAT_EMOJI: Record<string, string> = {
  domati: '🍅', krastavici: '🥒', chushki: '🫑', default: '🌿',
}
export const catEmoji = (cat = '') => CAT_EMOJI[cat] || CAT_EMOJI.default

const CAT_COLOR: Record<string, string> = {
  domati: '#dc2626', krastavici: '#16a34a', chushki: '#ea580c', default: '#16a34a',
}
export const catColor = (cat = '') => CAT_COLOR[cat] || CAT_COLOR.default

export const INSIDE_ITEMS = [
  'Пълен календар за торене и третиране',
  'Кои продукти работят наистина (и кои са пари на вятъра)',
  'Борба с болестите — органични методи без химия',
  'Грешките, които убиват реколтата (и как да ги избегнеш)',
  'Тайните на двойния добив от един декар',
]

// ─── Data fetching ──────────────────────────────────────────────────────────
async function getNaruchnik(slug: string): Promise<{ nar: Naruchnik | null; others: Naruchnik[] }> {
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

    const all: Naruchnik[] = data || []
    const nar = all.find(n => n.slug === slug) || null
    const others = all.filter(n => n.slug !== slug).slice(0, 3)
    return { nar, others }
  } catch {
    return { nar: null, others: [] }
  }
}

// ─── SEO Metadata ───────────────────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const { nar } = await getNaruchnik(params.slug)
  if (!nar) return { title: 'Наръчник не е намерен' }

  const emoji = catEmoji(nar.category)
  return {
    title: `${nar.title} — Безплатен PDF Наръчник | Denny Angelow`,
    description: nar.description
      || `Изтегли безплатно "${nar.title}" — практично ръководство за по-здрави растения и рекордна реколта. ${nar.subtitle || ''}`,
    keywords: [nar.title, 'наръчник', 'безплатен PDF', 'градина', 'земеделие', 'органично'],
    openGraph: {
      title: `${emoji} ${nar.title}`,
      description: nar.description || `Безплатен PDF наръчник — изтегли сега`,
      images: nar.cover_image_url ? [{ url: nar.cover_image_url, width: 800, height: 600 }] : [],
      type: 'article',
    },
  }
}

// ─── PAGE ────────────────────────────────────────────────────────────────────
export default async function NaruchnikPage({ params }: { params: { slug: string } }) {
  const { nar, others } = await getNaruchnik(params.slug)
  if (!nar) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: nar.title,
    description: nar.description,
    author: { '@type': 'Person', name: 'Denny Angelow' },
    inLanguage: 'bg',
    isAccessibleForFree: true,
    url: `https://dennyangelow.com/naruchnik/${nar.slug}`,
    image: nar.cover_image_url,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Всичко интерактивно е в Client Component */}
      <NaruchnikClient nar={nar} others={others} />
    </>
  )
}
