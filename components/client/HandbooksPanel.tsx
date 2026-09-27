'use client'

// components/client/HandbooksPanel.tsx — v5
// ✅ ПРОМЯНА спрямо v4:
//   1) Handbook вече приема avg_rating/reviews_count (реални, от lib/reviews.ts
//      getAggregateRatingsBatch — виж page.tsx). Звездите се показват САМО
//      ако и двете са реални (>0) — идентичен стандарт на hasRealRating() в
//      NaruchnikClient.tsx/naruchnik/page.tsx. Преди бяха твърди ★★★★★ без
//      подкрепящи данни — същият тип проблем, заради който по-рано махнахме
//      фалшивата "изтича след..." спешност.
//   2) Премахнати повторните "БЕЗПЛАТНО" пилюли — на картата, в потвърждението
//      във формата, и думата "безплатно" в долния trust ред. Остават точно
//      2 споменавания в целия панел: заглавието горе и footer-а долу.
//      Причина: 7 повторения на "безплатно" в едно UI парче реално понижава
//      доверието, не го увеличава.
//   3. ФИКС (искане на потребителя): reset() вече НЕ изчиства
//      hbName/hbEmail/hbPhone. При избор на ВТОРИЯ наръчник след успешно
//      сваляне на първия, формата идва предпопълнена и вече валидирана
//      (зелени "✓ Добре" отметки) — един клик върху "Изтегли", не
//      препечатване на трите полета отново. downloadedSlugs проследява кои
//      наръчници вече са свалени в тази сесия, за да покажем "✓ Свален"
//      индикатор в списъка вместо да предполагаме, че потребителят помни.
//   4) Card subtitle остава единственото описателно поле на всяка карта —
//      виж бележката в чат отговора за препоръчания нов copy текст, който
//      да се въведе в admin панела (subtitle колоната на naruchnici) — не е
//      частта от кода, а съдържание, което трябва да редактираш в базата.

import { useState, useEffect } from 'react'
import Image from 'next/image'
import type { ActivityEvent } from '@/lib/social-proof'
// ✅ ФИКС: преди беше lib/leadValidation.ts — отделен, по-хлабав набор
//    правила (напр. телефон само "≥9 цифри", без горна граница; име само
//    "≥2 символа", без regex за букви). NaruchnikClient.tsx вече ползва
//    lib/validation.ts директно (същите функции, които /api/leads reales
//    server-side чрез serverValidate) — двете форми за СЪЩИЯ /api/leads
//    endpoint проверяваха различни неща. Пример: телефон "0888123456789012"
//    (16 цифри) минаваше client-side тук, но сървърът го отхвърля
//    (макс. 15) — виж фикса на submitHandbook по-долу за какво се случваше
//    след това. lib/leadValidation.ts вече не се използва никъде — можеш
//    да го изтриеш от репото (BlogHandbookEmbed.tsx, ако/когато го
//    построиш, да импортва directly оттук).
import { validateName, validateEmail, validatePhone } from '@/lib/validation'

interface Handbook {
  slug: string; title: string; subtitle: string
  emoji: string; color: string; image_url?: string; bg: string; badge: string
  downloads_count?: number
  // ✅ НОВО — реални, от reviews таблицата (getAggregateRatingsBatch('handbook', ids))
  avg_rating?: number
  reviews_count?: number
}

const ACTIVITY_LABEL: Record<ActivityEvent['type'], string> = {
  download: 'току-що изтегли',
  order:    'току-що поръча',
}

export function HandbooksPanel({
  handbooks,
  recentActivity = [],
  totalDownloads,
  ctaTitle,
  ctaSubtitle,
}: {
  handbooks: Handbook[]
  recentActivity?: ActivityEvent[]
  totalDownloads?: number
  ctaTitle?: string
  ctaSubtitle?: React.ReactNode
}) {
  const [selectedSlug, setSelectedSlug]   = useState<string | null>(null)
  const [hbName, setHbName]               = useState('')
  const [hbEmail, setHbEmail]             = useState('')
  const [hbPhone, setHbPhone]             = useState('')
  const [touched, setTouched]             = useState({ name: false, email: false, phone: false })
  const [hbLoading, setHbLoading]         = useState(false)
  const [hbDone, setHbDone]               = useState<{ pdfUrl: string; title: string } | null>(null)
  const [submitError, setSubmitError]     = useState('')
  const [activeEvent, setActiveEvent]     = useState<ActivityEvent | null>(null)
  const [showNotif, setShowNotif]         = useState(false)
  const [pulseBtn, setPulseBtn]           = useState(false)
  // ✅ НОВО — кои наръчници вече са свалени в тази сесия (за "✓ Свален" бадж
  //    в списъка и за да знаем кога да предпопълним, а не изчистим формата)
  const [downloadedSlugs, setDownloadedSlugs] = useState<Set<string>>(new Set())

  const computedTotal = totalDownloads ?? handbooks.reduce((s, h) => s + (h.downloads_count || 0), 0)

  useEffect(() => {
    if (recentActivity.length === 0) return
    let idx = 0
    const showNext = () => {
      setActiveEvent(recentActivity[idx % recentActivity.length])
      setShowNotif(true)
      setTimeout(() => setShowNotif(false), 4500)
      idx++
    }
    const first    = setTimeout(showNext, 3000)
    const interval = setInterval(showNext, 9000)
    return () => { clearTimeout(first); clearInterval(interval) }
  }, [recentActivity])

  useEffect(() => {
    const pulse = setTimeout(() => setPulseBtn(true), 5000)
    return () => clearTimeout(pulse)
  }, [])

  const nameErr  = validateName(hbName)
  const emailErr = validateEmail(hbEmail)
  const phoneErr = validatePhone(hbPhone)
  const isValid  = !nameErr && !emailErr && !phoneErr

  const touch = (field: keyof typeof touched) => setTouched(t => ({ ...t, [field]: true }))

  // ✅ ФИКС: преди изчистваше и hbName/hbEmail/hbPhone — потребителят
  //    трябваше да препечата трите полета за ВСЕКИ следващ наръчник, въпреки
  //    че вече са валидирани от първото сваляне. Сега reset() пипа само
  //    selectedSlug/hbDone/submitError — данните остават, "✓ Добре" отметките
  //    остават зелени, и вторият наръчник е буквално един клик.
  const reset = () => {
    setHbDone(null); setSelectedSlug(null)
    setSubmitError('')
  }

  const submitHandbook = async (slug: string) => {
    setTouched({ name: true, email: true, phone: true })
    if (!isValid) return
    setHbLoading(true); setSubmitError('')
    try {
      // ✅ ФИКС: преди резултатът от тази заявка изобщо не се проверяваше —
      //    ако serverValidate() в /api/leads/route.ts отхвърли лийда
      //    (disposable email, фалшив pattern, телефон извън 7-15 цифри...),
      //    кодът продължаваше все едно нищо не е станало и потребителят пак
      //    получаваше PDF-а. Резултат: реален, изтеглящ потребител, за
      //    когото НЯМА запазен lead в базата — тих data loss, невидим и в
      //    двете посоки (не виждаш грешка, а и нямаш контакта). Сега се
      //    държи като NaruchnikClient.tsx — проверява res.ok, показва
      //    submitError и НЕ сваля файла при отхвърлен лийд.
      const leadRes  = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: hbEmail.trim(), name: hbName.trim(), phone: hbPhone.trim(), source: 'naruchnik', naruchnik_slug: slug }),
      })
      const leadData = await leadRes.json().catch(() => ({}))
      if (!leadRes.ok) {
        setSubmitError(leadData.error || 'Грешка при изпращане. Провери данните и опитай пак.')
        setHbLoading(false)
        return
      }
      const res  = await fetch(`/api/naruchnici?slug=${encodeURIComponent(slug)}`)
      const data = await res.json()
      const nar  = (data.naruchnici || [])[0]
      if (nar?.pdf_url) {
        setHbDone({ pdfUrl: nar.pdf_url, title: nar.title })
        setDownloadedSlugs(prev => new Set(prev).add(slug))
        const a = document.createElement('a')
        a.href = nar.pdf_url; a.download = nar.title + '.pdf'; a.target = '_blank'
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
      } else { setSubmitError('Проблем при зареждане. Опитай пак.') }
    } catch { setSubmitError('Грешка. Опитай пак.') }
    setHbLoading(false)
  }

  const fieldStyle = (err: string, isTouched: boolean) => ({
    padding: '13px 16px',
    borderRadius: 12,
    border: `1.5px solid ${isTouched && err ? '#f87171' : isTouched && !err ? '#16a34a' : '#d1fae5'}`,
    background: isTouched && err ? '#fff5f5' : isTouched && !err ? '#f0fdf4' : '#fff',
    color: '#111',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s, background 0.2s',
  })

  return (
    <div className="handbooks-panel" style={{ position: 'relative', overflow: 'visible' }}>

      {/* ── Social proof popup ── */}
      <div style={{
        position: 'absolute', top: -14, left: 8, right: 8, zIndex: 10,
        background: '#fff',
        border: '1.5px solid #bbf7d0',
        borderRadius: 12, padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 8px 24px rgba(22,163,74,0.15)',
        transform: showNotif ? 'translateY(0)' : 'translateY(-80px)',
        opacity: showNotif ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🎉</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: '#15803d', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeEvent?.firstName}</div>
          <div style={{ color: '#6b7280', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeEvent ? ACTIVITY_LABEL[activeEvent.type] : ''} {activeEvent?.label}</div>
        </div>
        <div style={{ marginLeft: 'auto', flexShrink: 0, background: '#dcfce7', borderRadius: 20, padding: '2px 8px', color: '#15803d', fontSize: 10, fontWeight: 800 }}>НА ЖИВО</div>
      </div>

      {/* ── Хедър ── */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 26 }}>🎁</span>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#14532d', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {ctaTitle || <>Вземи Наръчника <span style={{ color: '#16a34a' }}>Безплатно</span></>}
          </div>
        </div>
        <div style={{ color: '#6b7280', fontSize: 13 }}>
          {/* ✅ ФИКС: fallback-ът вече не повтаря computedTotal — същото
              число вече стои в trust банера долу в списъка. Тук е чисто
              описание на стойността, не втора бройка. */}
          {ctaSubtitle ?? <>Пълни схеми на торене и защита — готови за прилагане още днес</>}
        </div>
      </div>

      <div style={{ height: 1.5, background: '#d1fae5', margin: '0 0 16px' }} />

      {/* ── Готово ── */}
      {hbDone ? (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>🎉</div>
          <div style={{ color: '#15803d', fontWeight: 900, fontSize: 20, marginBottom: 6 }}>Честито! Свалянето започна!</div>
          <div style={{ color: '#374151', fontSize: 13, marginBottom: 6, lineHeight: 1.6 }}>
            Провери папката <strong style={{ color: '#14532d' }}>Изтегляния</strong> на телефона/компютъра си.
          </div>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 20 }}>
            📧 Изпратихме и на <span style={{ color: '#15803d', fontWeight: 700 }}>{hbEmail}</span>
          </div>
          <a href={hbDone.pdfUrl} target="_blank" rel="noopener noreferrer" download
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', borderRadius: 13, padding: '14px 26px', textDecoration: 'none', fontWeight: 900, fontSize: 15, marginBottom: 14, boxShadow: '0 8px 28px rgba(22,163,74,0.4)' }}>
            📥 Изтегли отново
          </a>
          <br />
          {handbooks.some(h => !downloadedSlugs.has(h.slug)) && (
            <button onClick={reset} style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', marginTop: 4 }}>
              ← Вземи и другия наръчник (1 клик, данните са запазени)
            </button>
          )}
        </div>

      /* ── Форма ── */
      ) : selectedSlug ? (
        <div>
          {(() => {
            const hb = handbooks.find(h => h.slug === selectedSlug)
            return hb && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f0fdf4', border: `1.5px solid ${hb.color}44`, borderRadius: 14, padding: '10px 12px', marginBottom: 16 }}>
                <div style={{ width: 50, height: 68, flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: `${hb.color}18`, boxShadow: `0 4px 16px ${hb.color}33` }}>
                  {hb.image_url
                    ? <Image src={hb.image_url} alt="" width={50} height={68} sizes="50px" quality={45} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 10 }} />
                    : <span style={{ fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>{hb.emoji}</span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: hb.color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 3 }}>{hb.badge}</div>
                  <div style={{ color: '#14532d', fontWeight: 800, fontSize: 13, lineHeight: 1.3 }}>{hb.title}</div>
                </div>
                <button onClick={() => setSelectedSlug(null)} style={{ background: '#f3f4f6', border: '1.5px solid #e5e7eb', color: '#6b7280', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
              </div>
            )
          })()}

          {isValid ? (
            <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '8px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>✓</span>
              <span style={{ color: '#374151', fontSize: 12, lineHeight: 1.4 }}>
                Данните ти вече са попълнени — просто натисни <strong style={{ color: '#14532d' }}>Изтегли</strong>
              </span>
            </div>
          ) : (
            <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '8px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ color: '#374151', fontSize: 12, lineHeight: 1.4 }}>
                Попълни само <strong style={{ color: '#15803d' }}>3 полета</strong> и наръчникът се сваля <strong style={{ color: '#14532d' }}>веднага</strong> — без регистрация
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Ime */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ color: '#374151', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
                  ИМЕ И ФАМИЛИЯ <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {touched.name && !nameErr && <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 700 }}>✓ Добре</span>}
              </div>
              <input type="text" className="hb-input" placeholder="Напр. Иван Петров"
                value={hbName} onChange={e => setHbName(e.target.value)} onBlur={() => touch('name')}
                style={fieldStyle(nameErr, touched.name)} />
              {touched.name && nameErr && <div style={{ color: '#dc2626', fontSize: 11, fontWeight: 600, marginTop: 5 }}>⚠ {nameErr}</div>}
            </div>

            {/* Email */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ color: '#374151', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
                  ИМЕЙЛ АДРЕС <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {touched.email && !emailErr && <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 700 }}>✓ Добре</span>}
              </div>
              <input type="email" className="hb-input" placeholder="email@example.com"
                value={hbEmail}
                onChange={e => { let v=e.target.value,r=''; for(let i=0;i<v.length;i++){let cc=v.charCodeAt(i);if(cc>=33&&cc<=126)r+=v[i].toLowerCase()} setHbEmail(r); touch('email') }}
                onPaste={e => { e.preventDefault(); let v=e.clipboardData.getData('text'),r=''; for(let i=0;i<v.length;i++){let cc=v.charCodeAt(i);if(cc>=33&&cc<=126)r+=v[i].toLowerCase()} setHbEmail(r); touch('email') }}
                onBlur={() => touch('email')}
                spellCheck={false} autoCapitalize="none" autoCorrect="off" inputMode="email"
                style={fieldStyle(emailErr, touched.email)} />
              {touched.email && emailErr && <div style={{ color: '#dc2626', fontSize: 11, fontWeight: 600, marginTop: 5 }}>⚠ {emailErr}</div>}
            </div>

            {/* Phone */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ color: '#374151', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' }}>
                  ТЕЛЕФОН <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {touched.phone && !phoneErr && <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 700 }}>✓ Добре</span>}
              </div>
              <input type="tel" className="hb-input" placeholder="08X XXX XXXX"
                value={hbPhone}
                onChange={e => { let v=e.target.value,r=''; for(let i=0;i<v.length;i++){let cc=v.charCodeAt(i);if((cc>=48&&cc<=57)||cc===43||cc===32||cc===45||cc===40||cc===41||cc===46)r+=v[i]} setHbPhone(r); touch('phone') }}
                onPaste={e => { e.preventDefault(); let v=e.clipboardData.getData('text'),r=''; for(let i=0;i<v.length;i++){let cc=v.charCodeAt(i);if((cc>=48&&cc<=57)||cc===43||cc===32||cc===45||cc===40||cc===41||cc===46)r+=v[i]} setHbPhone(r); touch('phone') }}
                onKeyDown={e => { if (e.key.length===1 && ((e.key>='a'&&e.key<='z')||(e.key>='A'&&e.key<='Z')||(e.key.charCodeAt(0)>=0x400&&e.key.charCodeAt(0)<=0x4FF))) e.preventDefault() }}
                onBlur={() => touch('phone')}
                inputMode="tel"
                style={fieldStyle(phoneErr, touched.phone)} />
              {touched.phone && phoneErr && <div style={{ color: '#dc2626', fontSize: 11, fontWeight: 600, marginTop: 5 }}>⚠ {phoneErr}</div>}
              <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 5 }}>📞 За лична консултация при нужда</div>
            </div>

            {submitError && (
              <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
                ⚠ {submitError}
              </div>
            )}

            <button
              onClick={() => submitHandbook(selectedSlug!)}
              disabled={hbLoading}
              style={{
                background: hbLoading ? '#e5e7eb' : isValid ? 'linear-gradient(135deg, #16a34a, #15803d)' : '#f3f4f6',
                color: hbLoading ? '#9ca3af' : isValid ? '#fff' : '#9ca3af',
                border: 'none', borderRadius: 14, padding: '16px', fontSize: 16, fontWeight: 900,
                cursor: hbLoading ? 'wait' : 'pointer', fontFamily: 'inherit',
                transition: 'all 0.25s', width: '100%',
                boxShadow: isValid && !hbLoading ? '0 8px 28px rgba(22,163,74,0.35)' : 'none',
                letterSpacing: '-0.01em',
              }}
            >
              {hbLoading ? '⏳ Подготвям наръчника...' : isValid ? '📥 Изтегли Сега →' : '📋 Попълни всички полета'}
            </button>
          </div>
        </div>

      /* ── Списък наръчници ── */
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {handbooks.map((hb, idx) => {
            const hasRealRating = !!(hb.avg_rating && hb.reviews_count && hb.avg_rating > 0 && hb.reviews_count > 0)
            const alreadyDownloaded = downloadedSlugs.has(hb.slug)
            return (
            <button
              key={hb.slug}
              onClick={() => setSelectedSlug(hb.slug)}
              style={{
                cursor: 'pointer',
                border: '1.5px solid #d1fae5',
                textAlign: 'left' as const,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                padding: '0',
                borderRadius: '16px',
                background: '#fff',
                transition: 'transform 0.22s, box-shadow 0.22s, border-color 0.22s',
                overflow: 'hidden',
                boxShadow: '0 2px 14px rgba(22,163,74,0.07)',
                minHeight: 100,
                animation: pulseBtn && idx === 0 && !alreadyDownloaded ? 'subtlePulse 2.5s ease-in-out infinite' : 'none',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)'
                e.currentTarget.style.boxShadow = `0 10px 32px ${hb.color}28`
                e.currentTarget.style.borderColor = `${hb.color}70`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 14px rgba(22,163,74,0.07)'
                e.currentTarget.style.borderColor = '#d1fae5'
              }}
            >
              <div style={{
                width: 82, height: 108, flexShrink: 0,
                overflow: 'hidden', position: 'relative',
                background: `${hb.color}10`,
                borderRadius: '14px 0 0 14px',
              }}>
                {hb.image_url ? (
                  <Image
                    src={hb.image_url}
                    alt={hb.title}
                    width={82}
                    height={108}
                    priority={idx === 0}
                    sizes="82px"
                    quality={50}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.parentElement!.innerHTML = `<span style="font-size:34px;display:flex;align-items:center;justify-content:center;width:100%;height:100%">${hb.emoji}</span>`
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>{hb.emoji}</span>
                )}
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: `linear-gradient(180deg, ${hb.color}, ${hb.color}88)` }} />
              </div>

              <div style={{ flex: 1, padding: '13px 14px 13px 15px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{
                    background: `${hb.color}15`, color: hb.color,
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                    borderRadius: 5, padding: '2px 7px', border: `1px solid ${hb.color}35`,
                  }}>{hb.badge}</div>
                  {/* ✅ ФИКС: махнат отделен "БЕЗПЛАТНО" бадж тук — заглавието
                      горе и footer-ът долу вече го казват; на всяка карта е
                      трето/четвърто повторение. При свалян наръчник показваме
                      вместо това честен статус. */}
                  {alreadyDownloaded && (
                    <div style={{ background: '#dcfce7', color: '#15803d', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', borderRadius: 5, padding: '2px 7px', border: '1px solid #a7f3d0' }}>
                      ✓ СВАЛЕН
                    </div>
                  )}
                </div>
                <div style={{ color: '#14532d', fontWeight: 800, fontSize: 14.5, lineHeight: 1.25, marginBottom: 5 }}>{hb.title}</div>
                <div style={{
                  color: '#6b7280', fontSize: 11.5, lineHeight: 1.45,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                } as React.CSSProperties}>{hb.subtitle}</div>
                {/* ✅ ФИКС: звезди само ако hasRealRating (реални avg_rating/
                    reviews_count от reviews таблицата) — иначе просто броя
                    сваляния, без измислен рейтинг. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                  {hasRealRating && (
                    <>
                      <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700 }}>★ {hb.avg_rating!.toFixed(1)}/5</span>
                      <span style={{ color: '#d1d5db', fontSize: 10 }}>·</span>
                      <span style={{ color: '#9ca3af', fontSize: 10.5 }}>{hb.reviews_count!.toLocaleString('bg-BG')} отзива</span>
                      {!!hb.downloads_count && <span style={{ color: '#d1d5db', fontSize: 10 }}>·</span>}
                    </>
                  )}
                  {!!hb.downloads_count && (
                    <span style={{ color: '#9ca3af', fontSize: 10.5 }}>{hb.downloads_count.toLocaleString('bg-BG')}+ изтеглени</span>
                  )}
                </div>
              </div>

              <div style={{ width: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, flexShrink: 0, paddingRight: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${hb.color}, ${hb.color}cc)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, color: '#fff', fontWeight: 900,
                  boxShadow: `0 4px 14px ${hb.color}44`,
                }}>↓</div>
                <span style={{ color: hb.color, fontSize: 8, fontWeight: 800, letterSpacing: '0.05em' }}>ВЗЕМИ</span>
              </div>
            </button>
          )})}

          {/* ✅ ФИКС: премахната думата "безплатно" тук — вече е казана горе
              (заглавие) и долу (footer trust ред); тук остава само реалния
              брояч + честната "без уловки" реплика. */}
          {computedTotal > 0 && (
            <div style={{ textAlign: 'center', marginTop: 4, padding: '9px 12px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10 }}>
              <span style={{ color: '#166534', fontSize: 11, fontWeight: 700 }}>
                ✓ {computedTotal.toLocaleString('bg-BG')}+ фермери вече изтеглиха — без уловки, без спам
              </span>
            </div>
          )}
        </div>
      )}

      <div className="handbooks-panel-footer" style={{ marginTop: 14 }}>
        <span>🔒 Без спам</span>
        <span style={{ color: '#d1d5db' }}>·</span>
        <span>Директно сваляне</span>
        <span style={{ color: '#d1d5db' }}>·</span>
        <span>Безплатно</span>
      </div>

      <style>{`
        @keyframes subtlePulse {
          0%, 100% { box-shadow: 0 2px 14px rgba(22,163,74,0.07); }
          50% { box-shadow: 0 4px 24px rgba(22,163,74,0.2), 0 0 0 3px rgba(22,163,74,0.07); }
        }
        .hb-input::placeholder { color: #9ca3af !important; opacity: 1; }
        .hb-input { color: #111 !important; }
        .hb-input:focus { outline: none; border-color: #16a34a !important; background: #f0fdf4 !important; }
      `}</style>
    </div>
  )
}
