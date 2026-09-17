'use client'
// components/client/ReviewSubmitForm.tsx — v1
// Публична форма "Остави отзив" — за продуктови страници и наръчници.
// Праща само към /api/reviews/submit (публичен, rate-limited endpoint) —
// НИКОГА към /api/reviews (admin-only).

import { useState } from 'react'
import { validateName } from '@/lib/validation'

type EntityType = 'own_product' | 'affiliate_product' | 'handbook'

interface Props {
  entityType: EntityType
  entityId:   string
  productName?: string
  // ✅ НОВО — управлява текста на затворения бутон: "Бъди първият" звучи
  // по-канещо, когато страницата все още няма нито един отзив, вместо
  // голото "Остави отзив", което до празна секция изглежда безжизнено.
  hasExistingReviews?: boolean
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} звезди`}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, fontSize: 26, lineHeight: 1, color: n <= value ? '#f59e0b' : '#d1d5db' }}
        >★</button>
      ))}
    </div>
  )
}

export function ReviewSubmitForm({ entityType, entityId, productName, hasExistingReviews = true }: Props) {
  const [open, setOpen]       = useState(false)
  const [name, setName]       = useState('')
  const [location, setLocation] = useState('')
  const [rating, setRating]   = useState(5)
  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)

  const nameErr = name ? validateName(name) : ''
  const canSubmit = name.trim().length >= 2 && !nameErr && text.trim().length >= 10 && rating >= 1

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id:   entityId,
          author_name: name.trim(),
          author_location: location.trim() || undefined,
          rating,
          text: text.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка при изпращане')
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 14, padding: '18px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>✓</div>
        <p style={{ fontWeight: 700, fontSize: 14.5, color: '#065f46', margin: 0 }}>Благодарим за отзива!</p>
        <p style={{ fontSize: 12.5, color: '#4b5563', marginTop: 4 }}>
          Ще се появи на страницата, след като бъде прегледан — обикновено до 1-2 дни.
        </p>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '12px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: '#374151', fontFamily: 'inherit' }}
      >
        {hasExistingReviews
          ? `✍️ Остави отзив${productName ? ` за ${productName}` : ''}`
          : '✍️ Бъди първият, който остави отзив!'}
      </button>
    )
  }

  return (
    <form onSubmit={submit} style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14.5 }}>Остави отзив{productName ? ` за ${productName}` : ''}</strong>
        <button type="button" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
      </div>

      <StarPicker value={rating} onChange={setRating} />

      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Твоето име *"
        style={{ padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }}
      />
      {nameErr && name && <span style={{ fontSize: 12, color: '#dc2626' }}>{nameErr}</span>}

      <input
        value={location}
        onChange={e => setLocation(e.target.value)}
        placeholder="Град (по желание)"
        style={{ padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'inherit' }}
      />

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Какво мислиш за продукта? (мин. 10 символа)"
        rows={4}
        maxLength={2000}
        style={{ padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
      />

      {error && <div style={{ fontSize: 12.5, color: '#dc2626', background: '#fee2e2', borderRadius: 8, padding: '8px 12px' }}>⚠️ {error}</div>}

      <button
        type="submit"
        disabled={!canSubmit || loading}
        style={{ background: canSubmit ? '#1b4332' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 0', fontWeight: 700, fontSize: 14, cursor: canSubmit ? 'pointer' : 'default', fontFamily: 'inherit' }}
      >
        {loading ? 'Изпраща се...' : 'Изпрати отзив'}
      </button>

      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
        Отзивите се преглеждат преди да се публикуват.
      </p>
    </form>
  )
}
