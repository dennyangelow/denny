// app/api/integrations/systemeio/test/route.ts

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.systemeio_api
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'systemeio_api не е зададен в Environment Variables' })
  }

  try {
    const res = await fetch('https://api.systeme.io/api/contacts?limit=100&page=1', {
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` })
    }
    const data    = await res.json()
    const batch   = data?.items?.length ?? 0
    const hasMore = data?.hasMore === true
    return NextResponse.json({ ok: true, contacts: hasMore ? `${batch}+` : batch })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}

// POST — тест запис на контакт
// curl -X POST /api/integrations/systemeio/test -d '{"email":"test@example.com","name":"Тест"}'
export async function POST(req: Request) {
  const apiKey = process.env.systemeio_api
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'systemeio_api не е зададен' })
  }

  try {
    const { email, name } = await req.json()
    if (!email) return NextResponse.json({ ok: false, error: 'email е задължителен' }, { status: 400 })

    const [firstName, ...rest] = (name || 'Тест').trim().split(' ')

    const res = await fetch('https://api.systeme.io/api/contacts', {
      method:  'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        email, firstName, lastName: rest.join(' ') || '',
        tags: [{ name: 'test' }, { name: 'naruchnik' }],
      }),
    })

    const data = await res.json()

    if (res.ok)          return NextResponse.json({ ok: true, message: '✅ Записан!', id: data?.id, email: data?.email })
    if (res.status === 409) return NextResponse.json({ ok: true, message: '✅ Вече съществува (409 — нормално)', email })

    return NextResponse.json({ ok: false, status: res.status, error: JSON.stringify(data).slice(0, 500) })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
