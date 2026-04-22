'use client'
// components/layout/SiteFooter.tsx — v2
// ПОПРАВКА: 'use client' + suppressHydrationWarning → fix React hydration error

const AFF = 'ref=dennyangelow'

export default function SiteFooter() {
  return (
    <footer suppressHydrationWarning style={{
      background: 'linear-gradient(180deg, #0a1f12 0%, #051a0d 100%)',
      color: 'rgba(255,255,255,0.5)',
      padding: '56px 24px 32px',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <style suppressHydrationWarning>{`
        .sf-inner { max-width: 1060px; margin: 0 auto; }
        .sf-grid {
          display: grid;
          grid-template-columns: 1.4fr repeat(3, 1fr);
          gap: 36px; margin-bottom: 40px;
        }
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
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: '#fff', fontWeight: 700, marginBottom: 3, lineHeight: 1.2 }}>Denny Angelow</div>
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
            <a href="/naruchnik/super-domati" className="sf-link">🍅 Тайните на Едрите Домати</a>
            <a href="/naruchnik/krastavici-visoki-dobivy" className="sf-link">🥒 Краставици за Реколта</a>
            <div style={{ height: 10 }} />
            <div className="sf-col-title">Бързи линкове</div>
            <a href="/#produkti" className="sf-link">Atlas Terra продукти</a>
            <a href="/#ginegar" className="sf-link">Ginegar найлони</a>
            <a href="/#faq" className="sf-link">Въпроси и отговори</a>
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
