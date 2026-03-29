'use client'

// components/client/HandbooksPanel.tsx
// Само формата е client — всичко друго в hero-то е server-rendered

import { useState } from 'react'

interface Handbook {
  slug: string; title: string; subtitle: string
  emoji: string; color: string; image_url?: string; bg: string; badge: string
}

export function HandbooksPanel({ handbooks }: { handbooks: Handbook[] }) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [hbName, setHbName] = useState('')
  const [hbEmail, setHbEmail] = useState('')
  const [hbPhone, setHbPhone] = useState('')
  const [hbLoading, setHbLoading] = useState(false)
  const [hbError, setHbError] = useState('')
  const [hbDone, setHbDone] = useState<{ pdfUrl: string; title: string } | null>(null)

  const submitHandbook = async (slug: string) => {
    if (!hbEmail || !hbEmail.includes('@')) { setHbError('Моля въведи валиден имейл'); return }
    setHbLoading(true); setHbError('')
    try {
      await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: hbEmail.trim(), name: hbName.trim() || null, phone: hbPhone.trim() || null, source: 'naruchnik', naruchnik_slug: slug }),
      })
      const res = await fetch(`/api/naruchnici?slug=${encodeURIComponent(slug)}`)
      const data = await res.json()
      const nar = (data.naruchnici || [])[0]
      if (nar?.pdf_url) {
        setHbDone({ pdfUrl: nar.pdf_url, title: nar.title })
        const a = document.createElement('a')
        a.href = nar.pdf_url; a.download = nar.title + '.pdf'; a.target = '_blank'
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
      } else { setHbError('Проблем при зареждане на файла. Опитай пак.') }
    } catch { setHbError('Грешка. Опитай пак.') }
    setHbLoading(false)
  }

  const inputStyle = {
    padding: '11px 14px', borderRadius: 11, border: '1.5px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none',
    fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' as const,
  }

  return (
    <div className="handbooks-panel">
      <div className="handbooks-panel-header">
        <div className="handbooks-panel-icon">🎁</div>
        <div>
          <div className="handbooks-panel-title">Безплатни Наръчници</div>
          <div className="handbooks-panel-sub">Избери · Попълни имейл · Изтегли веднага</div>
        </div>
      </div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '0 0 14px' }} />

      {hbDone ? (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>✅</div>
          <div style={{ color: '#86efac', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Наръчникът се сваля!</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 14 }}>Изпратихме и потвърждение на {hbEmail}</div>
          <a href={hbDone.pdfUrl} target="_blank" rel="noopener noreferrer" download
            style={{ display: 'inline-block', background: '#16a34a', color: '#fff', borderRadius: 12, padding: '12px 22px', textDecoration: 'none', fontWeight: 800, fontSize: 14, marginBottom: 12 }}>
            📥 Изтегли пак
          </a>
          <button onClick={() => { setHbDone(null); setSelectedSlug(null); setHbEmail(''); setHbName(''); setHbPhone('') }}
            style={{ display: 'block', margin: '0 auto', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
            ← Избери друг наръчник
          </button>
        </div>
      ) : selectedSlug ? (
        <div>
          {(() => {
            const hb = handbooks.find(h => h.slug === selectedSlug)
            return hb ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
                {hb.image_url ? (
  <img src={hb.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
) : (
  <span style={{ fontSize: 24 }}>{hb.emoji}</span>
)}
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{hb.title}</div>
                </div>
                <button onClick={() => setSelectedSlug(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, width: 26, height: 26, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ) : null
          })()}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <input type="text" className="hb-input" placeholder="Твоето име (по желание)" value={hbName} onChange={e => setHbName(e.target.value)} style={inputStyle}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#86efac' }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)' }} />
            <input type="email" className="hb-input" placeholder="Имейл адрес *" value={hbEmail}
              onChange={e => { setHbEmail(e.target.value); setHbError('') }}
              style={{ ...inputStyle, borderColor: hbError ? '#f87171' : 'rgba(255,255,255,0.2)' }}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#86efac' }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = hbError ? '#f87171' : 'rgba(255,255,255,0.2)' }} />
            <input type="tel" className="hb-input" placeholder="Телефон (по желание)" value={hbPhone} onChange={e => setHbPhone(e.target.value)} style={inputStyle}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#86efac' }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)' }} />
            {hbError && <div style={{ color: '#f87171', fontSize: 12, fontWeight: 600 }}>⚠️ {hbError}</div>}
            <button onClick={() => submitHandbook(selectedSlug)} disabled={hbLoading}
              style={{ background: hbLoading ? '#4b5563' : 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 900, cursor: hbLoading ? 'wait' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', boxShadow: '0 6px 20px rgba(22,163,74,0.4)' }}>
              {hbLoading ? '⏳ Зарежда...' : '📥 Изтегли Безплатно'}
            </button>
          </div>
        </div>
      ) : (
       <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
  {handbooks.map((hb) => (
    <button
      key={hb.slug}
      onClick={() => setSelectedSlug(hb.slug)}
      className="hb-card"
      style={{
        '--hb-color': hb.color,
        cursor: 'pointer',
        border: 'none',
        textAlign: 'left',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px',
        borderRadius: '14px',
        background: 'rgba(255, 255, 255, 0.05)',
        transition: 'transform 0.2s, background 0.2s',
      } as React.CSSProperties}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Контейнер за икона/снимка */}
      <div 
        className="hb-card-emoji" 
        style={{ 
          width: 48, 
          height: 48, 
          flexShrink: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderRadius: '10px',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)',
          fontSize: '24px' 
        }}
      >
        {/* ПРОВЕРКА ЗА СНИМКА */}
        {hb.image_url ? (
          <img 
            src={hb.image_url} 
            alt={hb.title} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            onError={(e) => {
              // Ако снимката не се зареди, покажи емоджито
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.innerHTML = hb.emoji;
            }}
          />
        ) : (
          hb.emoji
        )}
      </div>

      {/* Текстова част */}
      <div className="hb-card-body" style={{ flex: 1, overflow: 'hidden' }}>
        <div 
          className="hb-card-title" 
          style={{ 
            color: '#fff', 
            fontWeight: 700, 
            fontSize: '15px', 
            marginBottom: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {hb.title}
        </div>
        <div 
          className="hb-card-sub" 
          style={{ 
            color: 'rgba(255,255,255,0.5)', 
            fontSize: '12px',
            lineHeight: '1.3'
          }}
        >
          {hb.subtitle}
        </div>
      </div>

      {/* Стрелка */}
      <div 
        className="hb-card-arrow" 
        style={{ 
          color: 'rgba(255,255,255,0.3)', 
          fontSize: '18px',
          paddingRight: '4px' 
        }}
      >
        ↓
      </div>
    </button>
  ))}
</div>
      )}

      <div className="handbooks-panel-footer" style={{ marginTop: 14 }}>
        <span>🔒 Без спам</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Директно сваляне</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Безплатно</span>
      </div>
    </div>
  )
}
