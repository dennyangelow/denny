// app/naruchnik/[slug]/page.tsx — v4 FINAL
// Тази страница се зарежда след като потребителят попълни формата
// URL: /naruchnik/super-domati?name=Иван&email=ivan@email.com

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

interface Naruchnik {
  id: string; slug: string; title: string; subtitle?: string
  description?: string; cover_image_url?: string; pdf_url?: string
  category?: string; active: boolean
}

const CAT_EMOJI: Record<string,string> = { domati:'🍅', krastavici:'🥒', chushki:'🫑', default:'🌿' }
const catEmoji = (cat='') => CAT_EMOJI[cat] || CAT_EMOJI.default

function DownloadContent() {
  const params  = useParams()
  const search  = useSearchParams()
  const slug    = params?.slug as string
  const name    = search.get('name') || ''
  const email   = search.get('email') || ''

  const [nar,     setNar]     = useState<Naruchnik | null>(null)
  const [others,  setOthers]  = useState<Naruchnik[]>([])
  const [loading, setLoading] = useState(true)
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

        // Зареди останалите наръчници за cross-promote
        const allRes = await fetch('/api/naruchnici')
        const allData = await allRes.json()
        const allList: Naruchnik[] = (allData.naruchnici || []).filter((n: Naruchnik) => n.active && n.slug !== slug)
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
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(145deg,#0c3a1c,#14532d)' }}>
      <div style={{ width:36, height:36, border:'3px solid rgba(134,239,172,.3)', borderTopColor:'#86efac', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
      <style suppressHydrationWarning>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (notFound || !nar) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, fontFamily:"'DM Sans',sans-serif", background:'linear-gradient(145deg,#0c3a1c,#14532d)', padding:24 }}>
      <div style={{ fontSize:52 }}>📗</div>
      <h1 style={{ fontSize:22, fontWeight:800, color:'#fff' }}>Наръчникът не е намерен</h1>
      <p style={{ color:'rgba(255,255,255,.6)', fontSize:14 }}>Опитай да се върнеш към началната страница</p>
      <a href="/" style={{ color:'#86efac', fontWeight:700, textDecoration:'none', fontSize:15 }}>← Обратно към началото</a>
    </div>
  )

  const pdfUrl = nar.pdf_url || '#'

  return (
    <>
      <style suppressHydrationWarning>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:linear-gradient(145deg,#0c3a1c,#14532d);min-height:100vh;padding:24px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounceIn{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .dl-btn:hover{transform:translateY(-2px)!important;box-shadow:0 12px 36px rgba(22,163,74,.5)!important}
        .other-card:hover{border-color:#16a34a!important;box-shadow:0 4px 16px rgba(22,163,74,.2)!important;transform:translateY(-2px)!important}
        .back-link:hover{color:#86efac!important}
      `}</style>

      <div style={{ width:'100%', maxWidth:560, margin:'0 auto', animation:'fadeUp .5s ease' }}>
        <div style={{ background:'#fff', borderRadius:24, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,.4)' }}>

          {/* Header */}
          <div style={{ background:'linear-gradient(135deg,#0f1f16,#1b4332)', padding:'36px 32px 28px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:6 }}>{catEmoji(nar.category)}</div>
            <div style={{ width:56, height:56, background:'#4ade80', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:900, color:'#052e16', margin:'0 auto 16px', animation:'bounceIn .6s cubic-bezier(.34,1.56,.64,1)' }}>✓</div>
            <h1 style={{ color:'#fff', fontSize:21, fontWeight:800, marginBottom:8, lineHeight:1.3 }}>
              {name ? `${name}, наръчникът е готов!` : 'Наръчникът е готов!'}
            </h1>
            <p style={{ color:'rgba(255,255,255,.7)', fontSize:13.5, lineHeight:1.5 }}>Кликни на бутона по-долу за да го изтеглиш директно</p>
          </div>

          {/* Cover image */}
          {nar.cover_image_url && (
            <div style={{ background:'#f8fafb', padding:'22px 32px 0', textAlign:'center' }}>
              <img src={nar.cover_image_url} alt={nar.title} style={{ maxHeight:190, maxWidth:'100%', objectFit:'contain', borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.12)' }}/>
            </div>
          )}

          {/* Info */}
          <div style={{ padding:'22px 32px 0' }}>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:800, color:'#111', marginBottom:6, lineHeight:1.25 }}>{nar.title}</h2>
            {nar.subtitle && <p style={{ fontSize:13, color:'#6b7280', fontWeight:600, marginBottom:10 }}>{nar.subtitle}</p>}
            {nar.description && <p style={{ fontSize:14, color:'#4b5563', lineHeight:1.65 }}>{nar.description}</p>}
          </div>

          {/* Download button */}
          <div style={{ padding:'20px 32px 0' }}>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download
              className="dl-btn"
              style={{ display:'block', background:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', borderRadius:16, padding:'18px 24px', textDecoration:'none', fontWeight:900, fontSize:17, textAlign:'center', boxShadow:'0 8px 28px rgba(22,163,74,.35)', transition:'all .2s' }}>
              📥 Изтегли Наръчника (PDF)
            </a>
            <p style={{ fontSize:12, color:'#9ca3af', textAlign:'center', marginTop:9, lineHeight:1.5 }}>
              Ако файлът не се изтегля, кликни с десния бутон → „Запази като..."
            </p>
          </div>

          {/* What's inside */}
          <div style={{ margin:'18px 32px 0', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:14, padding:'16px 20px' }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#15803d', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>Вътре ще намериш:</div>
            <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:7 }}>
              {[
                'Пълен календар за торене и третиране',
                'Кои продукти работят наистина (и кои са пари на вятъра)',
                'Борба с болестите — органични методи без химия',
                'Грешките, които убиват реколтата (и как да ги избегнеш)',
                'Тайните на двойния добив от един декар',
              ].map(item => (
                <li key={item} style={{ fontSize:13.5, color:'#166534', fontWeight:500, display:'flex', gap:8, alignItems:'flex-start' }}>
                  <span style={{ color:'#16a34a', fontWeight:900, flexShrink:0 }}>✓</span>{item}
                </li>
              ))}
            </ul>
          </div>

          {/* Email confirmation */}
          {email && (
            <div style={{ margin:'14px 32px 0', background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:12, padding:'12px 16px', fontSize:13, color:'#0369a1' }}>
              📧 Изпратихме потвърждение и на <strong>{email}</strong>
            </div>
          )}

          {/* Shipping info */}
          <div style={{ margin:'16px 32px 0', background:'#fafaf8', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 18px' }}>
            <div style={{ fontSize:11, fontWeight:800, color:'#374151', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>🚚 Доставка на продуктите</div>
            <div style={{ display:'grid', gap:6 }}>
              {[['📦 Еконт','5.00 лв.'],['🚀 Спиди','5.50 лв.']].map(([c,p]) => (
                <div key={c} style={{ display:'flex', justifyContent:'space-between', fontSize:13.5, color:'#374151' }}>
                  <span>{c}</span><span style={{ fontWeight:700 }}>{p}</span>
                </div>
              ))}
              <div style={{ fontSize:13, color:'#16a34a', fontWeight:700, marginTop:4 }}>🎁 Безплатна доставка при поръчка над 60 лв.</div>
            </div>
          </div>

          {/* Other handbooks */}
          {others.length > 0 && (
            <div style={{ margin:'20px 32px 0', background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:14, padding:'18px' }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#374151', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:14 }}>📚 Виж и другите безплатни наръчници</div>
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(others.length,3)},1fr)`, gap:10 }}>
                {others.map(o => (
                  <a key={o.slug}
href={`/naruchnik/${o.slug}${email ? `?email=${encodeURIComponent(email)}${name ? `&name=${encodeURIComponent(name)}` : ''}` : ''}`}
                    className="other-card"
                    style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7, padding:'13px 10px', background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:12, textDecoration:'none', textAlign:'center', transition:'all .2s' }}>
                    <span style={{ fontSize:30 }}>{catEmoji(o.category)}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:'#111', lineHeight:1.3 }}>{o.title}</span>
                    <span style={{ fontSize:11, color:'#16a34a', fontWeight:700 }}>Изтегли →</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Back */}
          <a href="/" className="back-link"
            style={{ display:'block', textAlign:'center', padding:'18px 32px 26px', color:'#9ca3af', textDecoration:'none', fontSize:13.5, fontWeight:600, transition:'color .2s' }}>
            ← Обратно към сайта
          </a>
        </div>
      </div>
    </>
  )
}

function LoadingSpinner() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(145deg,#0c3a1c,#14532d)' }}>
      <div style={{ width:36, height:36, border:'3px solid rgba(134,239,172,.3)', borderTopColor:'#86efac', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
      <style suppressHydrationWarning>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function NaruchnikPage() {
  return (
    <Suspense fallback={<LoadingSpinner/>}>
      <DownloadContent/>
    </Suspense>
  )
}
