// app/api/econt/offices/route.ts
import { NextRequest, NextResponse } from 'next/server'

const ECONT_USER = process.env.ECONT_USER || 'iasp-dev'
const ECONT_PASS = process.env.ECONT_PASS || '1Asp-dev'
const IS_DEMO    = !process.env.ECONT_USER || process.env.ECONT_ENV === 'demo'

// ✅ demo API-то е НЕПЪЛНО — ползвай реалния когато има credentials
const ECONT_API  = IS_DEMO
  ? 'https://demo.econt.com/ee/services/Nomenclatures'
  : 'https://ee.econt.com/services/Nomenclatures'

export const revalidate = 3600

export async function GET(req: NextRequest) {
  const cityId   = req.nextUrl.searchParams.get('cityId')
  const cityName = req.nextUrl.searchParams.get('cityName')

  if (!cityId && !cityName) {
    return NextResponse.json({ error: 'cityId or cityName required' }, { status: 400 })
  }

  const auth = Buffer.from(`${ECONT_USER}:${ECONT_PASS}`).toString('base64')
  const url  = `${ECONT_API}/NomenclaturesService.getOffices.json`

  const body = cityId
    ? { city: { id: Number(cityId) } }
    : { city: { name: cityName } }

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

    if (!res.ok) {
      console.error(`[econt/offices] HTTP ${res.status}:`, rawText.slice(0, 500))
      return NextResponse.json({ error: `Econt API returned ${res.status}`, detail: rawText.slice(0, 300) }, { status: 502 })
    }

    let data: any
    try { data = JSON.parse(rawText) }
    catch { return NextResponse.json({ error: 'Non-JSON from Econt', raw: rawText.slice(0, 300) }, { status: 502 }) }

    const raw: any[] = Array.isArray(data) ? data : (data.offices || data.Offices || [])

    if (raw.length === 0) {
      return NextResponse.json({ offices: [], count: 0 }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      })
    }

    // ✅ ПОПРАВКА 1: Филтрираме офисите ДА СА ТОЧНО в избрания град
    // Еконт връща офиси за целия регион — match-ваме по cityId на офиса
    const requestedCityId = cityId ? Number(cityId) : null

    const offices = raw
      .filter((o: any) => {
        if (o.isActive === false) return false

        // Само офиси ТОЧНО в избрания град (не целия регион)
        if (requestedCityId) {
          const officeCityId =
            o.address?.city?.id ??
            o.cityID ??
            o.city?.id ??
            null
          if (officeCityId !== null && officeCityId !== requestedCityId) return false
        }

        // ✅ ПОПРАВКА 2: Само кирилски имена — изключва ACS Гърция и др.
        const name: string = o.name || ''
        if (name && !/^[\u0400-\u04FF\s\-\.()0-9\/,]+$/.test(name)) return false

        // Изключва партньорски мрежи по prefix
        const nameLower = name.toLowerCase()
        if (['acs ', 'dhl ', 'speedy '].some(p => nameLower.startsWith(p))) return false

        return true
      })
      .map((o: any) => {
        const addr   = o.address || {}
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
