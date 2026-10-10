// lib/admin-guard.ts — v1
// Тънък адаптер върху lib/admin-session.ts за ROUTE HANDLERS.
//
// ЗАЩО: middleware.ts държи публични някои GET маршрути (/api/blog,
// /api/blog-categories) — нужни са на публичния сайт. Но част от параметрите
// им (includeDrafts, includeInactive) трябва да работят САМО за админ. Тук
// проверяваме същата сесия като middleware-а, без да го променяме.
//
// Поведението е 1:1 с isValidToken() в middleware.ts:
//   • няма ADMIN_SECRET → "отворено" само извън production (локална работа);
//   • иначе → валиден подписан admin_token cookie.

import type { NextRequest } from 'next/server'
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin-session'

export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  return verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value, secret)
}
