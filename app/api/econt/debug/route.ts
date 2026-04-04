// app/api/econt/debug/route.ts
// ВРЕМЕНЕН — изтрий след като всичко работи!
// Отиди на: /api/econt/debug  и виж точно какво връща Еконт

import { NextResponse } from 'next/server'

export async function GET() {
  const user    = process.env.ECONT_USER || 'iasp-dev'
  const pass    = process.env.ECONT_PASS || '1Asp-dev'
  const isDemo  = process.env.ECONT_ENV === 'demo' || !process.env.ECONT_USER
  const base    = isDemo
    ? 'https://demo.econt.com/ee/services/Nomenclatures'
    : 'https://ee.econt.com/services/Nomenclatures'
  const auth    = Buffer.from(`${user}:${pass}`).toString('base64')

  const results: any = {
    config: {
      user: user.slice(0, 2) + '***',
      isDemo,
      base,
      env_econt_user_set: !!process.env.ECONT_USER,
    },
    tests: {}
  }

  // Тест 1: getCities с празен body {}
  try {
    const r1 = await fetch(`${base}/NomenclaturesService.getCities.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: '{}',
      cache: 'no-store',
    })
    const t1 = await r1.text()
    let parsed: any
    try { parsed = JSON.parse(t1) } catch { parsed = null }
    results.tests.getCities_empty = {
      status: r1.status,
      ok: r1.ok,
      top_keys: parsed ? Object.keys(parsed) : null,
      cities_count: parsed?.cities?.length ?? parsed?.Cities?.length ?? 'n/a',
      first_city: parsed?.cities?.[0] ?? parsed?.Cities?.[0] ?? null,
      raw_preview: parsed ? null : t1.slice(0, 200),
    }
  } catch (e: any) {
    results.tests.getCities_empty = { error: e.message }
  }

  // Тест 2: getOffices за "София" по name
  try {
    const r2 = await fetch(`${base}/NomenclaturesService.getOffices.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify({ city: { name: 'София' } }),
      cache: 'no-store',
    })
    const t2 = await r2.text()
    let parsed: any
    try { parsed = JSON.parse(t2) } catch { parsed = null }
    results.tests.getOffices_sofia = {
      status: r2.status,
      ok: r2.ok,
      top_keys: parsed ? Object.keys(parsed) : null,
      offices_count: parsed?.offices?.length ?? parsed?.Offices?.length ?? 'n/a',
      first_office: parsed?.offices?.[0] ?? parsed?.Offices?.[0] ?? null,
      raw_preview: parsed ? null : t2.slice(0, 200),
    }
  } catch (e: any) {
    results.tests.getOffices_sofia = { error: e.message }
  }

  return NextResponse.json(results, { status: 200 })
}
