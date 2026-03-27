// app/naruchnik/[slug]/page.tsx — v3

import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params:       { slug: string }
  searchParams: { email?: string; name?: string }
}

async function getNaruchnik(slug: string) {
  const { data } = await supabaseAdmin
    .from('naruchnici')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  return data
}

async function getOtherNaruchnici(currentSlug: string) {
  const { data } = await supabaseAdmin
    .from('naruchnici')
    .select('id, slug, title, subtitle, cover_image_url, category')
    .eq('active', true)
    .neq('slug', currentSlug)
    .order('sort_order')
    .limit(3)
  return data || []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const n = await getNaruchnik(params.slug)
  if (!n) return { title: 'Не е намерено' }
  return {
    title: `${n.title} — Изтегли Безплатно`,
    description: n.description || n.subtitle,
  }
}

export default async function NaruchnikPage({ params, searchParams }: Props) {
  const naruchnik = await getNaruchnik(params.slug)
  if (!naruchnik) notFound()

  const otherNaruchnici = await getOtherNaruchnici(params.slug)

  supabaseAdmin.rpc('increment_naruchnik_downloads', { p_slug: params.slug }).then(() => {})

  const name = searchParams.name || ''

  return (
    <>
      <style>{css}</style>
      <div className="dl-page">
        <div className="dl-card">
          <div className="dl-header">
            <div className="dl-logo">🍅</div>
            <div className="dl-check">✓</div>
            <h1 className="dl-title">
              {name ? `${name}, наръчникът е готов!` : 'Наръчникът е готов!'}
            </h1>
            <p className="dl-sub">Кликни на бутона по-долу за да го изтеглиш директно</p>
          </div>

          {naruchnik.cover_image_url && (
            <div className="dl-cover-wrap">
              <img src={naruchnik.cover_image_url} alt={naruchnik.title} className="dl-cover"/>
            </div>
          )}

          <div className="dl-info">
            <h2 className="dl-book-title">{naruchnik.title}</h2>
            {naruchnik.subtitle    && <p className="dl-book-sub">{naruchnik.subtitle}</p>}
            {naruchnik.description && <p className="dl-desc">{naruchnik.description}</p>}
          </div>

          <a href={naruchnik.pdf_url} target="_blank" rel="noopener noreferrer" className="dl-btn" download>
            📥 Изтегли Наръчника (PDF)
          </a>

          <p className="dl-hint">
            Ако файлът не се изтегля автоматично, кликни с десния бутон и избери „Запази като..."
          </p>

          <div className="dl-inside">
            <div className="dl-inside-title">Вътре ще намериш:</div>
            <ul className="dl-features">
              <li>✓ Как да предпазиш от болести и вредители</li>
              <li>✓ Кои торове работят наистина</li>
              <li>✓ Календар за третиране</li>
              <li>✓ Грешките, които убиват реколтата</li>
            </ul>
          </div>

          {/* Доставка инфо */}
          <div className="dl-shipping">
            <div className="dl-shipping-title">🚚 Доставка на продуктите</div>
            <div className="dl-shipping-grid">
              <div className="dl-shipping-item">
                <span>Еконт</span>
                <span className="dl-shipping-price">5.00 €</span>
              </div>
              <div className="dl-shipping-item">
                <span>Спиди</span>
                <span className="dl-shipping-price">5.50 €</span>
              </div>
              <div className="dl-shipping-item" style={{ gridColumn:'1/-1', color:'#16a34a' }}>
                <span>🎁 Безплатна доставка при поръчка над 60 €</span>
              </div>
            </div>
          </div>

          {/* Cross-promote */}
          {otherNaruchnici.length > 0 && (
            <div className="dl-other">
              <div className="dl-other-title">📚 Виж и другите наши наръчници</div>
              <div className="dl-other-grid">
                {otherNaruchnici.map(n => (
                  <a key={n.slug}
                    href={`/naruchnik/${n.slug}${searchParams.email ? `?email=${encodeURIComponent(searchParams.email)}${searchParams.name ? `&name=${encodeURIComponent(searchParams.name)}` : ''}` : ''}`}
                    className="dl-other-card">
                    {n.cover_image_url
                      ? <img src={n.cover_image_url} alt={n.title} className="dl-other-img"/>
                      : <div className="dl-other-emoji">📗</div>
                    }
                    <div className="dl-other-name">{n.title}</div>
                    {n.subtitle && <div className="dl-other-sub">{n.subtitle}</div>}
                    <div className="dl-other-btn">Изтегли →</div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <a href="/" className="dl-back">← Обратно към сайта</a>
        </div>
      </div>
    </>
  )
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'DM Sans',sans-serif;background:linear-gradient(145deg,#0c3a1c,#14532d);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .dl-page{width:100%;max-width:540px;margin:0 auto}
  .dl-card{background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.4)}
  .dl-header{background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:40px 32px 32px;text-align:center}
  .dl-logo{font-size:36px;margin-bottom:8px}
  .dl-check{width:56px;height:56px;background:#4ade80;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#052e16;margin:0 auto 16px}
  .dl-title{color:#fff;font-size:22px;font-weight:800;margin-bottom:8px;line-height:1.3}
  .dl-sub{color:rgba(255,255,255,.7);font-size:14px;line-height:1.5}
  .dl-cover-wrap{padding:24px 32px 0;text-align:center;background:#f8fafb}
  .dl-cover{max-height:200px;max-width:100%;object-fit:contain;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12)}
  .dl-info{padding:24px 32px 0}
  .dl-book-title{font-size:20px;font-weight:800;color:#111;margin-bottom:6px}
  .dl-book-sub{font-size:13px;color:#6b7280;margin-bottom:10px;font-weight:600}
  .dl-desc{font-size:14px;color:#4b5563;line-height:1.6}
  .dl-btn{display:block;margin:24px 32px 0;padding:18px 24px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:16px;text-decoration:none;font-weight:900;font-size:17px;text-align:center;box-shadow:0 8px 28px rgba(22,163,74,.35);transition:all .2s}
  .dl-btn:hover{background:linear-gradient(135deg,#15803d,#14532d);transform:translateY(-2px)}
  .dl-hint{font-size:12px;color:#9ca3af;text-align:center;margin:10px 32px 0;line-height:1.5}
  .dl-inside{margin:20px 32px 0;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px}
  .dl-inside-title{font-size:12px;font-weight:800;color:#15803d;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}
  .dl-features{list-style:none;display:flex;flex-direction:column;gap:6px}
  .dl-features li{font-size:13.5px;color:#166534;font-weight:500}
  .dl-shipping{margin:16px 32px 0;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:14px 18px}
  .dl-shipping-title{font-size:12px;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}
  .dl-shipping-grid{display:grid;gap:6px}
  .dl-shipping-item{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#374151}
  .dl-shipping-price{font-weight:700;color:#0369a1}
  .dl-other{margin:24px 32px 0;padding:20px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px}
  .dl-other-title{font-size:13px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.05em;margin-bottom:14px}
  .dl-other-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
  .dl-other-card{text-decoration:none;background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;text-align:center;padding:12px;transition:all .2s;display:block}
  .dl-other-card:hover{border-color:#16a34a;box-shadow:0 4px 14px rgba(22,163,74,.15);transform:translateY(-2px)}
  .dl-other-img{width:100%;height:70px;object-fit:contain;margin-bottom:8px}
  .dl-other-emoji{font-size:36px;margin-bottom:8px}
  .dl-other-name{font-size:12px;font-weight:700;color:#111;margin-bottom:4px;line-height:1.3}
  .dl-other-sub{font-size:11px;color:#9ca3af;margin-bottom:8px;line-height:1.3}
  .dl-other-btn{font-size:11px;font-weight:700;color:#16a34a}
  .dl-back{display:block;text-align:center;padding:20px 32px 28px;color:#9ca3af;text-decoration:none;font-size:13px;font-weight:600;transition:color .2s}
  .dl-back:hover{color:#16a34a}
`
