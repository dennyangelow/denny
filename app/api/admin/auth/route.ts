// app/api/admin/auth/route.ts — с brute-force lockout

import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getIP } from '@/lib/rate-limit'

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

  const body = await req.json()
  const { password } = body
  const secret = process.env.ADMIN_SECRET

  if (!secret) {
    const res = NextResponse.json({ ok: true, mode: 'open' })
    res.cookies.set('admin_token', 'no-secret', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  }

  if (password !== secret) {
    return NextResponse.json(
      { error: `Грешна парола. Остават ${rl.remaining} опита.` },
      { status: 401 }
    )
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_token', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('admin_token')
  return res
}
