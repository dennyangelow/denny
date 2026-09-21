// app/sitemap.ts — v13
// ✅ ПРОМЯНА спрямо v12 (снимки в sitemap-а):
//    1. Собствените Atlas Terra продукти вече подават ВСИЧКИ снимки —
//       главна + галерия (етикети и т.н.). Преди: само image_url.
//    2. images вече е string[] от абсолютни URL-и — точно както изисква
//       Next.js (MetadataRoute.Sitemap → images?: string[]). Преди се подаваха
//       обекти {url, title}, което в XML-а излиза като <image:loc>[object Object]
//       </image:loc>. Google така или иначе ползва само <image:loc> (title/caption
//       са отпаднали от image sitemap спецификацията през 2022).
//    Приложено за всички секции: продукти, наръчници, affiliate, блог.
// ✅ ПРОМЯНА спрямо v11: добавени категорийни pillar страници
//    (/blog/domati, /blog/krastavici...) — виж app/blog/[slug]/page.tsx
//    v4 за самата страница. Автоматично, като всичко останало тук: пита
//    blog_categories директно, никога не се добавя ръчно. Филтрирано да
//    показва само категории с поне 1 публикувана статия — категория без
//    съдържание е тънка страница (thin content), не я подаваме на Google.
//    Броят постове по категория се смята от вече изтеглените blogResult
//    данни по-долу, без допълнителна DB заявка.

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
  category?:      string | null
}

interface CategoryRow {
  slug:       string
  updated_at?: string | null
}

// ✅ v13: string[] от абсолютни, уникални URL-и (Next.js очаква images?: string[])
function toImageUrls(list: (string | null | undefined)[]): string[] {
  const abs = list
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map(u => (u.startsWith('/') ? `${BASE_URL}${u}` : u.trim()))
  return Array.from(new Set(abs))
}

function galleryToUrls(g: SlugRow['gallery_urls']): string[] {
  return (Array.isArray(g) ? g : [])
    .map(e => (typeof e === 'string' ? e : e?.url))
    .filter((u): u is string => !!u)
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
  const [naruchnikResult, affiliateResult, ownProductsResult, blogResult, categoriesResult] = await Promise.allSettled([
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
      .select('slug, updated_at, image_url, image_alt, gallery_urls, name')
      .eq('active', true)
      .order('sort_order'),
    supabaseAdmin
      .from('blog_posts')
      .select('slug, updated_at, published_at, cover_image_url, cover_image_alt, title, category')
      .eq('active', true)
      .eq('status', 'published')
      .order('published_at', { ascending: false }),
    // ✅ НОВО
    supabaseAdmin
      .from('blog_categories')
      .select('slug, updated_at')
      .eq('active', true),
  ])

  // ── 3. Наръчници — priority 0.88, с images ───────────────────────────────
  let naruchnikPages: MetadataRoute.Sitemap = []
  if (naruchnikResult.status === 'fulfilled' && naruchnikResult.value.data) {
    naruchnikPages = naruchnikResult.value.data.map((n: SlugRow) => ({
      url:             `${BASE_URL}/naruchnik/${n.slug}`,
      lastModified:    safeDate(n.updated_at),
      changeFrequency: 'monthly' as const,
      priority:         0.88,
      ...(n.cover_image_url ? { images: toImageUrls([n.cover_image_url]) } : {}),
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
      const images = toImageUrls([p.image_url, ...galleryToUrls(p.gallery_urls)])

      return {
        url:             `${BASE_URL}/produkt/${p.slug}`,
        lastModified:    safeDate(p.updated_at),
        changeFrequency: 'monthly' as const,
        priority:         0.72,
        ...(images.length > 0 ? { images } : {}),
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
      // ✅ v13: главна снимка + всички от галерията (етикети и т.н.)
      ...(() => {
        const images = toImageUrls([p.image_url, ...galleryToUrls(p.gallery_urls)])
        return images.length > 0 ? { images } : {}
      })(),
    }))
  } else {
    console.error('[sitemap] Грешка собствени продукти:',
      ownProductsResult.status === 'rejected'
        ? ownProductsResult.reason
        : ownProductsResult.value?.error)
  }

  // ── 6. Блог постове — priority 0.75, между produkti и own products ───────
  let blogPages: MetadataRoute.Sitemap = []
  let blogPostRows: SlugRow[] = []
  if (blogResult.status === 'fulfilled' && blogResult.value.data) {
    blogPostRows = blogResult.value.data
    blogPages = blogPostRows.map((p: SlugRow) => ({
      url:             `${BASE_URL}/blog/${p.slug}`,
      lastModified:    safeDate(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority:         0.75,
      ...(p.cover_image_url ? { images: toImageUrls([p.cover_image_url]) } : {}),
    }))
  } else {
    console.error('[sitemap] Грешка блог постове:',
      blogResult.status === 'rejected'
        ? blogResult.reason
        : blogResult.value?.error)
  }

  // ── 7. НОВО: Категорийни pillar страници — priority 0.8, само за
  //    категории с поне 1 публикувана статия (избягва thin content) ───────
  let categoryPages: MetadataRoute.Sitemap = []
  if (categoriesResult.status === 'fulfilled' && categoriesResult.value.data) {
    const categoriesWithPosts = (categoriesResult.value.data as CategoryRow[]).filter(c =>
      blogPostRows.some(p => p.category === c.slug)
    )
    categoryPages = categoriesWithPosts.map(c => {
      // lastModified = най-новата статия в категорията, иначе категорийната
      // updated_at, иначе днес — за да отразява реално кога хъбът се е сменил
      const latestPostInCategory = blogPostRows
        .filter(p => p.category === c.slug)
        .sort((a, b) => safeDate(b.updated_at).getTime() - safeDate(a.updated_at).getTime())[0]
      return {
        url:             `${BASE_URL}/blog/${c.slug}`,
        lastModified:    safeDate(latestPostInCategory?.updated_at || c.updated_at),
        changeFrequency: 'weekly' as const,
        priority:         0.8,
      }
    })
  } else {
    console.error('[sitemap] Грешка категории:',
      categoriesResult.status === 'rejected'
        ? categoriesResult.reason
        : categoriesResult.value?.error)
  }

  return [
    ...staticPages,
    ...ownProductPages,
    ...naruchnikPages,
    ...categoryPages,
    ...blogPages,
    ...affiliatePages,
  ]
}
