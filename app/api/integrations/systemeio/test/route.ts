// app/api/integrations/systemeio/test/route.ts
// Тества дали Systeme.io API ключът работи — извиква се от SettingsTab

import { NextResponse } from 'next/server'

export async function GET() {
  // ФИКС: Чете и двата варианта на ключа
  const apiKey =
    process.env.SYSTEMEIO_API_KEY ||
    process.env.systemeio_api ||
    process.env.SYSTEME_IO_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      ok:    false,
      error: 'API ключът не е зададен. Добави SYSTEMEIO_API_KEY в Vercel → Settings → Environment Variables',
    })
  }

  try {
    const res = await fetch('https://api.systeme.io/api/contacts?limit=1', {
      headers: {
        'X-API-Key':    apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({
        ok:    false,
        error: `HTTP ${res.status}: ${text.slice(0, 300)}`,
      })
    }

    const data  = await res.json()
    const total = data?.['hydra:totalItems'] ?? data?.total ?? '?'

    return NextResponse.json({ ok: true, contacts: total })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
