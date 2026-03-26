// app/naruchnik/[slug]/page.tsx
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params: { slug: string }
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

  // Increment download counter (fire and forget)
  supabaseAdmin.rpc('increment_naruchnik_downloads', { p_slug: params.slug }).then(() => {})

  const name = searchParams.name || ''

  return (
    <>
      <style>{css}</style>
      <div className="dl-page">
        <div className="dl-card">
          {/* Header */}
          <div className="dl-header">
            <div className="dl-logo">🍅</div>
            <div className="dl-check">✓</div>
            <h1 className="dl-title">
              {name ? `${name}, наръчникът е готов!` : 'Наръчникът е готов!'}
            </h1>
            <p className="dl-sub">Кликни на бутона по-долу за да го изтеглиш директно</p>
          </div>

          {/* Cover */}
          {naruchnik.cover_image_url && (
            <div className="dl-cover-wrap">
              <img src={naruchnik.cover_image_url} alt={naruchnik.title} className="dl-cover" />
            </div>
          )}

          {/* Book info */}
          <div className="dl-info">
            <h2 className="dl-book-title">{naruchnik.title}</h2>
            {naruchnik.subtitle && <p className="dl-book-sub">{naruchnik.subtitle}</p>}
            {naruchnik.description && <p className="dl-desc">{naruchnik.description}</p>}
          </div>

          {/* Download button */}
          <a
            href={naruchnik.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="dl-btn"
            download
          >
            📥 Изтегли Наръчника (PDF)
          </a>

          <p className="dl-hint">
            Ако файлът не се изтегля автоматично, кликни с десния бутон и избери „Запази като..."
          </p>

          {/* What's inside */}
          <div className="dl-inside">
            <div className="dl-inside-title">Вътре ще намериш:</div>
            <ul className="dl-features">
              <li>✓ Как да предпазиш от болести и вредители</li>
              <li>✓ Кои торове работят наистина</li>
              <li>✓ Календар за третиране</li>
              <li>✓ Грешките, които убиват реколтата</li>
            </ul>
          </div>

          {/* Back link */}
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
  .dl-page{width:100%;max-width:520px;margin:0 auto}
  .dl-card{background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.4)}
  .dl-header{background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:40px 32px 32px;text-align:center}
  .dl-logo{font-size:36px;margin-bottom:8px}
  .dl-check{width:56px;height:56px;background:#4ade80;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#052e16;margin:0 auto 16px}
  .dl-title{color:#fff;font-size:22px;font-weight:800;margin-bottom:8px;line-height:1.3}
  .dl-sub{color:rgba(255,255,255,0.7);font-size:14px;line-height:1.5}
  .dl-cover-wrap{padding:24px 32px 0;text-align:center;background:#f8fafb}
  .dl-cover{max-height:200px;max-width:100%;object-fit:contain;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12)}
  .dl-info{padding:24px 32px 0}
  .dl-book-title{font-size:20px;font-weight:800;color:#111;margin-bottom:6px}
  .dl-book-sub{font-size:13px;color:#6b7280;margin-bottom:10px;font-weight:600}
  .dl-desc{font-size:14px;color:#4b5563;line-height:1.6}
  .dl-btn{display:block;margin:24px 32px 0;padding:18px 24px;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:16px;text-decoration:none;font-weight:900;font-size:17px;text-align:center;box-shadow:0 8px 28px rgba(22,163,74,0.35);transition:all 0.2s}
  .dl-btn:hover{background:linear-gradient(135deg,#15803d,#14532d);transform:translateY(-2px)}
  .dl-hint{font-size:12px;color:#9ca3af;text-align:center;margin:10px 32px 0;line-height:1.5}
  .dl-inside{margin:20px 32px 0;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px}
  .dl-inside-title{font-size:12px;font-weight:800;color:#15803d;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px}
  .dl-features{list-style:none;display:flex;flex-direction:column;gap:6px}
  .dl-features li{font-size:13.5px;color:#166534;font-weight:500}
  .dl-back{display:block;text-align:center;padding:20px 32px 28px;color:#9ca3af;text-decoration:none;font-size:13px;font-weight:600;transition:color 0.2s}
  .dl-back:hover{color:#16a34a}
`
