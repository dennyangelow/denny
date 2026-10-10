// app/blog/rss.xml/route.ts — v2
// ✅ v2 (спрямо v1):
//   • НЕ тегли 'content' (цялото тяло на 30 статии само за excerpt) — excerpt
//     се записва в базата при запис на поста (виж app/api/blog/route.ts).
//   • <atom:link rel="self"> и <lastBuildDate> — изискват се от повечето
//     валидатори/четци на RSS.
//   • escapeXml обхваща и кавичките; постове без дата се прескачат вместо
//     да дават "Invalid Date"; при грешка в базата връща 503, а не празен
//     feed, който да се кешира за час.
//   • Feed-ът вече е обявен в <head> (alternates.types в metadata на /blog).
import { supabaseAdmin } from '@/lib/supabase'
import { deriveExcerpt } from '@/lib/blog'

// ✅ RSS четците не проверяват на всяка секунда — 1ч кеш е достатъчен
export const revalidate = 3600

const BASE_URL = 'https://dennyangelow.com'

function escapeXml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('blog_posts')
    .select('slug, title, excerpt, published_at, updated_at')
    .eq('active', true)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('[rss] blog_posts:', error)
    return new Response('Feed temporarily unavailable', { status: 503 })
  }

  const posts = (data || []).filter(p => p.published_at)
  const lastBuild = posts.reduce((max, p) => {
    const t = new Date(p.updated_at || p.published_at).getTime()
    return Number.isFinite(t) && t > max ? t : max
  }, 0)

  const items = posts.map(p => `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${BASE_URL}/blog/${p.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${p.slug}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      <description>${escapeXml(deriveExcerpt(p, 300))}</description>
    </item>`).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Denny Angelow — Блог</title>
    <link>${BASE_URL}/blog</link>
    <atom:link href="${BASE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>Статии за домати, краставици, торене и оранжерии.</description>
    <language>bg-BG</language>${lastBuild ? `
    <lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>` : ''}${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type':  'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
