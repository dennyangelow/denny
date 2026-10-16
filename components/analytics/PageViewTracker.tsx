'use client'
// components/analytics/PageViewTracker.tsx — v3
// ✅ v3: "собствено устройство". Отвори веднъж dennyangelow.com/?da_internal=1 на всяко твое
//    устройство (компютър, телефон) — оттам нататък посещенията му се маркират is_internal и НЕ влизат
//    в статистиката, дори IP-то ти да се смени. Изключване: ?da_internal=0.
//    (Админ панелът вече маркира устройството сам при влизане — виж InternalDeviceCard.tsx; линкът е резервен.)
//    (По-точно от изключване по IP: един IP на малък доставчик може да е споделен с други хора.)
// ✅ v2 спрямо v1:
//   • Без useSearchParams — вече не се задейства при всяка промяна на ?филтър
//     (и не изисква <Suspense>). Праща се само при смяна на пътя (pathname).
//   • Анти-дубликат: същата страница в рамките на 2 сек се пропуска
//     (React StrictMode в dev и двойни рендери записваха по 2 реда).
//   • Източникът (referrer + UTM) се праща САМО на първата страница от сесията.
//     Преди document.referrer се повтаряше на всяка вътрешна страница и
//     "надуваше" Google/Facebook.
//   • UTM се пази в sessionStorage ('da_utm') — така и поръчката може да го
//     вземе (виж бележката за CartSystem.tsx).
//   • fbclid / ttclid / gclid без UTM → разпознават се като facebook / tiktok /
//     google (utm_medium = 'click-id' / 'cpc', за да се вижда, че е изведено).

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const VISITOR_KEY = 'da_vid'   // localStorage — постоянен
const SESSION_KEY = 'da_sid'   // sessionStorage — за таба
const LANDED_KEY  = 'da_landed'
const UTM_KEY     = 'da_utm'
const LAST_KEY    = 'da_last'
const INTERNAL_KEY = 'da_internal'

type Campaign = { utm_source?: string; utm_medium?: string; utm_campaign?: string }

function newId(): string {
  try { if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 24) } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function getOrCreate(storage: Storage, key: string): string {
  let id = storage.getItem(key)
  if (!id) { id = newId(); storage.setItem(key, id) }
  return id
}

function readCampaign(): Campaign {
  const q = new URLSearchParams(window.location.search)
  const c: Campaign = {
    utm_source:   q.get('utm_source')   || undefined,
    utm_medium:   q.get('utm_medium')   || undefined,
    utm_campaign: q.get('utm_campaign') || undefined,
  }
  if (!c.utm_source) {
    if (q.get('fbclid'))      { c.utm_source = 'facebook'; c.utm_medium = c.utm_medium || 'click-id' }
    else if (q.get('ttclid')) { c.utm_source = 'tiktok';   c.utm_medium = c.utm_medium || 'click-id' }
    else if (q.get('gclid'))  { c.utm_source = 'google';   c.utm_medium = c.utm_medium || 'cpc' }
  }
  return c
}

export function PageViewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return
    try {
      // ?da_internal=1 → това устройство е мое; ?da_internal=0 → вече не е
      const flag = new URLSearchParams(window.location.search).get('da_internal')
      if (flag === '1') localStorage.setItem(INTERNAL_KEY, '1')
      if (flag === '0') localStorage.setItem(INTERNAL_KEY, '0')   // изричен избор — админът не го връща автоматично
      const internal = localStorage.getItem(INTERNAL_KEY) === '1'

      // Анти-дубликат
      const now  = Date.now()
      const last = (sessionStorage.getItem(LAST_KEY) || '').split('|')
      if (last[0] === pathname && now - Number(last[1] || 0) < 2000) return
      sessionStorage.setItem(LAST_KEY, `${pathname}|${now}`)

      const visitorId = getOrCreate(localStorage, VISITOR_KEY)
      const sessionId = getOrCreate(sessionStorage, SESSION_KEY)

      // Първа страница от сесията → източник
      const landing = !sessionStorage.getItem(LANDED_KEY)
      let campaign: Campaign = {}
      if (landing) {
        sessionStorage.setItem(LANDED_KEY, '1')
        campaign = readCampaign()
        if (campaign.utm_source || campaign.utm_campaign) {
          sessionStorage.setItem(UTM_KEY, JSON.stringify(campaign))
        }
      }

      fetch('/api/analytics/page-view', {
        method:    'POST',
        headers:   { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          path:         pathname,
          internal,
          visitor_id:   visitorId,
          session_id:   sessionId,
          referrer:     landing ? (document.referrer || undefined) : undefined,
          ...campaign,
        }),
      }).catch(() => {})
    } catch {
      // SSR или storage недостъпен
    }
  }, [pathname])

  return null
}
