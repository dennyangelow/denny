// app/sitemap.ts — v11
// ✅ ПРОМЯНА спрямо v10:
//   - Добавен export const revalidate. Без него app/sitemap.ts рискуваше да
//     остане статично кеширан от build-а до следващия deploy — нова статия
//     можеше да не се появи в живия sitemap.xml, докато не пуснеш нов
//     deploy, независимо от revalidate=300 логиката на другите страници.
//   - ФИКС: image title за блог постовете четеше p.image_alt (поле, което
//     съществува само за affiliate продуктите), а не p.cover_image_alt
//     (реалното поле, теглено за blog_posts) — значи алт текстът на
//     корицата никога реално не се ползваше в image sitemap-а за блог
//     постовете, винаги падаше на title fallback. Сега чете правилното поле.

import { MetadataRoute } from 'next'
import { supabaseAdmin }  from '@/lib/supabase'

export const revalidate = 3600 // 1 час — sitemap не се нуждае от по-често опресняване

const BASE_URL = 'https://dennyangelow.com'

interface SlugRow {
  slug:           string
  updated_at:     string | null
  cover_image_url?: string | null
  cover_image_alt?: string | null
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
    {
      url:             `${BASE_URL}/blog`,
      lastModified:    new Date(),
      changeFrequency: 'daily',
      priority:         0.8,
    },
  ]

  // ── 2. Паралелни заявки ───────────────────────────────────────────────────
  const [naruchnikResult, affiliateResult, ownProductsResult, blogResult] = await Promise.allSettled([
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
    supabaseAdmin
      .from('blog_posts')
      .select('slug, updated_at, published_at, cover_image_url, cover_image_alt, title')
      .eq('active', true)
      .eq('status', 'published')
      .order('published_at', { ascending: false }),
  ])

  // ── 3. Наръчници — priority 0.88, с images ───────────────────────────────
  let naruchnikPages: MetadataRoute.Sitemap = []
  if (naruchnikResult.status === 'fulfilled' && naruchnikResult.value.data) {
    naruchnikPages = naruchnikResult.value.data.map((n: SlugRow) => ({
      url:             `${BASE_URL}/naruchnik/${n.slug}`,
      lastModified:    safeDate(n.updated_at),
      changeFrequency: 'monthly' as const,
      priority:         0.88,
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

  // ── 6. Блог постове — priority 0.75, между produkti и own products ───────
  // ✅ ФИКС: p.cover_image_alt (не p.image_alt — това поле не съществува за
  //    блог редовете, беше винаги undefined тук, значи image title винаги
  //    падаше на title fallback).
  let blogPages: MetadataRoute.Sitemap = []
  if (blogResult.status === 'fulfilled' && blogResult.value.data) {
    blogPages = blogResult.value.data.map((p: SlugRow) => ({
      url:             `${BASE_URL}/blog/${p.slug}`,
      lastModified:    safeDate(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority:         0.75,
      ...(p.cover_image_url ? {
        images: [{ url: p.cover_image_url, title: p.cover_image_alt || p.title || p.slug }]
      } : {}),
    }))
  } else {
    console.error('[sitemap] Грешка блог постове:',
      blogResult.status === 'rejected'
        ? blogResult.reason
        : blogResult.value?.error)
  }

  return [
    ...staticPages,
    ...ownProductPages,
    ...naruchnikPages,
    ...blogPages,
    ...affiliatePages,
  ]
}
