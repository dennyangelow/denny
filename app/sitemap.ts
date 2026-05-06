// app/sitemap.ts — v8
// ✅ ПРОМЯНА спрямо v7: Добавени /products/[slug] за Atlas Terra собствени продукти
//    /products/atlas-terra, /products/atlas-terra-amino, /products/atlas-terra-nitro
//    priority: 0.95 (по-висока от affiliate — собствени продукти са приоритет)

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
    {
      url:             `${BASE_URL}/produkti`,
      lastModified:    new Date(),
      changeFrequency: 'weekly',
      priority:         0.85,
    },
  ]

  // ── 2. Паралелни заявки към БД ───────────────────────────────────────────
  const [naruchnikResult, affiliateResult, ownProductsResult] = await Promise.allSettled([
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
    // ✅ НОВО: Собствени Atlas Terra продукти
    supabaseAdmin
      .from('products')
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

  // ── 5. ✅ НОВО: Собствени Atlas Terra продукти — priority 0.95 ───────────
  // По-висок приоритет от affiliate — това са собствени продукти, основен приход
  let ownProductPages: MetadataRoute.Sitemap = []
  if (ownProductsResult.status === 'fulfilled' && ownProductsResult.value.data) {
    ownProductPages = ownProductsResult.value.data.map((p: SlugRow) => ({
      url:             `${BASE_URL}/products/${p.slug}`,
      lastModified:    safeDate(p.updated_at),
      changeFrequency: 'weekly' as const,  // Цена/наличност се сменя по-често
      priority:         0.95,
    }))
  } else {
    console.error('[sitemap] Грешка собствени продукти:',
      ownProductsResult.status === 'rejected' ? ownProductsResult.reason : ownProductsResult.value.error)
  }

  return [
    ...staticPages,
    ...ownProductPages,   // ✅ Собствени продукти — с най-висок приоритет след начало
    ...naruchnikPages,
    ...affiliatePages,
  ]
}
