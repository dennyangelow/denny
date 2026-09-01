// app/blog/rss.xml/route.ts — v1
import { supabaseAdmin } from '@/lib/supabase'
import { deriveExcerpt } from '@/lib/blog'

// ✅ RSS четците не проверяват на всяка секунда — 1ч кеш е достатъчен и
//    маха ненужните заявки към Supabase при всяко посещение на feed-а.
export const revalidate = 3600

const BASE_URL = 'https://dennyangelow.com'

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function GET() {
  const { data } = await supabaseAdmin
    .from('blog_posts')
    .select('slug, title, excerpt, content, published_at, updated_at')
    .eq('active', true)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(30)

  const posts = data || []

  const items = posts.map(p => `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${BASE_URL}/blog/${p.slug}</link>
      <guid>${BASE_URL}/blog/${p.slug}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      <description>${escapeXml(deriveExcerpt(p, 300))}</description>
    </item>`).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Denny Angelow — Блог</title>
    <link>${BASE_URL}/blog</link>
    <description>Статии за домати, краставици, торене и оранжерии.</description>
    <language>bg-BG</language>${items}
  </channel>
</rss>`

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
