'use client'
// components/blog/BlogHandbookEmbed.tsx — v1
// ✅ НОВ файл. Контекстуален CTA за безплатен наръчник, вграден по средата
//    (или в края) на блог статия — 'handbook_embed' block type (виж
//    lib/blog.ts) или автоматичен fallback (виж BlogPostBody.tsx).
//
// Умишлено НЕ reuse-ва цялото HandbooksPanel.tsx 1:1 — тук няма нужда от
// social-proof ticker/списък с няколко наръчника едновременно; вместо това
// е компактна, единична карта, огледало на .bp-product-embed визуално
// (за консистентност с останалите вградени карти в статия), с малка inline
// форма, която се появява при клик — вместо да отваря отделен модал/да
// пренасочва към началната страница.
//
// Изпраща по SЪЩИЯ /api/leads endpoint, значи попада в СЪЩИЯ leads
// pipeline (systeme.io sync, welcome email automation) — source: 'blog'
// разграничава тези лийдове от 'naruchnik'/'naruchnik_page' в аналитиките.

import { useState } from 'react'
import { validateName, validateEmail, validatePhone } from '@/lib/leadValidation'

export interface ResolvedHandbook {
  slug:             string
  title:            string
  subtitle?:        string
  cover_image_url?: string
  emoji?:           string
  color?:           string
}

interface Props {
  handbook: ResolvedHandbook
  note?: string
  /** 'context' = вграден по средата на статията (стандартен размер).
   *  'fallback' = автоматичната карта в края на статия без ръчен embed —
   *  визуално идентична, само с различен горен badge текст. */
  variant?: 'context' | 'fallback'
}

type Status = 'idle' | 'form' | 'loading' | 'done' | 'error'

export function BlogHandbookEmbed({ handbook, note, variant = 'context' }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [touched, setTouched] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const nameErr  = validateName(name)
  const emailErr = validateEmail(email)
  const phoneErr = validatePhone(phone)
  const isValid  = !nameErr && !emailErr && !phoneErr

  const color = handbook.color || '#16a34a'

  const submit = async () => {
    setTouched(true)
    if (!isValid) return
    setStatus('loading')
    setErrorMsg('')
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(), name: name.trim(), phone: phone.trim(),
          source: 'blog', naruchnik_slug: handbook.slug,
        }),
      })
      const res  = await fetch(`/api/naruchnici?slug=${encodeURIComponent(handbook.slug)}`)
      const data = await res.json()
      const nar  = (data.naruchnici || [])[0]
      if (nar?.pdf_url) {
        const a = document.createElement('a')
        a.href = nar.pdf_url; a.download = `${nar.title || handbook.title}.pdf`; a.target = '_blank'
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        setStatus('done')
      } else {
        setStatus('error'); setErrorMsg('Проблем при зареждане на файла. Опитай пак.')
      }
    } catch {
      setStatus('error'); setErrorMsg('Грешка. Опитай пак.')
    }
  }

  if (status === 'done') {
    return (
      <div className="bp-handbook-embed bp-handbook-embed--done" style={{ borderColor: color }}>
        <span style={{ fontSize: 22 }}>✅</span>
        <div>
          <p className="bp-handbook-embed-title" style={{ margin: 0 }}>Наръчникът е свален!</p>
          <p className="bp-handbook-embed-sub" style={{ margin: 0 }}>Провери и папка "Изтеглени файлове" на устройството си.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bp-handbook-embed" style={{ borderColor: `${color}55` }}>
      {(note || variant === 'fallback') && (
        <div className="bp-handbook-embed-note" style={{ color }}>
          {note || '📘 Свързан безплатен наръчник'}
        </div>
      )}

      <div className="bp-handbook-embed-body">
        <div className="bp-handbook-embed-img" style={{ background: `${color}12` }}>
          {handbook.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={handbook.cover_image_url} alt={handbook.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 30 }}>{handbook.emoji || '📘'}</span>
          )}
        </div>

        <div className="bp-handbook-embed-text">
          <p className="bp-handbook-embed-title">{handbook.title}</p>
          {handbook.subtitle && <p className="bp-handbook-embed-sub">{handbook.subtitle}</p>}

          {status === 'idle' && (
            <button type="button" className="bp-handbook-embed-btn" style={{ background: color }} onClick={() => setStatus('form')}>
              📥 Свали безплатно →
            </button>
          )}
        </div>
      </div>

      {(status === 'form' || status === 'loading' || status === 'error') && (
        <div className="bp-handbook-embed-form">
          <input
            className="bp-handbook-embed-input"
            placeholder="Име"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          {touched && nameErr && <span className="bp-handbook-embed-err">{nameErr}</span>}

          <input
            className="bp-handbook-embed-input"
            placeholder="Имейл"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          {touched && emailErr && <span className="bp-handbook-embed-err">{emailErr}</span>}

          <input
            className="bp-handbook-embed-input"
            placeholder="Телефон"
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
          {touched && phoneErr && <span className="bp-handbook-embed-err">{phoneErr}</span>}

          {status === 'error' && <span className="bp-handbook-embed-err">{errorMsg}</span>}

          <button
            type="button"
            className="bp-handbook-embed-btn"
            style={{ background: status === 'loading' ? '#9ca3af' : color }}
            disabled={status === 'loading'}
            onClick={submit}
          >
            {status === 'loading' ? '⏳ Подготвям...' : '📥 Изтегли сега →'}
          </button>
        </div>
      )}
    </div>
  )
}
