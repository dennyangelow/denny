// app/api/econt/debug/route.ts
// ВРЕМЕНЕН диагностичен route — изтрий след като приключим с Econt дебъгването!
//
// Употреба:
//   /api/econt/debug?name=Добрич        → диагностика за конкретно име на град
//   /api/econt/debug?name=Добрич&raw=1  → + пълен суров JSON на 1-вия намерен офис

import { NextRequest, NextResponse } from 'next/server'

function extractArray(parsed: any, keyA: string, keyB: string): any[] {
  if (!parsed) return []
  if (Array.isArray(parsed)) return parsed
  return parsed[keyA] || parsed[keyB] || []
}

// Обвивка около fetch, която връща ПЪЛНА диагностика на суровия HTTP отговор —
// status, statusText, всички headers, дължина на тялото — не само парснатия JSON.
async function diagFetch(url: string, auth: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Basic ${auth}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  const headersObj: Record<string, string> = {}
  res.headers.forEach((v, k) => { headersObj[k] = v })

  let parsed: any = null
  let parseError: string | null = null
  try { parsed = text ? JSON.parse(text) : null }
  catch (e: any) { parseError = e.message }

  return {
    status: res.status,
    statusText: res.statusText,
    ok: res.ok,
    redirected: res.redirected,
    url_after_redirect: res.url,
    headers: headersObj,
    body_length: text.length,
    body_preview: text.slice(0, 1000),
    parsed,
    parseError,
  }
}

export async function GET(req: NextRequest) {
  const searchName = (req.nextUrl.searchParams.get('name') || 'Добрич').trim()

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
      pass_length: pass.length,
      isDemo,
      base,
      econt_user_set: !!process.env.ECONT_USER,
      econt_pass_set: !!process.env.ECONT_PASS,
    },
    searched_name: searchName,
  }

  // ── Пълна диагностика на суровия getCities отговор ──────────────────────
  let citiesDiag: any
  try {
    citiesDiag = await diagFetch(`${base}/NomenclaturesService.getCities.json`, auth, { countryCode: 'BGR' })
    results.getCities_raw_diagnostic = citiesDiag
  } catch (e: any) {
    results.getCities_fetch_error = { message: e.message, name: e.name, cause: e.cause?.message }
    return NextResponse.json(results, { status: 200 })
  }

  const allCities = extractArray(citiesDiag.parsed, 'cities', 'Cities')
  results.total_cities_returned = allCities.length

  const needle = searchName.toLowerCase()
  const matched = allCities.filter((c: any) => String(c.name || '').toLowerCase().includes(needle))
  results.matched_cities = matched.map((c: any) => ({ id: c.id, name: c.name, postCode: c.postCode, regionName: c.regionName, raw: c }))

  if (matched.length === 0) {
    results.warning = `Няма съвпадение за "${searchName}" сред ${allCities.length} върнати града.`
    return NextResponse.json(results, { status: 200 })
  }

  // ── За всеки съвпаднал град, пълна диагностика на getOffices ────────────
  results.per_city_offices = {}
  for (const c of matched) {
    try {
      const offDiag = await diagFetch(`${base}/NomenclaturesService.getOffices.json`, auth, { countryCode: 'BGR', cityID: String(c.id) })
      const offices = extractArray(offDiag.parsed, 'offices', 'Offices')
      results.per_city_offices[`cityId_${c.id}_(${c.name})`] = {
        status: offDiag.status,
        ok: offDiag.ok,
        body_length: offDiag.body_length,
        body_preview: offices.length === 0 ? offDiag.body_preview : undefined,
        offices_count: offices.length,
        offices: offices.map((o: any) => ({
          id: o.id, name: o.name, isActive: o.isActive,
          returned_city_id: o.address?.city?.id, returned_city_name: o.address?.city?.name,
        })),
      }
    } catch (e: any) {
      results.per_city_offices[`cityId_${c.id}_(${c.name})`] = { error: e.message }
    }
  }

  return NextResponse.json(results, { status: 200 })
}
