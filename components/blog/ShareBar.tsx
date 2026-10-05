'use client'
// components/blog/ShareBar.tsx — v2
// ✅ ПРОМЯНА спрямо v1:
//   ФИКС: Viber линкът сочеше към https://viber.im/forward?... — това НЕ е
//   реален публичен endpoint (Viber никога не е имал официален web-share
//   URL като wa.me на WhatsApp) — връщаше чист 404 (потвърдено в чата).
//   Правилният начин е протоколният deep link viber://forward?text=... —
//   браузърът/ОС-ът го разпознава и отваря директно Viber приложението
//   (desktop или мобилно), с текста вече попълнен в compose полето.
//   Working само ако Viber е инсталиран на устройството (какъвто е и
//   случаят с wa.me по принцип — очаква инсталиран WhatsApp), но поне
//   реално отваря нещо вместо 404 грешка.

import { useState } from 'react'

interface Props {
  url:   string
  title: string
}

const ICON_SIZE = 18

function FacebookIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z"/>
    </svg>
  )
}
function WhatsAppIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.82L2 22l5.4-1.42a9.9 9.9 0 0 0 4.64 1.18h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.03c-.25.7-1.24 1.28-2.03 1.45-.55.12-1.26.21-3.66-.78-3.07-1.27-5.05-4.39-5.2-4.59-.15-.2-1.24-1.65-1.24-3.15 0-1.5.78-2.23 1.06-2.53.25-.27.66-.4 1.06-.4.13 0 .24.01.35.01.3.01.46.03.66.52.25.61.86 2.11.93 2.26.08.16.13.33.03.53-.1.2-.15.33-.3.5-.15.18-.31.4-.45.54-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.36 1.46.3.15.47.13.65-.08.18-.2.76-.89.96-1.19.2-.3.4-.25.68-.15.28.1 1.77.84 2.07.99.3.15.5.22.57.35.08.13.08.73-.17 1.43Z"/>
    </svg>
  )
}
function ViberIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.1 2C7.1 2 3.2 5.1 3 9.3c-.1 2.4.7 4.6 2.2 6.4l-.7 3.4a.6.6 0 0 0 .84.68l3.3-1.5c1.1.4 2.3.6 3.5.6 5 0 8.9-3.3 9-7.5C21.3 6.9 17.3 2 12.1 2Zm3.9 10.9c-.2.4-.9.8-1.3.9-.3.1-.7.1-2.3-.5-1.9-.8-3.2-2.7-3.3-2.9-.1-.1-.8-1-.8-2s.5-1.4.7-1.6c.2-.2.4-.2.5-.2h.4c.1 0 .3 0 .4.3.2.4.6 1.3.6 1.4.1.1.1.2 0 .3-.1.1-.1.2-.2.3-.1.1-.2.3-.3.3-.1.1-.2.2-.1.4.1.2.5.8 1.1 1.3.7.6 1.3.8 1.5.9.2.1.3.1.4-.1.1-.1.5-.6.6-.8.1-.2.3-.1.4-.1.2.1 1.1.5 1.3.6.2.1.3.1.4.2 0 .1 0 .5-.1.9ZM12 4.3c3.9 0 7.1 2.9 7 6.6-.1 3.3-3.1 5.9-6.9 5.9-1.1 0-2.1-.2-3-.5l-.3-.1-2.2.1.5-1.9-.1-.3c-1.2-1.5-1.9-3.3-1.8-5.2.2-3.1 3.2-4.6 6.8-4.6Z"/>
    </svg>
  )
}
function LinkIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1 1" />
      <path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1-1" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function ShareBar({ url, title }: Props) {
  const [copied, setCopied] = useState(false)
  const shareText = encodeURIComponent(title)
  const shareUrl  = encodeURIComponent(url)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API недостъпно (стар браузър/без HTTPS локално) — просто няма feedback, не чупи нищо
    }
  }

  return (
    <div className="bp-share">
      <span className="bp-share-label">Сподели тази статия</span>
      <div className="bp-share-row">
        <a className="bp-share-btn bp-share-btn--fb" href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noopener" aria-label="Сподели във Facebook">
          <FacebookIcon />
        </a>
        <a className="bp-share-btn bp-share-btn--wa" href={`https://wa.me/?text=${shareText}%20${shareUrl}`} target="_blank" rel="noopener" aria-label="Сподели във WhatsApp">
          <WhatsAppIcon />
        </a>
        {/* ✅ ФИКС — viber:// deep link вместо несъществуващия https://viber.im/forward (404) */}
        <a className="bp-share-btn bp-share-btn--vb" href={`viber://forward?text=${shareText}%20${shareUrl}`} aria-label="Сподели във Viber">
          <ViberIcon />
        </a>
        <button type="button" className="bp-share-btn bp-share-btn--copy" onClick={copyLink} aria-label="Копирай линк към статията">
          {copied ? <CheckIcon /> : <LinkIcon />}
        </button>
        {copied && <span className="bp-share-copied">Копирано ✓</span>}
      </div>
    </div>
  )
}
