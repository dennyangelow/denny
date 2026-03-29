// app/naruchnik/[slug]/page.tsx — v5
// Рефакториран: inline стилове → CSS класове от homepage.css

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

interface Naruchnik {
  id: string; slug: string; title: string; subtitle?: string
  description?: string; cover_image_url?: string; pdf_url?: string
  category?: string; active: boolean
}

const CAT_EMOJI: Record<string, string> = {
  domati: '🍅', krastavici: '🥒', chushki: '🫑', default: '🌿',
}
const catEmoji = (cat = '') => CAT_EMOJI[cat] || CAT_EMOJI.default

const INSIDE_ITEMS = [
  'Пълен календар за торене и третиране',
  'Кои продукти работят наистина (и кои са пари на вятъра)',
  'Борба с болестите — органични методи без химия',
  'Грешките, които убиват реколтата (и как да ги избегнеш)',
  'Тайните на двойния добив от един декар',
]

const SHIPPING = [
  ['📦 Еконт', '5.00 лв.'],
  ['🚀 Спиди', '5.50 лв.'],
]

function DownloadContent() {
  const params = useParams()
  const search = useSearchParams()
  const slug   = params?.slug as string
  const name   = search.get('name') || ''
  const email  = search.get('email') || ''

  const [nar,      setNar]      = useState<Naruchnik | null>(null)
  const [others,   setOthers]   = useState<Naruchnik[]>([])
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/naruchnici?slug=${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(async d => {
        const list: Naruchnik[] = (d.naruchnici || []).filter((n: Naruchnik) => n.active)
        const found = list[0] || null
        if (!found) { setNotFound(true); setLoading(false); return }
        setNar(found)

        // Cross-promote другите наръчници
        const allRes  = await fetch('/api/naruchnici')
        const allData = await allRes.json()
        const allList: Naruchnik[] = (allData.naruchnici || [])
          .filter((n: Naruchnik) => n.active && n.slug !== slug)
        setOthers(allList.slice(0, 3))

        // Track download (fire & forget)
        fetch('/api/naruchnici/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        }).catch(() => {})

        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [slug])

  if (loading) return (
    <div className="nar-spinner-wrap">
      <div className="nar-spinner" />
    </div>
  )

  if (notFound || !nar) return (
    <div className="nar-notfound">
      <div style={{ fontSize: 52 }}>📗</div>
      <h1>Наръчникът не е намерен</h1>
      <p>Опитай да се върнеш към началната страница</p>
      <a href="/">← Обратно към началото</a>
    </div>
  )

  const pdfUrl = nar.pdf_url || '#'
  // Строим href за другите наръчници
  const othersQuery = email
    ? `?email=${encodeURIComponent(email)}${name ? `&name=${encodeURIComponent(name)}` : ''}`
    : ''
  // Колони за others grid — 1, 2 или 3
  const othersColumns = Math.min(others.length, 3)

  return (
    <div className="nar-page-bg">
      <div className="nar-card-wrap">
        <div className="nar-card">

          {/* ── Header ── */}
          <div className="nar-header">
            <div className="nar-header-emoji">{catEmoji(nar.category)}</div>
            <div className="nar-check">✓</div>
            <h1>{name ? `${name}, наръчникът е готов!` : 'Наръчникът е готов!'}</h1>
            <p>Кликни на бутона по-долу за да го изтеглиш директно</p>
          </div>

          {/* ── Cover image ── */}
          {nar.cover_image_url && (
            <div className="nar-cover">
              <img src={nar.cover_image_url} alt={nar.title} />
            </div>
          )}

          {/* ── Info ── */}
          <div className="nar-info">
            <h2>{nar.title}</h2>
            {nar.subtitle    && <p className="nar-info-sub">{nar.subtitle}</p>}
            {nar.description && <p className="nar-info-desc">{nar.description}</p>}
          </div>

          {/* ── Download button ── */}
          <div className="nar-dl-wrap">
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download
              className="nar-dl-btn">
              📥 Изтегли Наръчника (PDF)
            </a>
            <p className="nar-dl-hint">
              Ако файлът не се изтегля, кликни с десния бутон → „Запази като..."
            </p>
          </div>

          {/* ── Вътре ще намериш ── */}
          <div className="nar-inside">
            <div className="nar-inside-label">Вътре ще намериш:</div>
            <ul>
              {INSIDE_ITEMS.map(item => (
                <li key={item}>
                  <span className="check">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Email потвърждение ── */}
          {email && (
            <div className="nar-email-confirm">
              📧 Изпратихме потвърждение и на <strong>{email}</strong>
            </div>
          )}

          {/* ── Доставка ── */}
          <div className="nar-shipping">
            <div className="nar-shipping-label">🚚 Доставка на продуктите</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {SHIPPING.map(([courier, price]) => (
                <div key={courier} className="nar-shipping-row">
                  <span>{courier}</span>
                  <span>{price}</span>
                </div>
              ))}
              <div className="nar-shipping-free">
                🎁 Безплатна доставка при поръчка над 60 лв.
              </div>
            </div>
          </div>

          {/* ── Другите наръчници ── */}
          {others.length > 0 && (
            <div className="nar-others">
              <div className="nar-others-label">📚 Виж и другите безплатни наръчници</div>
              <div className="nar-others-grid"
                style={{ gridTemplateColumns: `repeat(${othersColumns}, 1fr)` }}>
                {others.map(o => (
                  <a key={o.slug}
                    href={`/naruchnik/${o.slug}${othersQuery}`}
                    className="nar-other-card">
                    <span className="nar-other-card-emoji">{catEmoji(o.category)}</span>
                    <span className="nar-other-card-title">{o.title}</span>
                    <span className="nar-other-card-cta">Изтегли →</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Обратно ── */}
          <a href="/" className="nar-back">← Обратно към сайта</a>

        </div>
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="nar-spinner-wrap">
      <div className="nar-spinner" />
    </div>
  )
}

export default function NaruchnikPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DownloadContent />
    </Suspense>
  )
}
