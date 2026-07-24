// lib/affiliate.ts — v3
// ✅ ПОПРАВКИ спрямо v2:
//   - Добавен parseHowToUse() helper — премахва дублирането между page.tsx и Client
//   - Добавен parseYouTubeEmbed() — безопасен YouTube URL parser (watch, youtu.be, shorts)

export interface DoseRow {
  phase:    string
  dose:     string
  interval: string
}

export interface VsRow {
  feature: string
  ours:    string
  theirs:  string
}

export interface VsCompetitor {
  competitor: string
  vs:         VsRow[]
}

export interface FaqItem {
  q: string
  a: string
}

export interface AffiliateProduct {
  id:              string
  slug:            string
  name:            string
  subtitle?:       string
  badge_text?:     string
  tag_text?:       string
  description?:    string
  full_content?:   string
  features?:       string[]
  bullets?:        string[]
  image_url?:      string
  image_alt?:      string
  emoji?:          string
  color?:          string
  badge_color?:    string
  category_label?: string
  // ✅ Ръчно избрани филтър-групи от админ панела (/produkti чипове).
  // Ако е празно/липсва, клиентският код пада обратно на автоматично
  // картиране по category_label — виж CATEGORY_GROUPS в ProduktCatalogClient.tsx
  filter_groups?:  string[]
  affiliate_url:   string
  partner:         string
  section?:        string
  active:          boolean
  sort_order?:     number
  // SEO
  seo_title?:       string
  seo_description?: string
  seo_keywords?:    string
  // Технически данни
  price?:            number | string  // numeric от Supabase може да е string
  price_currency?:   string
  volume?:           string
  active_substance?: string
  quarantine_days?:  number
  quarantine_note?:  string
  dosage?:           string
  crops?:            string[]
  warnings?:         string[]
  season?:           string
  social_proof?:     string
  youtube_url?:      string
  // JSON полета
  faq?:           FaqItem[]
  dose_table?:    DoseRow[]
  vs_competitor?: VsCompetitor
  // Как се използва — string от JSON array
  how_to_use?:   string   // "[\"стъпка 1\", \"стъпка 2\"]"
  combine_with?: string   // "slug1,slug2,slug3"
  // Рейтинг — numeric в Supabase се връща като string!
  rating?:       number | string
  review_count?: number
  date_published?: string
  // timestamps
  created_at?: string
  updated_at?: string
}

// ── Helper: безопасно конвертира rating към number ─────────────────────────
export function getRating(product: AffiliateProduct): number {
  const r = Number(product.rating)
  return isNaN(r) || r <= 0 ? 4.9 : r
}

// ── Helper: парсира how_to_use (JSON array или newline текст) ──────────────
// ✅ Единична функция — използва се и в page.tsx (server) и в Client
export function parseHowToUse(raw?: string): string[] {
  if (!raw) return []
  // Опит 1: валиден JSON array
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  } catch {}
  // Опит 2: Postgres array синтаксис {a,b,c} → [a,b,c]
  try {
    const fixed  = raw.trim().replace(/^\{/, '[').replace(/\}$/, ']')
    const parsed = JSON.parse(fixed)
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  } catch {}
  // Fallback: newline-разделен текст
  return raw.split('\n').map(s => s.trim()).filter(Boolean)
}

// ── Helper: извлича embed URL от всякакъв YouTube формат ──────────────────
// Поддържа: watch?v=, youtu.be/, shorts/, embed/ (вече embed — pass-through)
// Връща null ако URL-ът не е разпознат YouTube линк
export function parseYouTubeEmbed(url?: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    let videoId: string | null = null

    if (u.hostname === 'youtu.be') {
      // https://youtu.be/VIDEO_ID
      videoId = u.pathname.slice(1).split('/')[0]
    } else if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) {
        // Вече embed — върни директно (без query params за сигурност)
        videoId = u.pathname.replace('/embed/', '').split('/')[0]
      } else if (u.pathname.startsWith('/shorts/')) {
        // https://youtube.com/shorts/VIDEO_ID
        videoId = u.pathname.replace('/shorts/', '').split('/')[0]
      } else {
        // https://youtube.com/watch?v=VIDEO_ID
        videoId = u.searchParams.get('v')
      }
    }

    if (!videoId || !/^[\w-]{11}$/.test(videoId)) return null
    return `https://www.youtube.com/embed/${videoId}`
  } catch {
    return null
  }
}
