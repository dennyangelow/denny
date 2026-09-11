'use client'
// components/layout/SiteFooter.tsx — v8
// ✅ ПРОМЯНА спрямо v7:
//   - Социалните икони (FB/IG/YT/TT) вече са истински SVG лога, не букви.
//   - Линковете им вече идват от settings (SettingsTab → "📱 Социални
//     мрежи") — social_facebook_url/social_instagram_url/
//     social_youtube_url/social_tiktok_url. Ако полето не е зададено в
//     settings изобщо → пада на DEFAULTS (старите линкове). Ако admin го
//     е изчистил нарочно (празен string) → иконата на тази мрежа не се
//     показва изобщо, вместо да сочи към грешен/случаен акаунт.
//   - Праг за Блог showcase свален от 5 на 4: ≤3 статии → компактна 4-та
//     колона в горния ред; ≥4 статии → widescreen секция под него, вече
//     3 колони (не 2), до 9 статии общо (/api/blog?limit=9).
//
// ✅ ПРОМЯНА спрямо v4: optional `settings` prop — контактите
//    (site_email/site_phone/whatsapp_number) и footer_about_text вече
//    могат да идват от settings таблицата, вместо да са hardcoded само
//    тук. Ако settings не е подаден/полето липсва — пада на старите
//    hardcoded стойности (DEFAULTS по-долу).
//
// ✅ ПОПРАВКА спрямо v2:
//   - Наръчниците се теглят динамично от /api/naruchnici вместо твърдо
//     закодирани линкове — никога не сочи към остарял/грешен slug.

import { useState, useEffect } from 'react'

const AFF = 'ref=dennyangelow'

// ✅ Праг за превключване между компактна колона (≤3) и широк showcase (≥4).
const BLOG_SHOWCASE_THRESHOLD = 4

// ✅ Fallback стойности — ползват се, ако settings prop не е подаден
//    или конкретното поле липсва в него (undefined — не изчистено нарочно).
const DEFAULTS = {
  footer_about_text:   'Помагам на фермери да отглеждат по-здрави растения с проверени органични методи и правилна защита.',
  site_email:          'support@dennyangelow.com',
  site_phone:          '+359876238623',
  whatsapp_number:     '359876238623',
  social_facebook_url:  'https://www.facebook.com/dennyangelow',
  social_instagram_url: 'https://www.instagram.com/dennyangelow',
  social_youtube_url:   'https://www.youtube.com/@dennyangelow',
  social_tiktok_url:    'https://www.tiktok.com/@dennyangelow',
}

interface NaruchnikLink { slug: string; title: string; category?: string }

const CATEGORY_EMOJI: Record<string, string> = {
  'Домати':      '🍅',
  'Краставици':  '🥒',
}

function emojiFor(category?: string): string {
  return (category && CATEGORY_EMOJI[category]) || '📗'
}

interface BlogLink { slug: string; title: string }

interface Props {
  // ✅ По избор — приема или плоския Record<string,string> от
  //    getSettings()/lib/settings.ts, ИЛИ типизиран settings обект (напр.
  //    SiteSettings от OwnProduktClient.tsx), стига да съдържа тези полета
  //    като string. Тесен интерфейс вместо Record<string,string> нарочно —
  //    Record<string,string> изисква index signature от подадения обект,
  //    което SiteSettings (типизиран интерфейс с числови полета като
  //    shipping_econt) не удовлетворява и би гръмнало TypeScript.
  settings?: {
    footer_about_text?:    string
    site_email?:           string
    site_phone?:            string
    whatsapp_number?:      string
    social_facebook_url?:  string
    social_instagram_url?: string
    social_youtube_url?:   string
    social_tiktok_url?:    string
  }
}

// ─── Социални икони — прости, разпознаваеми SVG лога (currentColor) ──────────
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21.9v-8.1h2.7l.4-3.2h-3.1V8.6c0-.9.3-1.6 1.7-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.4v3.2H10v8.1h3.5z"/>
    </svg>
  )
}
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5"/>
      <circle cx="12" cy="12" r="4.6"/>
      <circle cx="17.7" cy="6.3" r="1" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="1.5" y="5" width="21" height="14" rx="4"/>
      <path d="M10 8.7l6 3.3-6 3.3z" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function TiktokIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M16.6 2c.3 1.9 1.5 3.5 3.3 4.2.5.2 1 .3 1.5.3v3.1c-1.6 0-3.1-.5-4.4-1.4v6.9c0 3.5-2.8 6.3-6.3 6.3s-6.3-2.8-6.3-6.3c0-3.4 2.7-6.2 6.1-6.3v3.2c-1.7.1-3 1.5-3 3.1 0 1.7 1.4 3.1 3.1 3.1s3.1-1.4 3.1-3.1V2h3z"/>
    </svg>
  )
}

export default function SiteFooter({ settings }: Props) {
  const [naruchnici, setNaruchnici] = useState<NaruchnikLink[]>([])
  const [blogPosts,  setBlogPosts]  = useState<BlogLink[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/naruchnici')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        const list = Array.isArray(data?.naruchnici) ? data.naruchnici : []
        setNaruchnici(list.map((n: any) => ({ slug: n.slug, title: n.title, category: n.category })))
      })
      .catch(() => {}) // ✅ тих fail — footer-ът просто показва секцията без линкове
    return () => { cancelled = true }
  }, [])

  // ✅ До 9 последни блог поста — таван за showcase режима (3×3).
  //    Компактният режим показва само първите 3 от същия списък.
  useEffect(() => {
    let cancelled = false
    fetch('/api/blog?limit=9')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        const list = Array.isArray(data?.posts) ? data.posts : []
        setBlogPosts(list.map((p: any) => ({ slug: p.slug, title: p.title })))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ✅ settings[key] → DEFAULTS[key] → никога undefined/празно в JSX-а
  const aboutText      = settings?.footer_about_text?.trim() || DEFAULTS.footer_about_text
  const email          = settings?.site_email?.trim()        || DEFAULTS.site_email
  const phone          = settings?.site_phone?.trim()        || DEFAULTS.site_phone
  const whatsappNumber = settings?.whatsapp_number?.trim()   || DEFAULTS.whatsapp_number

  // ✅ Социални линкове: undefined (полето изобщо не е в settings) → default.
  //    Изрично празен string (admin е изчистил полето) → мрежата се крие.
  const socialDefs = [
    { key: 'facebook',  label: 'Facebook',  Icon: FacebookIcon,
      url: settings?.social_facebook_url  !== undefined ? settings.social_facebook_url.trim()  : DEFAULTS.social_facebook_url },
    { key: 'instagram', label: 'Instagram', Icon: InstagramIcon,
      url: settings?.social_instagram_url !== undefined ? settings.social_instagram_url.trim() : DEFAULTS.social_instagram_url },
    { key: 'youtube',   label: 'YouTube',   Icon: YoutubeIcon,
      url: settings?.social_youtube_url   !== undefined ? settings.social_youtube_url.trim()   : DEFAULTS.social_youtube_url },
    { key: 'tiktok',    label: 'TikTok',    Icon: TiktokIcon,
      url: settings?.social_tiktok_url    !== undefined ? settings.social_tiktok_url.trim()    : DEFAULTS.social_tiktok_url },
  ].filter(s => s.url.length > 0)

  const hasBlog     = blogPosts.length > 0
  const isShowcase  = blogPosts.length >= BLOG_SHOWCASE_THRESHOLD
  const compactBlog = hasBlog && !isShowcase

  return (
    <footer suppressHydrationWarning style={{
      background: 'linear-gradient(180deg, #0a1f12 0%, #051a0d 100%)',
      color: 'rgba(255,255,255,0.5)',
      padding: '56px 24px 32px',
      fontFamily: "var(--font-dm-sans), sans-serif",
    }}>
      <style suppressHydrationWarning>{`
        .sf-inner { max-width: 1060px; margin: 0 auto; }

        /* ── Горен ред: Лого · Наръчници · Партньори+Контакт (+ Блог, ако е компактен) ──
           ✅ Равни колони (1fr 1fr 1fr) и същия gap като .sf-blog-grid по-долу —
           умишлено, за да се подравнят визуално двата реда една под друга,
           вместо да изглеждат като два несвързани грида. */
        .sf-top-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 30px; margin-bottom: 36px;
        }
        .sf-top-grid--with-blog { grid-template-columns: repeat(4, 1fr); }
        @media (max-width: 1050px) { .sf-top-grid--with-blog { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 900px) {
          .sf-top-grid { grid-template-columns: 1fr 1fr; gap: 26px; }
          .sf-top-grid--with-blog { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 520px) {
          .sf-top-grid, .sf-top-grid--with-blog { grid-template-columns: 1fr; }
        }

        /* ── Блог showcase: широка секция, под горния ред, 3 колони × статии (до 9) ── */
        .sf-blog-section { margin-bottom: 36px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,.07); }
        .sf-blog-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px 30px;
        }
        @media (max-width: 820px) { .sf-blog-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 560px) { .sf-blog-grid { grid-template-columns: 1fr; } }

        .sf-col-title {
          font-size: 10px; font-weight: 800; color: rgba(255,255,255,.35);
          letter-spacing: .1em; text-transform: uppercase; margin-bottom: 14px;
        }
        /* ✅ Колоната става flex-column, за да може .sf-col-divider вътре да
           се "закотви" с margin-top:auto в дъното ѝ — grid items по
           подразбиране се разтягат (align-items:stretch) до височината на
           най-високата колона в реда, значи и двете "Бързи линкове"/
           "Контакт" ще паднат на едно и също ниво, без значение колко
           наръчника/партньора има отгоре. */
        .sf-col-flex { display: flex; flex-direction: column; }
        .sf-col-divider { margin-top: auto; padding-top: 22px; }
        .sf-link {
          display: block; font-size: 13.5px; color: rgba(255,255,255,.5);
          text-decoration: none; padding: 4px 0; transition: color .15s; line-height: 1.5;
        }
        .sf-link:hover { color: #86efac; }
        .sf-blog-link {
          display: block; font-size: 13.5px; color: rgba(255,255,255,.5);
          text-decoration: none; padding: 7px 0; transition: color .15s; line-height: 1.4;
          border-bottom: 1px solid rgba(255,255,255,.05);
        }
        .sf-blog-link:hover { color: #86efac; }
        .sf-social {
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 9px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.09);
          text-decoration: none; color: rgba(255,255,255,.6);
          transition: background .2s, transform .2s, color .2s;
        }
        .sf-social:hover { transform: translateY(-2px); }
        /* ✅ Brand-цветове при hover — всяка мрежа в своя разпознаваем цвят,
           вместо единен зелен акцент за всички. */
        .sf-social--facebook:hover  { background: rgba(24,119,242,.2);  color: #6ea8ff; }
        .sf-social--instagram:hover { background: rgba(225,48,108,.2);  color: #f472b6; }
        .sf-social--youtube:hover   { background: rgba(255,0,0,.18);    color: #ff6b6b; }
        .sf-social--tiktok:hover    { background: rgba(255,255,255,.18); color: #fff; }
        .sf-socials { display: flex; gap: 8px; flex-wrap: wrap; }
        .sf-divider { height: 1px; background: rgba(255,255,255,.07); margin-bottom: 20px; }
        .sf-bottom {
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 10px;
        }
        .sf-contact a { color: #86efac; font-weight: 600; text-decoration: none; }
      `}</style>

      <div className="sf-inner">
        <div className={`sf-top-grid${compactBlog ? ' sf-top-grid--with-blog' : ''}`}>
          <div>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🍅</div>
            <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20, color: '#fff', fontWeight: 700, marginBottom: 3, lineHeight: 1.2 }}>Denny Angelow</div>
            <div style={{ fontSize: 9.5, color: '#86efac', fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 12 }}>Агро Консултант</div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.42)', lineHeight: 1.7, maxWidth: 320, marginBottom: 18 }}>
              {aboutText}
            </p>
            {socialDefs.length > 0 && (
              <div className="sf-socials">
                {socialDefs.map(s => (
                  <a key={s.key} href={s.url} target="_blank" rel="noopener" className={`sf-social sf-social--${s.key}`} aria-label={s.label} title={s.label}>
                    <s.Icon />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="sf-col-flex">
            <div className="sf-col-title">Наръчници</div>
            {/* ✅ Динамично от базата — никога не сочи към грешен/остарял slug */}
            {naruchnici.map(n => (
              <a key={n.slug} href={`/naruchnik/${n.slug}`} className="sf-link">
                {emojiFor(n.category)} {n.title}
              </a>
            ))}
            {/* ✅ "Закотвено" в дъното на колоната (margin-top: auto) — за да
                застане на точно същото ниво като "Контакт" в съседната
                колона, без значение колко наръчника има в списъка отгоре. */}
            <div className="sf-col-divider">
              <div className="sf-col-title">Бързи линкове</div>
              <a href="/#produkti" className="sf-link">Atlas Terra продукти</a>
              <a href="/#ginegar" className="sf-link">Ginegar найлони</a>
              <a href="/#faq" className="sf-link">Въпроси и отговори</a>
            </div>
          </div>

          <div className="sf-contact sf-col-flex">
            <div className="sf-col-title">Партньори</div>
            <a href={`https://agroapteki.com/${AFF}`} target="_blank" rel="nofollow sponsored noopener" className="sf-link">🌿 AgroApteki.bg</a>
            <a href="https://oranjeriata.com/" target="_blank" rel="nofollow sponsored noopener" className="sf-link">🏡 Oranjeriata.bg</a>
            <a href="https://atlasagro.eu/" target="_blank" rel="nofollow sponsored noopener" className="sf-link">🌱 AtlasAgro.eu</a>
            {/* ✅ Закотвено в дъното — подравнява се с "Бързи линкове" отляво */}
            <div className="sf-col-divider">
              <div className="sf-col-title">Контакт</div>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>📧 <a href={`mailto:${email}`}>{email}</a></p>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>📞 <a href={`tel:${phone}`}>{phone}</a></p>
              <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>💬 <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener">WhatsApp</a></p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>Пон–Пет, 9:00–17:00 ч.</p>
            </div>
          </div>

          {/* ✅ Компактен режим (≤3 статии) — Блог като 4-та тясна колона,
              същата плътност като останалите. */}
          {compactBlog && (
            <div>
              <div className="sf-col-title">Блог</div>
              {blogPosts.slice(0, 3).map(p => (
                <a key={p.slug} href={`/blog/${p.slug}`} className="sf-link">
                  📝 {p.title}
                </a>
              ))}
              <a href="/blog" className="sf-link" style={{ color: '#86efac', fontWeight: 700 }}>Виж всички →</a>
            </div>
          )}
        </div>

        {/* ✅ Showcase режим (≥4 статии) — широка секция, 3 колони × статии, до 9. */}
        {isShowcase && (
          <div className="sf-blog-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="sf-col-title" style={{ marginBottom: 0 }}>📝 Последно в блога</div>
              <a href="/blog" className="sf-link" style={{ color: '#86efac', fontWeight: 700, padding: 0 }}>Виж всички →</a>
            </div>
            <div className="sf-blog-grid">
              {blogPosts.map(p => (
                <a key={p.slug} href={`/blog/${p.slug}`} className="sf-blog-link">
                  {p.title}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="sf-divider" />
        <div className="sf-bottom">
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.25)' }}>© 2025–2026 Denny Angelow · Всички права запазени</div>
          <a href="/admin" style={{ color: 'rgba(255,255,255,.12)', textDecoration: 'none', fontSize: 11 }}>Admin</a>
        </div>
      </div>
    </footer>
  )
}
