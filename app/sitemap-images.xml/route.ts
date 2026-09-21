// app/sitemap-images.xml/route.ts — v1
// ✅ Отделен image sitemap за Собствени (Atlas Terra) и Affiliate продукти.
//
// ЗАЩО Е ОТДЕЛЕН: package.json е на Next.js 14.2.x, а поддръжката на `images`
// в MetadataRoute.Sitemap (app/sitemap.ts) е добавена по-късно (Next 15). На 14.2
// полето `images` в sitemap.ts най-вероятно се игнорира мълчаливо — т.е. в
// /sitemap.xml няма нито един <image:image> таг. Този route генерира стандартния
// Google image sitemap ръчно и работи на всяка версия.
//
// Съдържа: главна снимка + всички от галерията (етикети и т.н.), абсолютни URL-и.
// Google ползва само <image:loc> (title/caption са отпаднали от спецификацията).
// Подава се на Google чрез robots.ts (sitemap: [...]) и/или Search Console.

import { supabaseAdmin } from '@/lib/supabase'

export const revalidate = 3600 // 1 час — като sitemap.ts

const BASE_URL = 'https://dennyangelow.com'

type GalleryEntry = string | { url: string; alt?: string }

interface Row {
  slug:          string
  updated_at:    string | null
  image_url:     string | null
  gallery_urls:  GalleryEntry[] | null
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

function imageUrls(row: Row): string[] {
  const gallery = (Array.isArray(row.gallery_urls) ? row.gallery_urls : [])
    .map(e => (typeof e === 'string' ? e : e?.url))
  const all = [row.image_url, ...gallery]
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map(u => (u.startsWith('/') ? `${BASE_URL}${u}` : u.trim()))
  return Array.from(new Set(all))
}

function urlBlock(path: string, row: Row): string {
  const imgs = imageUrls(row)
  if (imgs.length === 0) return ''
  const lastmod = row.updated_at && !isNaN(new Date(row.updated_at).getTime())
    ? `\n    <lastmod>${new Date(row.updated_at).toISOString()}</lastmod>`
    : ''
  return `  <url>
    <loc>${esc(`${BASE_URL}${path}/${row.slug}`)}</loc>${lastmod}
${imgs.map(u => `    <image:image>\n      <image:loc>${esc(u)}</image:loc>\n    </image:image>`).join('\n')}
  </url>`
}

export async function GET() {
  const blocks: string[] = []

  try {
    const [own, affiliate] = await Promise.all([
      supabaseAdmin.from('products')
        .select('slug, updated_at, image_url, gallery_urls')
        .eq('active', true).order('sort_order'),
      supabaseAdmin.from('affiliate_products')
        .select('slug, updated_at, image_url, gallery_urls')
        .eq('active', true).order('sort_order'),
    ])

    if (own.error)       console.error('[sitemap-images] own products:', own.error.message)
    if (affiliate.error) console.error('[sitemap-images] affiliate:', affiliate.error.message)

    for (const r of (own.data ?? []) as Row[])       blocks.push(urlBlock('/products', r))
    for (const r of (affiliate.data ?? []) as Row[]) blocks.push(urlBlock('/produkt', r))
  } catch (err) {
    console.error('[sitemap-images] error:', err)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
${blocks.filter(Boolean).join('\n')}
</urlset>
`

  return new Response(xml, {
    headers: {
      'Content-Type':  'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
