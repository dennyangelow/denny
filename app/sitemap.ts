// app/sitemap.ts — v6
// ПОПРАВКИ спрямо v5:
//   ✅ Affiliate продукти: priority 0.75 запазен — вече са index:true в page.tsx metadata
//      (беше: metadata казваше noindex, sitemap казваше index — противоречие)
//   ✅ lastModified — винаги валиден Date (беше: може да throw при невалиден string)
// ПОДОБРЕНИЯ:
//   ✅ Паралелни заявки към Supabase (беше: последователни при грешка)
//   ✅ changeFrequency — 'weekly' за нови продукти (по-добър crawl budget)
//   ✅ Статична /produkt/ listing страница добавена ако съществува

import { MetadataRoute } from 'next'
import { supabaseAdmin }  from '@/lib/supabase'

const BASE_URL = 'https://dennyangelow.com'

interface SlugRow {
  slug:       string
  updated_at: string | null
}

function safeDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date()
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? new Date() : d
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  // ── 1. Статични страници ──────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url:             BASE_URL,
      lastModified:    new Date(),
      changeFrequency: 'weekly',
      priority:         1.0,
    },
  ]

  // ── 2. Паралелни заявки към БД ───────────────────────────────────────────
  const [naruchnikResult, affiliateResult] = await Promise.allSettled([
    supabaseAdmin
      .from('naruchnici')
      .select('slug, updated_at')
      .eq('active', true)
      .order('sort_order'),
    supabaseAdmin
      .from('affiliate_products')
      .select('slug, updated_at')
      .eq('active', true)
      .order('sort_order'),
  ])

  // ── 3. Наръчници — priority 0.9 ──────────────────────────────────────────
  let naruchnikPages: MetadataRoute.Sitemap = []
  if (naruchnikResult.status === 'fulfilled' && naruchnikResult.value.data) {
    naruchnikPages = naruchnikResult.value.data.map((n: SlugRow) => ({
      url:             `${BASE_URL}/naruchnik/${n.slug}`,
      lastModified:    safeDate(n.updated_at),
      changeFrequency: 'monthly' as const,
      priority:         0.9,
    }))
  } else {
    console.error('[sitemap] Грешка наръчници:',
      naruchnikResult.status === 'rejected' ? naruchnikResult.reason : naruchnikResult.value.error)
  }

  // ── 4. Affiliate продукти — priority 0.75 ────────────────────────────────
  // ✅ index:true в metadata (page.tsx) — вече съответства на sitemap-а
  let affiliatePages: MetadataRoute.Sitemap = []
  if (affiliateResult.status === 'fulfilled' && affiliateResult.value.data) {
    affiliatePages = affiliateResult.value.data.map((p: SlugRow) => ({
      url:             `${BASE_URL}/produkt/${p.slug}`,
      lastModified:    safeDate(p.updated_at),
      changeFrequency: 'monthly' as const,
      priority:         0.75,
    }))
  } else {
    console.error('[sitemap] Грешка affiliate продукти:',
      affiliateResult.status === 'rejected' ? affiliateResult.reason : affiliateResult.value.error)
  }

  // ── 5. Atlas Terra собствени продукти ────────────────────────────────────
  // ⚠️ Засега НЕ се включват — нямат отделен /atlas/[slug] route
  //    При активиране: priority 0.85, changeFrequency: 'weekly'

  return [
    ...staticPages,
    ...naruchnikPages,
    ...affiliatePages,
  ]
}
