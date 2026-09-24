// lib/affiliate.ts — v5
// ✅ v5: image_width/image_height + gallery_urls[].width/height — реалният
//    пикселен размер на всяка снимка, измерен от браузъра при качване (виж
//    ImageUpload.tsx v2). Позволява на lightbox-а да рендира снимките с
//    next/image в реалния им размер, вместо в кутия с фиксирана пропорция.
//    По избор навсякъде — стари продукти без тези полета просто нямат width/
//    height в ProductImage и клиентът пада обратно към старото поведение.
// ✅ ПОПРАВКИ спрямо v3:
//   - Типизирани composition/mode_of_action/ph/density/storage_instructions/
//     application_intro/featured_home/home_order — вече ги има в Supabase,
//     но липсваха тук; клиентът ги четеше с `(product as any)`.
//   - НОВО: manufacturer + registration_number — реален производител и
//     официален регистрационен номер, структурирани (не заровени в текст).
//   - НОВО: reviews (ReviewItem[]) — реални отзиви зад AggregateRating.
//   - getRating()/review_count вече НЕ фабрикуват фиктивни стойности
//     (старите fallback-и 4.9 / 847 показваха измислено социално доказателство
//     за продукти без реални данни) — виж getRating/getReviewCount/hasRealRating.

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

export interface CompositionRow {
  element: string
  content: string
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
  // ✅ Реален пикселен размер на image_url, измерен при качване (виж ImageUpload.tsx).
  //    По избор — по-стари продукти нямат тези колони попълнени.
  image_width?:    number
  image_height?:   number
  // ✅ Допълнителни снимки (галерия) — image_url остава главна/hero снимка.
  // Всеки елемент може да е обикновен string URL (стар формат) или обект
  // {url, alt, width, height} с ръчен alt текст и/или реален размер. Ако alt
  // липсва/е празен, се генерира автоматично в getAllImages(); width/height
  // липсват при по-стари снимки, качени преди v5.
  gallery_urls?:   (string | { url: string; alt?: string; width?: number; height?: number })[]
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

  // ✅ НОВО: полета, които вече съществуват в Supabase (виж CSV export),
  //    но не бяха описани тук — в клиента се четяха с `(product as any)`.
  //    Сега са официално типизирани, без нужда от any cast никъде.
  composition?:           CompositionRow[]
  mode_of_action?:        string[]
  ph?:                    string
  density?:               string
  storage_instructions?:  string
  application_intro?:     string
  featured_home?:         boolean
  home_order?:            number | null

  // ✅ НОВО: реален производител — различен от `partner` (търговецът/
  //    партньорът, напр. "agroapteki"). Нужен за коректен `brand` в
  //    Product schema (Google очаква производител, не търговец).
  manufacturer?:          string

  // ✅ НОВО: официален регистрационен номер на препарата (напр. пред
  //    БАБХ/МЗХГ) — структуриран, вместо заровен в full_content/faq текст.
  //    Използва се и като `mpn` в Product schema.
  registration_number?:   string

  // ✅ ФИКС: `reviews?: ReviewItem[]` премахнато — affiliate_products.reviews
  // колоната е DROP-ната (винаги беше празна, 0/39 продукта). Реалните
  // отзиви вече идват изцяло от обединената `reviews` таблица (lib/reviews.ts).
}

// ── Helper: безопасно конвертира rating към number ─────────────────────────
// ✅ ФИКС: старата версия връщаше фиктивно 4.9, ако продуктът няма реален
//    rating — на практика измислен позитивен резултат в AggregateRating
//    schema (риск за Google manual action за fake reviews, и просто нечестно
//    към читателя). Сега връща 0 при липса на реален rating; извикващият код
//    (page.tsx / клиентът) трябва да скрие звездите/schema-та изцяло, когато
//    getRating() === 0 или getReviewCount() === 0 — виж getReviewCount() долу.
export function getRating(product: AffiliateProduct): number {
  const r = Number(product.rating)
  return isNaN(r) || r <= 0 ? 0 : r
}

// ── Helper: безопасно конвертира review_count към number ───────────────────
// ✅ ФИКС: премахва предишния hardcoded fallback от 847 отзива в page.tsx —
//    измислена бройка, показвана за всеки продукт без реален review_count.
export function getReviewCount(product: AffiliateProduct): number {
  const n = Number(product.review_count)
  return isNaN(n) || n < 0 ? 0 : n
}

// ── Helper: има ли продуктът достатъчно данни, за да покажем рейтинг ───────
export function hasRealRating(product: AffiliateProduct): boolean {
  return getRating(product) > 0 && getReviewCount(product) > 0
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

// ── Helper: обединява главната снимка + галерията в един уникален списък ──
// ✅ image_url винаги е images[0] (hero/OG/schema fallback), gallery_urls се
//    добавят след нея. Дублирани URL-и се премахват. Всяка снимка получава
//    собствен, уникален alt текст — важно за SEO класиране в Google Images
//    (еднакъв alt на няколко снимки обърква Google кой резултат да покаже).
// ✅ v5: width/height по избор — присъстват само ако снимката е качена след
//    ImageUpload.tsx v2 и браузърът реално ги е измерил при качването.
export interface ProductImage { url: string; alt: string; width?: number; height?: number }

export function getAllImages(product: AffiliateProduct): ProductImage[] {
  const seen = new Set<string>()
  const images: ProductImage[] = []
  const baseAlt = product.image_alt || product.name

  if (product.image_url && !seen.has(product.image_url)) {
    seen.add(product.image_url)
    images.push({ url: product.image_url, alt: baseAlt, width: product.image_width, height: product.image_height })
  }

  const gallery = Array.isArray(product.gallery_urls) ? product.gallery_urls : []
  for (const entry of gallery) {
    const url       = typeof entry === 'string' ? entry : entry?.url
    const customAlt = typeof entry === 'string' ? undefined : entry?.alt
    const width     = typeof entry === 'string' ? undefined : entry?.width
    const height    = typeof entry === 'string' ? undefined : entry?.height
    if (!url || seen.has(url)) continue
    seen.add(url)
    // ✅ Ръчен alt текст ако е въведен и не е празен, иначе автоматично
    const autoAlt = `${baseAlt} — снимка ${images.length + 1}`
    images.push({ url, alt: customAlt && customAlt.trim() ? customAlt.trim() : autoAlt, width, height })
  }

  return images
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
