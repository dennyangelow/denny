'use client'
// components/AffiliatePreloader.tsx — v3
// ✅ Само fetch no-cors — работи (статус 200 потвърден)
// ❌ iframe премахнат — AgroApteki блокират с X-Frame-Options
// ❌ img pixel премахнат — браузърът блокира с ERR_BLOCKED_BY_ORB

import { useEffect } from 'react'

const TRACKING_URL = 'https://agroapteki.com/?tracking=6809eceee15ad'
const STORAGE_KEY  = 'aa_tracked'
const TTL_DAYS     = 28
const DELAY_MS     = 2000

export function AffiliatePreloader() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const { ts } = JSON.parse(stored) as { ts: number }
        if (Date.now() - ts < TTL_DAYS * 24 * 60 * 60 * 1000) return
      }
    } catch {}

    const timer = setTimeout(() => {
      fetch(TRACKING_URL, {
        method: 'GET',
        mode: 'no-cors',
        credentials: 'include',
      })
        .then(() => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now() }))
          } catch {}
        })
        .catch(() => {})
    }, DELAY_MS)

    return () => clearTimeout(timer)
  }, [])

  return null
}
