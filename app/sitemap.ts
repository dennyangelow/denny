// app/sitemap.ts — финална версия (TypeScript fixed)
import { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

const BASE_URL = 'https://dennyangelow.com'

// ✅ Тип за реда от Supabase — fix за "implicitly has 'any' type"
interface NaruchnikRow {
  slug: string
  updated_at: string | null
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  // ── 1. Начална страница ───────────────────────────────────────────────────
  const homePage: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
  ]

  // ── 2. Наръчници от Supabase ──────────────────────────────────────────────
  let naruchnikPages: MetadataRoute.Sitemap = []

  try {
    const { data, error } = await supabaseAdmin
      .from('naruchnici')
      .select('slug, updated_at')
      .eq('active', true)
      .order('sort_order')

    if (!error && data && data.length > 0) {
      naruchnikPages = (data as NaruchnikRow[]).map((n) => ({
        url: `${BASE_URL}/naruchnik/${n.slug}`,
        lastModified: n.updated_at ? new Date(n.updated_at) : new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.9,
      }))
    }
  } catch (err) {
    console.error('[sitemap] Грешка при зареждане на наръчници:', err)
  }

  return [...homePage, ...naruchnikPages]
}
