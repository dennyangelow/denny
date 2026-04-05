// app/api/econt/debug/route.ts
// ВРЕМЕНЕН — изтрий след като всичко работи!
// Отиди на: /api/econt/debug

import { NextResponse } from 'next/server'

export async function GET() {
  const user   = process.env.ECONT_USER || 'iasp-dev'
  const pass   = process.env.ECONT_PASS || '1Asp-dev'
  const isDemo = !process.env.ECONT_USER || process.env.ECONT_ENV === 'demo'
  const base   = isDemo
    ? 'https://demo.econt.com/ee/services/Nomenclatures'
    : 'https://ee.econt.com/services/Nomenclatures'
  const auth   = Buffer.from(`${user}:${pass}`).toString('base64')

  const results: any = {
    config: {
      user: user.slice(0, 4) + '***',
      isDemo,
      base,
      econt_user_set: !!process.env.ECONT_USER,
      econt_pass_set: !!process.env.ECONT_PASS,
    },
    tests: {}
  }

  // Тест 1: getCities само за България
  try {
    const r1 = await fetch(`${base}/NomenclaturesService.getCities.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify({ countryCode: 'BGR' }),
      cache: 'no-store',
    })
    const t1 = await r1.text()
    let parsed: any
    try { parsed = JSON.parse(t1) } catch { parsed = null }
    const cities = parsed?.cities || parsed?.Cities || []
    results.tests.getCities_BGR = {
      status: r1.status,
      ok: r1.ok,
      cities_count: cities.length,
      sample: cities.slice(0, 3).map((c: any) => ({ id: c.id, name: c.name, postCode: c.postCode })),
      raw_preview: parsed ? null : t1.slice(0, 300),
    }
  } catch (e: any) {
    results.tests.getCities_BGR = { error: e.message }
  }

  // Тест 2: getOffices за Петрич (id известен от demo)
  // Намираме id на Петрич от горния резултат
  try {
    const r2 = await fetch(`${base}/NomenclaturesService.getOffices.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify({ countryCode: 'BGR', cityID: '737' }), // Петрич
      cache: 'no-store',
    })
    const t2 = await r2.text()
    let parsed: any
    try { parsed = JSON.parse(t2) } catch { parsed = null }
    const offices = parsed?.offices || parsed?.Offices || []
    results.tests.getOffices_petrich = {
      status: r2.status,
      ok: r2.ok,
      offices_count: offices.length,
      offices: offices.map((o: any) => ({
        id: o.id, name: o.name,
        city_id: o.address?.city?.id,
        city_name: o.address?.city?.name,
      })),
      raw_preview: parsed ? null : t2.slice(0, 300),
    }
  } catch (e: any) {
    results.tests.getOffices_petrich = { error: e.message }
  }

  // Тест 3: getOffices за София
  try {
    const r3 = await fetch(`${base}/NomenclaturesService.getOffices.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify({ countryCode: 'BGR', cityID: '41' }), // София
      cache: 'no-store',
    })
    const t3 = await r3.text()
    let parsed: any
    try { parsed = JSON.parse(t3) } catch { parsed = null }
    const offices = parsed?.offices || parsed?.Offices || []
    results.tests.getOffices_sofia = {
      status: r3.status,
      ok: r3.ok,
      offices_count: offices.length,
      first_3: offices.slice(0, 3).map((o: any) => ({
        id: o.id, name: o.name,
        city_id: o.address?.city?.id,
      })),
    }
  } catch (e: any) {
    results.tests.getOffices_sofia = { error: e.message }
  }

  return NextResponse.json(results, { status: 200 })
}
