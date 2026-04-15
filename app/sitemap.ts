// app/sitemap.ts — v3 SEO
// ✅ Начална страница
// ✅ Наръчници от Supabase (active=true, наредени по sort_order)
// ✅ Собствени продукти (products) — само ако имаш /produkt/[slug] страница
//    → ако нямаш, те сочат към #atlas на началната страница (без отделен URL)
//    → разкоментирай САМО ако имаш /produkt/[slug] route
// ✅ Affiliate продукти — НЕ се включват в sitemap (external URLs, не са твои)
//    → включваме само ако имаш собствена /produkt/[slug] страница за тях

import { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

const BASE_URL = 'https://dennyangelow.com'

interface NaruchnikRow {
  slug:       string
  updated_at: string | null
}

// Разкоментирай ако имаш /produkt/[slug] страница за собствените продукти
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

  // ── 3. Собствени продукти (Atlas Terra) ──────────────────────────────────
  // ВАЖНО: Разкоментирай САМО ако имаш /produkt/[slug] страница в Next.js!
  // Ако продуктите се показват само на началната страница (без собствен URL),
  // НЕ ги включвай в sitemap — Google не може да индексира URL без страница.
  //
  // let atlasProductPages: MetadataRoute.Sitemap = []
  // try {
  //   const { data, error } = await supabaseAdmin
  //     .from('products')
  //     .select('slug, updated_at')
  //     .eq('active', true)
  //     .order('sort_order')
  //
  //   if (!error && data && data.length > 0) {
  //     atlasProductPages = (data as ProductRow[]).map(p => ({
  //       url:             `${BASE_URL}/produkt/${p.slug}`,
  //       lastModified:    p.updated_at ? new Date(p.updated_at) : new Date(),
  //       changeFrequency: 'weekly' as const,
  //       priority:         0.85,
  //     }))
  //   }
  // } catch (err) {
  //   console.error('[sitemap] Грешка при зареждане на продукти:', err)
  // }

  // ── 4. Affiliate продукти ─────────────────────────────────────────────────
  // Affiliate продуктите (agroapteki.com, oranjeriata.com) НЕ се включват в
  // sitemap защото:
  //   a) URL-ите са външни (не са на dennyangelow.com)
  //   b) Ако имаш /produkt/[slug] страница за тях — разкоментирай долу
  //
  // let affiliateProductPages: MetadataRoute.Sitemap = []
  // try {
  //   const { data, error } = await supabaseAdmin
  //     .from('affiliate_products')
  //     .select('slug, updated_at')
  //     .eq('active', true)
  //     .order('sort_order')
  //
  //   if (!error && data && data.length > 0) {
  //     affiliateProductPages = (data as ProductRow[]).map(p => ({
  //       url:             `${BASE_URL}/produkt/${p.slug}`,
  //       lastModified:    p.updated_at ? new Date(p.updated_at) : new Date(),
  //       changeFrequency: 'monthly' as const,
  //       priority:         0.7,
  //     }))
  //   }
  // } catch (err) {
  //   console.error('[sitemap] Грешка при зареждане на affiliate продукти:', err)
  // }

  return [
    ...homePage,
    ...naruchnikPages,
    // ...atlasProductPages,
    // ...affiliateProductPages,
  ]
}
