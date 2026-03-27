// app/api/admin/auth/route.ts

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { password } = body
  const secret = process.env.ADMIN_SECRET

  // No secret configured — allow freely (dev mode or unconfigured)
  if (!secret) {
    const res = NextResponse.json({ ok: true, mode: 'open' })
    // Set a dummy cookie so middleware passes
    res.cookies.set('admin_token', 'no-secret', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  }

  if (password !== secret) {
    return NextResponse.json({ error: 'Грешна парола' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_token', secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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
