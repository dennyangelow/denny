// app/api/econt/offices/route.ts
// Само чете офиси от Еконт — НЕ създава товарителници или пратки!
//
// ✅ v3 — Същата реална причина като при cities/route.ts:
//   Failed to set Next.js data cache, items over 2MB can not be cached (...)
// Bulk отговорът за ВСИЧКИ офиси в България е голям (вероятно над 2MB), и
// Next.js-кия вграден fetch cache (`next: { revalidate }`) не може да го
// кешира — докато опитва, четенето на body-то на СЪЩАТА заявка понякога се
// прекъсва → празен/чупен rawText → произволни "Non-JSON from Econt" за
// произволни градове (Бургас, после Сливен, и т.н.) — не е градът, а моментът.
//
// Решение: `cache: 'no-store'` (пропускаме Next.js data cache изцяло за тази
// заявка) + пазим САМИ пълния raw масив офиси в module-level памет с TTL.
// Филтрирането по конкретен град става locally, от кеширания масив — бързо,
// без нужда да го подаваме пак на Next.js кеша.

import { NextRequest, NextResponse } from 'next/server'

const ECONT_USER = process.env.ECONT_USER || 'iasp-dev'
const ECONT_PASS = process.env.ECONT_PASS || '1Asp-dev'
const IS_DEMO    = !process.env.ECONT_USER || process.env.ECONT_ENV === 'demo'
const ECONT_API  = IS_DEMO
  ? 'https://demo.econt.com/ee/services/Nomenclatures'
  : 'https://ee.econt.com/services/Nomenclatures'

// ── In-memory кеш на СУРОВИЯ (непреработен) масив от Econt — така филтрирането
// по различни градове в различни заявки не изисква нов fetch всеки път.
// Изчиства се при рестарт на сървъра/нов deploy — първата заявка след това
// просто ще опресни кеша наново.
let officesMemCache: { raw: any[]; savedAt: number } | null = null
const OFFICES_TTL_MS = 60 * 60 * 1000 // 1 час

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function fetchOfficesWithRetry(
  url: string,
  auth: string,
  body: any,
  maxAttempts = 4
): Promise<{ res: Response; rawText: string } | null> {
  let lastErr: any = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify(body),
        // ✅ КЛЮЧОВА ПРОМЯНА: без Next.js data cache — виж обяснението горе.
        cache: 'no-store',
        signal: controller.signal,
      })
      const rawText = await res.text()
      clearTimeout(timeoutId)

      if (res.ok) {
        try {
          JSON.parse(rawText)
          return { res, rawText }
        } catch {
          console.warn(`[econt/offices] attempt ${attempt}/${maxAttempts}: HTTP 200 но невалиден/празен JSON (length=${rawText.length}), retry-вам...`)
          lastErr = { res, rawText }
        }
      } else {
        lastErr = { res, rawText }
      }
      if (attempt < maxAttempts) await sleep(400 * attempt)
    } catch (e) {
      clearTimeout(timeoutId)
      lastErr = e
      if (attempt < maxAttempts) await sleep(400 * attempt)
    }
  }
  return lastErr?.res ? lastErr : null
}

function filterAndShape(raw: any[], requestedCityId: number | null) {
  return raw
    .filter((o: any) => {
      if (o.isActive === false) return false
      if (requestedCityId) {
        const officeCityId: number | null =
          o.address?.city?.id ?? o.cityID ?? o.city?.id ?? null
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
}

export async function GET(req: NextRequest) {
  const cityId   = req.nextUrl.searchParams.get('cityId')
  const cityName = req.nextUrl.searchParams.get('cityName')

  if (!cityId && !cityName) {
    return NextResponse.json({ error: 'cityId or cityName required' }, { status: 400 })
  }

  const requestedCityId = cityId ? Number(cityId) : null

  // ✅ Ако in-memory кешът е свеж, филтрираме от него — без нова Econt заявка.
  if (officesMemCache && Date.now() - officesMemCache.savedAt < OFFICES_TTL_MS) {
    const offices = filterAndShape(officesMemCache.raw, requestedCityId)
    return NextResponse.json({ offices, count: offices.length }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })
  }

  const auth = Buffer.from(`${ECONT_USER}:${ECONT_PASS}`).toString('base64')
  const url  = `${ECONT_API}/NomenclaturesService.getOffices.json`
  const body: any = { countryCode: 'BGR' }

  try {
    const result = await fetchOfficesWithRetry(url, auth, body)

    if (!result) {
      console.error(`[econt/offices] Всички retry опити неуспешни — заявен cityId=${cityId}`)
      if (officesMemCache) {
        console.warn('[econt/offices] Връщам stale in-memory кеш като fallback.')
        const offices = filterAndShape(officesMemCache.raw, requestedCityId)
        return NextResponse.json({ offices, count: offices.length })
      }
      return NextResponse.json({ error: 'Econt API unreachable after retries' }, { status: 502 })
    }

    const { res, rawText } = result

    if (!res.ok) {
      console.error(`[econt/offices] HTTP ${res.status} след retry-и:`, rawText.slice(0, 500))
      if (officesMemCache) {
        const offices = filterAndShape(officesMemCache.raw, requestedCityId)
        return NextResponse.json({ offices, count: offices.length })
      }
      return NextResponse.json({ error: `Econt API returned ${res.status}` }, { status: 502 })
    }

    let data: any
    try {
      data = JSON.parse(rawText)
    } catch {
      console.error(
        `[econt/offices] Non-JSON body след retry-и. length=${rawText.length} ` +
        `start="${rawText.slice(0, 200)}" end="${rawText.slice(-200)}"`
      )
      if (officesMemCache) {
        const offices = filterAndShape(officesMemCache.raw, requestedCityId)
        return NextResponse.json({ offices, count: offices.length })
      }
      return NextResponse.json({ error: 'Non-JSON from Econt' }, { status: 502 })
    }

    const raw: any[] = Array.isArray(data) ? data : (data.offices || data.Offices || [])

    if (raw.length === 0) {
      console.warn('[econt/offices] Bulk отговорът върна 0 офиса общо — проверете Econt credentials/API.')
      return NextResponse.json({ offices: [], count: 0 }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
      })
    }

    // ✅ Кешираме СУРОВИЯ масив в паметта (не преминава през Next.js data cache)
    officesMemCache = { raw, savedAt: Date.now() }

    const offices = filterAndShape(raw, requestedCityId)

    if (offices.length === 0 && requestedCityId) {
      console.warn(
        `[econt/offices] 0 офиса съвпаднаха с cityId=${requestedCityId} (cityName=${cityName}) ` +
        `сред общо ${raw.length} офиса в bulk отговора.`
      )
    }

    return NextResponse.json({ offices, count: offices.length }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    })

  } catch (e: any) {
    console.error('[econt/offices] fetch error:', e.message)
    if (officesMemCache) {
      const offices = filterAndShape(officesMemCache.raw, requestedCityId)
      return NextResponse.json({ offices, count: offices.length })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
