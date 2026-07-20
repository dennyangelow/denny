// app/api/econt/offices/route.ts
// Само чете офиси от Еконт — НЕ създава товарителници или пратки!

import { NextRequest, NextResponse } from 'next/server'

const ECONT_USER = process.env.ECONT_USER || 'iasp-dev'
const ECONT_PASS = process.env.ECONT_PASS || '1Asp-dev'
const IS_DEMO    = !process.env.ECONT_USER || process.env.ECONT_ENV === 'demo'
const ECONT_API  = IS_DEMO
  ? 'https://demo.econt.com/ee/services/Nomenclatures'
  : 'https://ee.econt.com/services/Nomenclatures'

export const revalidate = 3600

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ✅ НОВО: обвивка с автоматичен retry — Econt понякога връща временна грешка
// (напр. 502/timeout) за отделен град, дори когато API-то като цяло работи
// нормално (видяно на живо: Варна получи 502 еднократно, докато София,
// Пловдив, Бургас, Петрич минаха без проблем в същата секунда). Вместо да
// показваме грешка на клиента заради еднократен "хълцук" от тяхна страна,
// опитваме до 3 пъти с кратко изчакване между опитите.
async function fetchOfficesWithRetry(url: string, auth: string, body: any, maxAttempts = 3): Promise<{ res: Response; rawText: string } | null> {
  let lastErr: any = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify(body),
        next: { revalidate: 3600 },
      })
      const rawText = await res.text()
      if (res.ok) return { res, rawText }
      // Неуспешен опит — пазим последния резултат, пробваме пак (освен на последния опит)
      lastErr = { res, rawText }
      if (attempt < maxAttempts) await sleep(300 * attempt) // 300ms, после 600ms
    } catch (e) {
      lastErr = e
      if (attempt < maxAttempts) await sleep(300 * attempt)
    }
  }
  // Всички опити неуспешни — връщаме последния резултат (ако е Response) или null (мрежова грешка)
  return lastErr?.res ? lastErr : null
}

export async function GET(req: NextRequest) {
  const cityId   = req.nextUrl.searchParams.get('cityId')
  const cityName = req.nextUrl.searchParams.get('cityName')

  if (!cityId && !cityName) {
    return NextResponse.json({ error: 'cityId or cityName required' }, { status: 400 })
  }

  const auth = Buffer.from(`${ECONT_USER}:${ECONT_PASS}`).toString('base64')
  const url  = `${ECONT_API}/NomenclaturesService.getOffices.json`

  const body: any = { countryCode: 'BGR' }
  if (cityId) body.cityID = cityId

  try {
    const result = await fetchOfficesWithRetry(url, auth, body)

    if (!result) {
      console.error(`[econt/offices] All retry attempts failed (network error) for cityId=${cityId}`)
      return NextResponse.json({ error: 'Econt API unreachable after retries' }, { status: 502 })
    }

    const { res, rawText } = result

    if (!res.ok) {
      console.error(`[econt/offices] HTTP ${res.status} after retries for cityId=${cityId}:`, rawText.slice(0, 500))
      return NextResponse.json({ error: `Econt API returned ${res.status}` }, { status: 502 })
    }

    let data: any
    try { data = JSON.parse(rawText) }
    catch { return NextResponse.json({ error: 'Non-JSON from Econt' }, { status: 502 }) }

    const raw: any[] = Array.isArray(data) ? data : (data.offices || data.Offices || [])

    if (raw.length === 0) {
      return NextResponse.json({ offices: [], count: 0 }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      })
    }

    const requestedCityId = cityId ? Number(cityId) : null

    const offices = raw
      .filter((o: any) => {
        if (o.isActive === false) return false

        if (requestedCityId) {
          const officeCityId: number | null =
            o.address?.city?.id ??
            o.cityID ??
            o.city?.id ??
            null
          if (officeCityId !== null && Number(officeCityId) !== requestedCityId) return false
        }

        const name: string = o.name || ''
        if (name && !/^[\u0400-\u04FF\s\-\.()0-9\/,]+$/.test(name)) return false

        return true
      })
      .map((o: any) => {
        const addr = o.address || {}
        const street = addr.street || ''
        const num    = addr.num || ''
        const other  = addr.other || addr.quarter || ''
        const parts  = [street ? `${street}${num ? ' ' + num : ''}` : '', other].filter(Boolean)

        return {
          id:              o.id,
          code:            o.code,
          name:            o.name,
          address:         parts.join(', ') || addr.fullAddress || '',
          phones:          Array.isArray(o.phones) ? o.phones.join(', ') : (o.phones || ''),
          workingTimeFrom: o.workingTimeFrom || '',
          workingTimeTo:   o.workingTimeTo   || '',
          isAPS:           o.isAPS || false,
        }
      })
      .filter((o: any) => o.id && o.name)
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg'))

    return NextResponse.json({ offices, count: offices.length }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })

  } catch (e: any) {
    console.error('[econt/offices] fetch error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
