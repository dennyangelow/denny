// app/sitemap.ts — v10
// ✅ ПОПРАВКИ спрямо v9:
//   - Премахната /naruchnici от sitemap (redirect към /#naruchnici → Google не индексира)
//   - Добавени images[] към naruchnik и products entries (Image Search трафик)
//   - affiliate priority: 0.72 (без промяна)
//   - /produkti revalidate: 300s вместо 60s (намалява Supabase натоварването)

import { MetadataRoute } from 'next'
import { supabaseAdmin }  from '@/lib/supabase'

const BASE_URL = 'https://dennyangelow.com'

interface SlugRow {
  slug:           string
  updated_at:     string | null
  cover_image_url?: string | null
  image_url?:     string | null
  image_alt?:     string | null
  gallery_urls?:  (string | { url: string; alt?: string })[] | null
  title?:         string | null
  name?:          string | null
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
    // ✅ ПРЕМАХНАТО: /naruchnici (редиректва към /#naruchnici — Google не го индексира)
    // Ако създадеш реална /naruchnici страница, добави тук обратно
  ]

  // ── 2. Паралелни заявки ───────────────────────────────────────────────────
  const [naruchnikResult, affiliateResult, ownProductsResult] = await Promise.allSettled([
    supabaseAdmin
      .from('naruchnici')
      .select('slug, updated_at, cover_image_url, title')
      .eq('active', true)
      .order('sort_order'),
    supabaseAdmin
      .from('affiliate_products')
      .select('slug, updated_at, image_url, image_alt, gallery_urls, name')
      .eq('active', true)
      .order('sort_order'),
    supabaseAdmin
      .from('products')
      .select('slug, updated_at, image_url, name')
      .eq('active', true)
      .order('sort_order'),
  ])

  // ── 3. Наръчници — priority 0.88, с images ───────────────────────────────
  let naruchnikPages: MetadataRoute.Sitemap = []
  if (naruchnikResult.status === 'fulfilled' && naruchnikResult.value.data) {
    naruchnikPages = naruchnikResult.value.data.map((n: SlugRow) => ({
      url:             `${BASE_URL}/naruchnik/${n.slug}`,
      lastModified:    safeDate(n.updated_at),
      changeFrequency: 'monthly' as const,
      priority:         0.88,
      // ✅ НОВО: Image sitemap — Google Image Search трафик
      ...(n.cover_image_url ? {
        images: [{ url: n.cover_image_url, title: n.title || n.slug }]
      } : {}),
    }))
  } else {
    console.error('[sitemap] Грешка наръчници:',
      naruchnikResult.status === 'rejected'
        ? naruchnikResult.reason
        : naruchnikResult.value?.error)
  }

  // ── 4. Affiliate продукти — priority 0.72 ────────────────────────────────
  let affiliatePages: MetadataRoute.Sitemap = []
  if (affiliateResult.status === 'fulfilled' && affiliateResult.value.data) {
    affiliatePages = affiliateResult.value.data.map((p: SlugRow) => {
      // ✅ Всички снимки на продукта (главна + галерия). Ако снимка има
      //    ръчен alt текст, той се ползва като title в sitemap-а; иначе —
      //    автоматично генериран, страницата пак работи пълноценно.
      const gallery = Array.isArray(p.gallery_urls) ? p.gallery_urls : []
      const entries = [
        ...(p.image_url ? [{ url: p.image_url, alt: p.image_alt || undefined }] : []),
        ...gallery.map(e => typeof e === 'string' ? { url: e, alt: undefined } : { url: e.url, alt: e.alt }),
      ].filter(e => !!e.url)

      return {
        url:             `${BASE_URL}/produkt/${p.slug}`,
        lastModified:    safeDate(p.updated_at),
        changeFrequency: 'monthly' as const,
        priority:         0.72,
        ...(entries.length > 0 ? {
          images: entries.map((e, i) => ({
            url:   e.url,
            title: e.alt?.trim() || (i === 0 ? (p.name || p.slug) : `${p.name || p.slug} — снимка ${i + 1}`),
          }))
        } : {}),
      }
    })
  } else {
    console.error('[sitemap] Грешка affiliate продукти:',
      affiliateResult.status === 'rejected'
        ? affiliateResult.reason
        : affiliateResult.value?.error)
  }

  // ── 5. Собствени Atlas Terra продукти — priority 0.95 ────────────────────
  let ownProductPages: MetadataRoute.Sitemap = []
  if (ownProductsResult.status === 'fulfilled' && ownProductsResult.value.data) {
    ownProductPages = ownProductsResult.value.data.map((p: SlugRow) => ({
      url:             `${BASE_URL}/products/${p.slug}`,
      lastModified:    safeDate(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority:         0.95,
      ...(p.image_url ? {
        images: [{ url: p.image_url, title: p.name || p.slug }]
      } : {}),
    }))
  } else {
    console.error('[sitemap] Грешка собствени продукти:',
      ownProductsResult.status === 'rejected'
        ? ownProductsResult.reason
        : ownProductsResult.value?.error)
  }

  return [
    ...staticPages,
    ...ownProductPages,
    ...naruchnikPages,
    ...affiliatePages,
  ]
} 