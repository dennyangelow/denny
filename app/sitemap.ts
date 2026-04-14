// app/sitemap.ts — v2
// ✅ Начална страница
// ✅ Наръчници от Supabase (active=true, наредени по sort_order)
// ✅ Афилиейт продукти — закоментирано, разкоментирай когато добавиш /produkt/[slug] страница

import { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

const BASE_URL = 'https://dennyangelow.com'

interface NaruchnikRow {
  slug:       string
  updated_at: string | null
}

// interface ProductRow {
//   slug:       string
//   updated_at: string | null
// }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  // ── 1. Начална страница ──────────────────────────────────────────────────
  const homePage: MetadataRoute.Sitemap = [
    {
      url:             BASE_URL,
      lastModified:    new Date(),
      changeFrequency: 'weekly',
      priority:         1.0,
    },
  ]

  // ── 2. Наръчници от Supabase ─────────────────────────────────────────────
  let naruchnikPages: MetadataRoute.Sitemap = []

  try {
    const { data, error } = await supabaseAdmin
      .from('naruchnici')
      .select('slug, updated_at')
      .eq('active', true)
      .order('sort_order')

    if (!error && data && data.length > 0) {
      naruchnikPages = (data as NaruchnikRow[]).map(n => ({
        url:             `${BASE_URL}/naruchnik/${n.slug}`,
        lastModified:    n.updated_at ? new Date(n.updated_at) : new Date(),
        changeFrequency: 'monthly' as const,
        priority:         0.9,
      }))
    }
  } catch (err) {
    console.error('[sitemap] Грешка при зареждане на наръчници:', err)
  }

  // ── 3. Афилиейт продукти ─────────────────────────────────────────────────
  // Разкоментирай когато добавиш /produkt/[slug] страница за всеки продукт.
  //
  // let productPages: MetadataRoute.Sitemap = []
  // try {
  //   const { data, error } = await supabaseAdmin
  //     .from('affiliate_products')
  //     .select('slug, updated_at')
  //     .eq('active', true)
  //     .order('sort_order')
  //
  //   if (!error && data && data.length > 0) {
  //     productPages = (data as ProductRow[]).map(p => ({
  //       url:             `${BASE_URL}/produkt/${p.slug}`,
  //       lastModified:    p.updated_at ? new Date(p.updated_at) : new Date(),
  //       changeFrequency: 'monthly' as const,
  //       priority:         0.7,
  //     }))
  //   }
  // } catch (err) {
  //   console.error('[sitemap] Грешка при зареждане на продукти:', err)
  // }

  return [
    ...homePage,
    ...naruchnikPages,
    // ...productPages,
  ]
}
