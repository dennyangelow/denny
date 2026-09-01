'use client'
// components/layout/SiteFooter.tsx — v4
// ✅ ПОПРАВКИ спрямо v3:
//   - Нова колона "Блог" с последните 4 поста от /api/blog?limit=4
//   - Грид разширен на 5 колони (1.3fr + 4×1fr) за да побере новата колона
// ✅ ПОПРАВКА спрямо v2:
//   - Наръчниците вече се теглят динамично от /api/naruchnici вместо твърдо
//     закодирани линкове — старата версия сочеше към грешен slug
//     (krastavici-visoki-dobivy вместо реалния krastavici-naruchnik) и щеше
//     да продължи да се чупи всеки път, щом добавиш/преименуваш наръчник.
//     Сега футерът навсякъде показва точно каквото е в базата — не може да
//     остане разсинхронизиран.

import { useState, useEffect } from 'react'

const AFF = 'ref=dennyangelow'

interface NaruchnikLink { slug: string; title: string; category?: string }

const CATEGORY_EMOJI: Record<string, string> = {
  'Домати':      '🍅',
  'Краставици':  '🥒',
}

function emojiFor(category?: string): string {
  return (category && CATEGORY_EMOJI[category]) || '📗'
}

interface BlogLink { slug: string; title: string }

export default function SiteFooter() {
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

  // ✅ Последните 4 блог поста — прясно съдържание във футъра на всяка страница,
  //    вътрешни линкове към /blog/[slug] от целия сайт.
  useEffect(() => {
    let cancelled = false
    fetch('/api/blog?limit=4')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        const list = Array.isArray(data?.posts) ? data.posts : []
        setBlogPosts(list.map((p: any) => ({ slug: p.slug, title: p.title })))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <footer suppressHydrationWarning style={{
      background: 'linear-gradient(180deg, #0a1f12 0%, #051a0d 100%)',
      color: 'rgba(255,255,255,0.5)',
      padding: '56px 24px 32px',
      fontFamily: "var(--font-dm-sans), sans-serif",
    }}>
      <style suppressHydrationWarning>{`
        .sf-inner { max-width: 1060px; margin: 0 auto; }
        .sf-grid {
          display: grid;
          grid-template-columns: 1.3fr repeat(4, 1fr);
          gap: 30px; margin-bottom: 40px;
        }
        @media (max-width: 1000px) { .sf-grid { grid-template-columns: 1fr 1fr 1fr; gap: 26px; } }
        @media (max-width: 820px) { .sf-grid { grid-template-columns: 1fr 1fr; gap: 28px; } }
        @media (max-width: 480px) { .sf-grid { grid-template-columns: 1fr; } }
        .sf-col-title {
          font-size: 10px; font-weight: 800; color: rgba(255,255,255,.35);
          letter-spacing: .1em; text-transform: uppercase; margin-bottom: 14px;
        }
        .sf-link {
          display: block; font-size: 13.5px; color: rgba(255,255,255,.5);
          text-decoration: none; padding: 4px 0; transition: color .15s; line-height: 1.5;
        }
        .sf-link:hover { color: #86efac; }
        .sf-social {
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 9px;
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.09);
          text-decoration: none; font-size: 11px; font-weight: 800; color: rgba(255,255,255,.6);
          transition: background .2s, transform .2s;
        }
        .sf-social:hover { background: rgba(74,222,128,.15); color: #86efac; transform: translateY(-2px); }
        .sf-socials { display: flex; gap: 8px; flex-wrap: wrap; }
        .sf-divider { height: 1px; background: rgba(255,255,255,.07); margin-bottom: 20px; }
        .sf-bottom {
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 10px;
        }
        .sf-contact a { color: #86efac; font-weight: 600; text-decoration: none; }
      `}</style>

      <div className="sf-inner">
        <div className="sf-grid">
          <div>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🍅</div>
            <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 20, color: '#fff', fontWeight: 700, marginBottom: 3, lineHeight: 1.2 }}>Denny Angelow</div>
            <div style={{ fontSize: 9.5, color: '#86efac', fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 12 }}>Агро Консултант</div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.42)', lineHeight: 1.7, maxWidth: 240, marginBottom: 18 }}>
              Помагам на фермери да отглеждат по-здрави растения с проверени органични методи и правилна защита.
            </p>
            <div className="sf-socials">
              {[
                ['https://www.facebook.com/dennyangelow', 'FB', 'Facebook'],
                ['https://www.instagram.com/dennyangelow', 'IG', 'Instagram'],
                ['https://www.youtube.com/@dennyangelow', 'YT', 'YouTube'],
                ['https://www.tiktok.com/@dennyangelow', 'TT', 'TikTok'],
              ].map(([href, label, title]) => (
                <a key={href} href={href} target="_blank" rel="noopener" className="sf-social" aria-label={title} title={title}>{label}</a>
              ))}
            </div>
          </div>

          <div>
            <div className="sf-col-title">Наръчници</div>
            {/* ✅ Динамично от базата — никога не сочи към грешен/остарял slug */}
            {naruchnici.map(n => (
              <a key={n.slug} href={`/naruchnik/${n.slug}`} className="sf-link">
                {emojiFor(n.category)} {n.title}
              </a>
            ))}
            <div style={{ height: 10 }} />
            <div className="sf-col-title">Бързи линкове</div>
            <a href="/#produkti" className="sf-link">Atlas Terra продукти</a>
            <a href="/#ginegar" className="sf-link">Ginegar найлони</a>
            <a href="/#faq" className="sf-link">Въпроси и отговори</a>
          </div>

          <div>
            <div className="sf-col-title">Блог</div>
            {/* ✅ Последните 4 поста — прясно съдържание + вътрешни линкове от футъра на всяка страница */}
            {blogPosts.length === 0 && (
              <a href="/blog" className="sf-link">Виж всички статии →</a>
            )}
            {blogPosts.map(p => (
              <a key={p.slug} href={`/blog/${p.slug}`} className="sf-link">
                📝 {p.title}
              </a>
            ))}
            {blogPosts.length > 0 && (
              <a href="/blog" className="sf-link" style={{ color: '#86efac', fontWeight: 700 }}>Виж всички →</a>
            )}
          </div>

          <div>
            <div className="sf-col-title">Партньори</div>
            <a href={`https://agroapteki.com/${AFF}`} target="_blank" rel="nofollow sponsored noopener" className="sf-link">🌿 AgroApteki.bg</a>
            <a href="https://oranjeriata.com/" target="_blank" rel="nofollow sponsored noopener" className="sf-link">🏡 Oranjeriata.bg</a>
            <a href="https://atlasagro.eu/" target="_blank" rel="nofollow sponsored noopener" className="sf-link">🌱 AtlasAgro.eu</a>
          </div>

          <div className="sf-contact">
            <div className="sf-col-title">Контакт</div>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>📧 <a href="mailto:support@dennyangelow.com">support@dennyangelow.com</a></p>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>📞 <a href="tel:+359876238623">+359 876 238 623</a></p>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>💬 <a href="https://wa.me/359876238623" target="_blank" rel="noopener">WhatsApp</a></p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>Пон–Пет, 9:00–17:00 ч.</p>
          </div>
        </div>

        <div className="sf-divider" />
        <div className="sf-bottom">
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.25)' }}>© 2025–2026 Denny Angelow · Всички права запазени</div>
          <a href="/admin" style={{ color: 'rgba(255,255,255,.12)', textDecoration: 'none', fontSize: 11 }}>Admin</a>
        </div>
      </div>
    </footer>
  )
}
