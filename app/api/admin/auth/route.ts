// app/api/admin/auth/route.ts — v2
//
// ПОПРАВКИ v2 (спрямо v1):
//   ✅ Cookie-то вече е подписан сесиен токен (lib/admin-session.ts), не
//      самата ADMIN_SECRET парола.
//   ✅ Липсващ ADMIN_SECRET в production → 503 (вход блокиран), не "open mode".
//      Локално (NODE_ENV !== 'production') без secret всичко остава отворено,
//      както преди — middleware.ts прави същото.
//   ✅ Паролата се сравнява без timing разлики.
//   ✅ Невалидно тяло на заявката не гърми с 500.
//
// ⚠️ Rate limit-ът (lib/rate-limit.ts) е в паметта на инстанцията — на
//    serverless всяка инстанция има собствен брояч, така че е забавяне, не
//    гаранция. Дълга, случайна ADMIN_SECRET остава основната защита.

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getIP } from '@/lib/rate-limit'
import {
  ADMIN_COOKIE, SESSION_TTL_SEC, createSessionToken, passwordMatches,
} from '@/lib/admin-session'

export async function POST(req: NextRequest) {
  const ip = getIP(req)

  // Max 5 опита за 15 минути, после 15-минутен lockout
  const rl = rateLimit(`admin-login:${ip}`, {
    limit: 5,
    window: 900,
    lockoutLimit: 5,
    lockoutWindow: 900,
  })

  if (!rl.success) {
    return NextResponse.json(
      {
        error: rl.locked
          ? `Твърде много опити. Изчакай ${Math.ceil(rl.resetIn / 60)} минути.`
          : `Изчакай ${rl.resetIn} секунди.`,
      },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  const secret = process.env.ADMIN_SECRET

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[admin/auth] ADMIN_SECRET не е зададен — входът е блокиран')
      return NextResponse.json(
        { error: 'Admin достъпът не е конфигуриран на сървъра (липсва ADMIN_SECRET).' },
        { status: 503 }
      )
    }
    // Само локална разработка: без secret панелът е отворен (виж middleware.ts)
    return NextResponse.json({ ok: true, mode: 'open' })
  }

  const body     = await req.json().catch(() => ({}))
  const password = typeof body?.password === 'string' ? body.password.slice(0, 256) : ''

  if (!password || !(await passwordMatches(password, secret))) {
    return NextResponse.json(
      { error: `Грешна парола. Остават ${rl.remaining} опита.` },
      { status: 401 }
    )
  }

  const token = await createSessionToken(secret)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_TTL_SEC,
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(ADMIN_COOKIE)
  return res
}
