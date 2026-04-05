// app/api/econt/offices/route.ts
import { NextRequest, NextResponse } from 'next/server'

const ECONT_USER = process.env.ECONT_USER || 'iasp-dev'
const ECONT_PASS = process.env.ECONT_PASS || '1Asp-dev'
const IS_DEMO    = !process.env.ECONT_USER || process.env.ECONT_ENV === 'demo'

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

  // ✅ Изпращаме cityId И cityName заедно — по-прецизен резултат от Еконт
  let body: any
  if (cityId && cityName) {
    body = { city: { id: Number(cityId), name: cityName } }
  } else if (cityId) {
    body = { city: { id: Number(cityId) } }
  } else {
    body = { city: { name: cityName } }
  }

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
      return NextResponse.json({ error: `Econt API returned ${res.status}` }, { status: 502 })
    }

    let data: any
    try { data = JSON.parse(rawText) }
    catch { return NextResponse.json({ error: 'Non-JSON from Econt' }, { status: 502 }) }

    const raw: any[] = Array.isArray(data) ? data : (data.offices || data.Offices || [])

    // ✅ ПОПРАВКА: Ако Еконт върне 0 офиси — връщаме празен масив, НЕ грешка
    // Така frontend-ът ще покаже "Няма офиси за този град"
    if (raw.length === 0) {
      return NextResponse.json({ offices: [], count: 0 }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      })
    }

    const requestedCityId = cityId ? Number(cityId) : null

    const offices = raw
      .filter((o: any) => {
        if (o.isActive === false) return false

        // ✅ ПОПРАВКА: Филтър по cityId на офиса за да изключим регионални офиси
        // Еконт може да върне office.address.city.id, office.cityID или office.city.id
        if (requestedCityId) {
          const officeCityId: number | null =
            o.address?.city?.id ??
            o.cityID ??
            o.city?.id ??
            null

          // Ако полето съществува и НЕ съвпада — изключваме офиса
          // Ако полето ЛИПСВА (null) — включваме офиса (по-добре лишни от липсващи)
          if (officeCityId !== null && officeCityId !== requestedCityId) return false
        }

        // Само кирилски имена — изключва ACS Гърция, DHL и др.
        const name: string = o.name || ''
        if (name && !/^[\u0400-\u04FF\s\-\.()0-9\/,]+$/.test(name)) return false

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
