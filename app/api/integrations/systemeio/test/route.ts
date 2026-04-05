// app/api/integrations/systemeio/test/route.ts
// Тества дали SYSTEMEIO_API_KEY работи — извиква се от SettingsTab

import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.SYSTEMEIO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'SYSTEMEIO_API_KEY не е зададен в Env Vars' })
  }

  try {
    // Вземаме първите 5 контакта — само за да проверим автентикацията
    const res = await fetch('https://api.systeme.io/api/contacts?limit=5', {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ ok: false, error: `HTTP ${res.status}: ${text}` })
    }

    const data = await res.json()
    const total = data?.['hydra:totalItems'] ?? data?.total ?? '?'

    return NextResponse.json({ ok: true, contacts: total })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
