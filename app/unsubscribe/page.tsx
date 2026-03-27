'use client'
// app/unsubscribe/page.tsx

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function UnsubscribeContent() {
  const params = useSearchParams()
  const email  = params.get('email') || ''
  const [status, setStatus]   = useState<'idle'|'loading'|'done'|'error'>('idle')
  const [reason, setReason]   = useState('')

  const handleUnsubscribe = async () => {
    if (!email) return
    setStatus('loading')
    try {
      const res = await fetch('/api/leads/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reason: reason || undefined }),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch { setStatus('error') }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'40px 36px', maxWidth:440, width:'100%', textAlign:'center', boxShadow:'0 8px 40px rgba(0,0,0,.08)' }}>
        {status === 'done' ? (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <h1 style={{ fontSize:22, fontWeight:800, marginBottom:8 }}>Отписан успешно</h1>
            <p style={{ color:'#6b7280', fontSize:14, lineHeight:1.6, marginBottom:24 }}>
              <strong>{email}</strong> беше отписан от имейл листата. Няма да получаваш повече съобщения.
            </p>
            <a href="/" style={{ color:'#16a34a', textDecoration:'none', fontWeight:700, fontSize:14 }}>← Обратно към сайта</a>
          </>
        ) : (
          <>
            <div style={{ fontSize:48, marginBottom:16 }}>📧</div>
            <h1 style={{ fontSize:22, fontWeight:800, marginBottom:8 }}>Отписване от имейли</h1>
            <p style={{ color:'#6b7280', fontSize:14, lineHeight:1.6, marginBottom:20 }}>
              {email
                ? <>Потвърди, че искаш да отпишеш <strong>{email}</strong> от имейл листата.</>
                : 'Невалиден линк за отписване.'}
            </p>
            {email && (
              <>
                <div style={{ marginBottom:20, textAlign:'left' }}>
                  <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:6 }}>
                    Причина (по желание)
                  </label>
                  <select value={reason} onChange={e => setReason(e.target.value)}
                    style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #e5e7eb', borderRadius:9, fontFamily:'inherit', fontSize:14, outline:'none', color:'#111', background:'#fff' }}>
                    <option value="">— Избери причина —</option>
                    <option value="too_many">Получавам твърде много имейли</option>
                    <option value="not_relevant">Съдържанието не ми е интересно</option>
                    <option value="never_signed_up">Не съм се регистрирал/а</option>
                    <option value="other">Друга причина</option>
                  </select>
                </div>
                <button onClick={handleUnsubscribe} disabled={status==='loading'}
                  style={{ width:'100%', padding:14, background:'#ef4444', color:'#fff', border:'none', borderRadius:12, fontWeight:800, fontSize:15, cursor:'pointer', fontFamily:'inherit', opacity:status==='loading'?.7:1 }}>
                  {status === 'loading' ? 'Изпраща...' : 'Потвърди отписване'}
                </button>
              </>
            )}
            {status === 'error' && <p style={{ color:'#ef4444', fontSize:13, marginTop:12 }}>Грешка. Опитай отново.</p>}
            <a href="/" style={{ display:'block', marginTop:16, color:'#9ca3af', textDecoration:'none', fontSize:13 }}>← Обратно към сайта</a>
          </>
        )}
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>...</div>}>
      <UnsubscribeContent/>
    </Suspense>
  )
}
