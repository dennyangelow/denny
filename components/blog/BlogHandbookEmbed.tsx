'use client'
// components/blog/BlogHandbookEmbed.tsx — v5
// ✅ ПРОМЯНА спрямо v4:
//   1) Submit бутонът: "Изтегли сега →" → "Изпрати ми наръчника →" —
//      по-лично, назовава конкретно какво получава (наръчника), и не
//      повтаря "безплатно", вече казано два пъти по-нагоре в картата
//      (баджа + заглавието).
//   2) Trust редът: "Без спам · Директно сваляне · Безплатно" →
//      "Без спам · Отписване по всяко време · Веднага в пощата ти" —
//      "Безплатно" махнато (същото повторение), заменено с два реда,
//      които реално адресират причините някой да се колебае да остави
//      имейл/телефон: страх от спам завинаги (отписване по всяко време)
//      и несигурност дали наистина получава файла веднага.

import { useState } from 'react'
import { validateName, validateEmail, validatePhone } from '@/lib/validation'

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
  variant?: 'context' | 'fallback'
}

type Status = 'idle' | 'form' | 'loading' | 'done' | 'error'

function TrustRow() {
  return (
    <div className="bp-handbook-embed-trust">
      <span>🔒 Без спам</span><span>·</span><span>Отписване по всяко време</span><span>·</span><span>Веднага в пощата ти</span>
    </div>
  )
}

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

  const triggerDownload = (pdfUrl: string, title: string) => {
    const a = document.createElement('a')
    a.href = pdfUrl; a.download = `${title}.pdf`; a.target = '_blank'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const submit = async () => {
    setTouched(true)
    if (!isValid) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const leadRes = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(), name: name.trim(), phone: phone.trim(),
          source: 'blog', naruchnik_slug: handbook.slug,
        }),
      })
      const leadData = await leadRes.json().catch(() => ({}))
      if (!leadRes.ok) {
        setStatus('error')
        setErrorMsg(leadData.error || 'Грешка при изпращане. Провери данните и опитай пак.')
        return
      }

      if (leadData.naruchnik?.pdf_url) {
        triggerDownload(leadData.naruchnik.pdf_url, leadData.naruchnik.title || handbook.title)
        setStatus('done')
        return
      }

      const res  = await fetch(`/api/naruchnici?slug=${encodeURIComponent(handbook.slug)}`)
      const data = await res.json()
      const nar  = (data.naruchnici || [])[0]
      if (nar?.pdf_url) {
        triggerDownload(nar.pdf_url, nar.title || handbook.title)
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
            <div className="bp-handbook-embed-cta-row">
              <button type="button" className="bp-handbook-embed-btn" style={{ background: color }} onClick={() => setStatus('form')}>
                📥 Свали безплатно →
              </button>
              <TrustRow />
            </div>
          )}
        </div>
      </div>

      {(status === 'form' || status === 'loading' || status === 'error') && (
        <div className="bp-handbook-embed-form">
          <div className="bp-handbook-field">
            <input
              className="bp-handbook-embed-input"
              placeholder="Име"
              aria-label="Име и фамилия"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            {touched && nameErr && <span className="bp-handbook-embed-err">{nameErr}</span>}
          </div>

          <div className="bp-handbook-field">
            <input
              className="bp-handbook-embed-input"
              placeholder="Имейл"
              aria-label="Имейл адрес"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            {touched && emailErr && <span className="bp-handbook-embed-err">{emailErr}</span>}
          </div>

          <div className="bp-handbook-field">
            <input
              className="bp-handbook-embed-input"
              placeholder="Телефон"
              aria-label="Телефонен номер"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            {touched && phoneErr && <span className="bp-handbook-embed-err">{phoneErr}</span>}
          </div>

          {status === 'error' && <span className="bp-handbook-embed-err bp-handbook-embed-err--wide">{errorMsg}</span>}

          <div className="bp-handbook-embed-cta-row bp-handbook-embed-cta-row--wide">
            <button
              type="button"
              className="bp-handbook-embed-btn"
              style={{ background: status === 'loading' ? '#9ca3af' : color }}
              disabled={status === 'loading'}
              onClick={submit}
            >
              {status === 'loading' ? '⏳ Подготвям...' : '📥 Изпрати ми наръчника →'}
            </button>
            <TrustRow />
          </div>
        </div>
      )}
    </div>
  )
}
