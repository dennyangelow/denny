// app/naruchnik/[slug]/page.tsx — v6
// Server Component — SEO оптимизиран с generateMetadata + директно сваляне

import { Metadata } from 'next'
import { notFound } from 'next/navigation'

interface Naruchnik {
  id: string; slug: string; title: string; subtitle?: string
  description?: string; cover_image_url?: string; pdf_url?: string
  category?: string; active: boolean
}

const CAT_EMOJI: Record<string, string> = {
  domati: '🍅', krastavici: '🥒', chushki: '🫑', default: '🌿',
}
const catEmoji = (cat = '') => CAT_EMOJI[cat] || CAT_EMOJI.default

const CAT_COLOR: Record<string, string> = {
  domati: '#dc2626', krastavici: '#16a34a', chushki: '#ea580c', default: '#16a34a',
}
const catColor = (cat = '') => CAT_COLOR[cat] || CAT_COLOR.default

const INSIDE_ITEMS = [
  'Пълен календар за торене и третиране',
  'Кои продукти работят наистина (и кои са пари на вятъра)',
  'Борба с болестите — органични методи без химия',
  'Грешките, които убиват реколтата (и как да ги избегнеш)',
  'Тайните на двойния добив от един декар',
]

// ─── Data fetching ──────────────────────────────────────────────────────────
async function getNaruchnik(slug: string): Promise<{ nar: Naruchnik | null; others: Naruchnik[] }> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data } = await supabase
      .from('naruchnici')
      .select('*')
      .eq('active', true)
      .order('sort_order')

    const all: Naruchnik[] = data || []
    const nar = all.find(n => n.slug === slug) || null
    const others = all.filter(n => n.slug !== slug).slice(0, 3)
    return { nar, others }
  } catch {
    return { nar: null, others: [] }
  }
}

// ─── SEO Metadata ───────────────────────────────────────────────────────────
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const { nar } = await getNaruchnik(params.slug)
  if (!nar) return { title: 'Наръчник не е намерен' }

  const emoji = catEmoji(nar.category)
  return {
    title: `${nar.title} — Безплатен PDF Наръчник | Denny Angelow`,
    description: nar.description
      || `Изтегли безплатно "${nar.title}" — практично ръководство за по-здрави растения и рекордна реколта. ${nar.subtitle || ''}`,
    keywords: [nar.title, 'наръчник', 'безплатен PDF', 'градина', 'земеделие', 'органично'],
    openGraph: {
      title: `${emoji} ${nar.title}`,
      description: nar.description || `Безплатен PDF наръчник — изтегли сега`,
      images: nar.cover_image_url ? [{ url: nar.cover_image_url, width: 800, height: 600 }] : [],
      type: 'article',
    },
  }
}

// ─── PAGE ────────────────────────────────────────────────────────────────────
export default async function NaruchnikPage({ params }: { params: { slug: string } }) {
  const { nar, others } = await getNaruchnik(params.slug)
  if (!nar) notFound()

  const emoji = catEmoji(nar.category)
  const color = catColor(nar.category)
  const pdfUrl = nar.pdf_url || '#'

  // JSON-LD structured data за SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: nar.title,
    description: nar.description,
    author: { '@type': 'Person', name: 'Denny Angelow' },
    inLanguage: 'bg',
    isAccessibleForFree: true,
    url: `https://dennyangelow.com/naruchnik/${nar.slug}`,
    image: nar.cover_image_url,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bounceIn{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        .nar-page{min-height:100vh;background:linear-gradient(160deg,#0c3a1c 0%,#14532d 50%,#1a3a0e 100%);padding:0 0 64px}
        .nar-hero{padding:48px 24px 0;max-width:760px;margin:0 auto;text-align:center;animation:fadeUp .5s ease}
        .nar-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18);border-radius:100px;padding:6px 18px;margin-bottom:20px;backdrop-filter:blur(8px)}
        .nar-badge-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block}
        .nar-badge-text{font-size:11px;font-weight:700;color:rgba(255,255,255,0.85);letter-spacing:.08em;text-transform:uppercase}
        .nar-hero h1{font-family:'Cormorant Garamond',serif;font-size:clamp(28px,4vw,50px);font-weight:800;color:#fff;line-height:1.08;letter-spacing:-.02em;margin-bottom:14px}
        .nar-hero-sub{font-size:15px;color:rgba(255,255,255,0.65);line-height:1.75;max-width:520px;margin:0 auto 32px}
        .nar-content{max-width:760px;margin:0 auto;padding:0 24px;animation:fadeUp .6s ease .1s both}
        .nar-main-card{background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.08)}
        /* Cover */
        .nar-cover-zone{background:linear-gradient(145deg,#f0fdf4,#dcfce7);padding:36px 36px 28px;display:flex;align-items:center;gap:32px;position:relative;overflow:hidden}
        .nar-cover-zone::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,rgba(22,163,74,0.07) 1px,transparent 1px);background-size:20px 20px;pointer-events:none}
        .nar-cover-img{max-height:200px;max-width:180px;object-fit:contain;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,0.15);position:relative;flex-shrink:0}
        .nar-cover-text{flex:1;min-width:0}
        .nar-category-tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#15803d;letter-spacing:.07em;text-transform:uppercase;margin-bottom:10px}
        .nar-cover-title{font-family:'Cormorant Garamond',serif;font-size:clamp(20px,3vw,30px);font-weight:800;color:#0f172a;line-height:1.15;letter-spacing:-.02em;margin-bottom:8px}
        .nar-cover-sub{font-size:13.5px;color:#6b7280;line-height:1.6;margin-bottom:16px}
        .nar-free-badge{display:inline-flex;align-items:center;gap:6px;background:#16a34a;color:#fff;font-size:12px;font-weight:800;padding:6px 14px;border-radius:30px;letter-spacing:.03em}
        /* Download CTA */
        .nar-dl-zone{padding:28px 32px;border-bottom:1px solid #f3f4f6}
        .nar-dl-btn{display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:16px;padding:18px 28px;text-decoration:none;font-weight:900;font-size:17px;box-shadow:0 8px 28px rgba(22,163,74,.40);transition:all .2s;letter-spacing:.01em}
        .nar-dl-btn:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(22,163,74,.55)}
        .nar-dl-hint{font-size:12px;color:#9ca3af;text-align:center;margin-top:10px;line-height:1.55}
        /* What's inside */
        .nar-inside-zone{padding:24px 32px;border-bottom:1px solid #f3f4f6}
        .nar-zone-label{font-size:11px;font-weight:800;color:#16a34a;letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}
        .nar-zone-label::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,#d1fae5,transparent)}
        .nar-inside-list{display:flex;flex-direction:column;gap:9px}
        .nar-inside-item{display:flex;align-items:flex-start;gap:11px;font-size:14px;color:#374151;font-weight:500;line-height:1.5}
        .nar-inside-check{width:20px;height:20px;border-radius:6px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex-shrink:0;margin-top:1px;box-shadow:0 2px 6px rgba(22,163,74,.3)}
        /* Others */
        .nar-others-zone{padding:24px 32px}
        .nar-others-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:14px}
        .nar-other-card{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 12px;background:#f8fafc;border:1.5px solid #e5e7eb;border-radius:16px;text-decoration:none;text-align:center;transition:all .2s}
        .nar-other-card:hover{border-color:#16a34a;background:#f0fdf4;box-shadow:0 4px 16px rgba(22,163,74,.15);transform:translateY(-2px)}
        .nar-other-emoji{font-size:32px}
        .nar-other-title{font-size:12.5px;font-weight:700;color:#111;line-height:1.3}
        .nar-other-cta{font-size:11.5px;color:#16a34a;font-weight:800;display:flex;align-items:center;gap:4px}
        /* Back */
        .nar-back-row{text-align:center;padding-top:28px}
        .nar-back-link{color:rgba(255,255,255,0.45);text-decoration:none;font-size:13.5px;font-weight:600;transition:color .2s}
        .nar-back-link:hover{color:#86efac}
        /* Responsive */
        @media(max-width:580px){
          .nar-cover-zone{flex-direction:column;text-align:center;padding:28px 22px 22px}
          .nar-dl-zone,.nar-inside-zone,.nar-others-zone{padding:20px 22px}
          .nar-dl-btn{font-size:15px;padding:16px 22px}
          .nar-hero{padding:36px 18px 0}
        }
      `}</style>

      {/* ── Hero ── */}
      <div className="nar-hero">
        <div className="nar-badge">
          <span className="nar-badge-dot" />
          <span className="nar-badge-text">Безплатен PDF Наръчник</span>
        </div>
        <h1>{emoji} {nar.title}</h1>
        {nar.subtitle && <p className="nar-hero-sub">{nar.subtitle}</p>}
      </div>

      {/* ── Main card ── */}
      <div className="nar-content">
        <div className="nar-main-card">

          {/* Cover + info */}
          <div className="nar-cover-zone">
            {nar.cover_image_url && (
              <img src={nar.cover_image_url} alt={nar.title} className="nar-cover-img" />
            )}
            <div className="nar-cover-text">
              <div className="nar-category-tag">
                <span>{emoji}</span>
                {nar.category ? nar.category.charAt(0).toUpperCase() + nar.category.slice(1) : 'Наръчник'}
              </div>
              <h2 className="nar-cover-title">{nar.title}</h2>
              {nar.description && <p className="nar-cover-sub">{nar.description}</p>}
              <span className="nar-free-badge">
                <span>🆓</span> Напълно безплатно
              </span>
            </div>
          </div>

          {/* Download CTA */}
          <div className="nar-dl-zone">
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download className="nar-dl-btn">
              <span style={{ fontSize: 22 }}>📥</span>
              Изтегли Наръчника (PDF)
            </a>
            <p className="nar-dl-hint">
              Ако файлът не се изтегля автоматично — кликни с десния бутон → „Запази като..."
            </p>
          </div>

          {/* What's inside */}
          <div className="nar-inside-zone">
            <div className="nar-zone-label">Вътре ще намериш</div>
            <ul className="nar-inside-list" style={{ listStyle: 'none', padding: 0 }}>
              {INSIDE_ITEMS.map(item => (
                <li key={item} className="nar-inside-item">
                  <span className="nar-inside-check">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Other handbooks */}
          {others.length > 0 && (
            <div className="nar-others-zone">
              <div className="nar-zone-label">Виж и другите наръчници</div>
              <div className="nar-others-grid">
                {others.map(o => (
                  <a key={o.slug} href={`/naruchnik/${o.slug}`} className="nar-other-card">
                    <span className="nar-other-emoji">{catEmoji(o.category)}</span>
                    <span className="nar-other-title">{o.title}</span>
                    <span className="nar-other-cta">Изтегли <span>→</span></span>
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Back link */}
        <div className="nar-back-row">
          <a href="/" className="nar-back-link">← Обратно към сайта</a>
        </div>
      </div>
    </>
  )
}
