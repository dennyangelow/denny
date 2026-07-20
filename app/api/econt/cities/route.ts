// app/api/econt/cities/route.ts
// Само чете градове от Еконт — НЕ създава товарителници или пратки!
//
// ✅ v3 — НАМЕРИХМЕ РЕАЛНАТА ПРИЧИНА за periodic "празен JSON" бъга:
//   Failed to set Next.js data cache, items over 2MB can not be cached (6871182 bytes)
// Отговорът от Econt за всички градове е ~6.9MB — над твърдия 2MB лимит на
// Next.js-кия вграден fetch cache (`next: { revalidate }`). Докато Next.js
// вътрешно се опитва (и се проваля) да кешира толкова голям отговор, четенето
// на тялото на СЪЩИЯ отговор понякога се прекъсва → празен rawText → "Non-JSON
// from Econt" — точно грешката, която виждахме на случаен принцип.
//
// Решение: спираме да минаваме през вградения Next.js fetch cache изобщо за
// тази заявка (`cache: 'no-store'`), и пазим САМИ филтрирания/малкия резултат
// в обикновена module-level променлива (in-memory cache) с TTL. Малкият
// филтриран масив тежи много под 2MB, така че никакъв кеш проблем не възниква.

import { NextResponse } from 'next/server'

const ECONT_USER = process.env.ECONT_USER || 'iasp-dev'
const ECONT_PASS = process.env.ECONT_PASS || '1Asp-dev'
const IS_DEMO    = !process.env.ECONT_USER || process.env.ECONT_ENV === 'demo'
const ECONT_API  = IS_DEMO
  ? 'https://demo.econt.com/ee/services/Nomenclatures'
  : 'https://ee.econt.com/services/Nomenclatures'

// ── In-memory кеш (сървърен процес) — пазим само филтрирания малък резултат,
// НЕ суровия 6-7MB blob от Econt. Изчиства се при рестарт на dev сървъра/
// нов deploy — това е ОК, защото първата заявка просто ще опресни кеша.
type EcontCityOut = { id: number; name: string; postCode: string; regionName: string }
let citiesMemCache: { data: EcontCityOut[]; savedAt: number } | null = null
const CITIES_TTL_MS = 6 * 60 * 60 * 1000 // 6 часа

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// Retry + timeout + JSON-валидация — пазим си я, полезна е и без Next cache,
// защото Econt endpoint-ите понякога имат и истински мрежови hiccup-и.
async function fetchCitiesWithRetry(
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
        // ✅ КЛЮЧОВА ПРОМЯНА: НЕ минаваме през Next.js data cache тук — той
        // има твърд лимит от 2MB, а Econt отговорът е ~7MB. `no-store` кара
        // Next.js да третира тази заявка като обикновен fetch, без опит за
        // кеширане, което премахва причината за периодичните празни body-та.
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
          console.warn(`[econt/cities] attempt ${attempt}/${maxAttempts}: HTTP 200 но невалиден/празен JSON (length=${rawText.length}), retry-вам...`)
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

export async function GET() {
  // ✅ Първо проверяваме in-memory кеша — ако е свеж, връщаме веднага без
  // изобщо да питаме Econt.
  if (citiesMemCache && Date.now() - citiesMemCache.savedAt < CITIES_TTL_MS) {
    return NextResponse.json(
      { cities: citiesMemCache.data, count: citiesMemCache.data.length },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } }
    )
  }

  const auth = Buffer.from(`${ECONT_USER}:${ECONT_PASS}`).toString('base64')
  const url  = `${ECONT_API}/NomenclaturesService.getCities.json`

  try {
    const result = await fetchCitiesWithRetry(url, auth, { countryCode: 'BGR' })

    if (!result) {
      console.error('[econt/cities] Всички retry опити неуспешни (мрежова грешка или празен отговор)')
      // ✅ Ако имаме СТАР (изтекъл, но не изтрит) кеш, по-добре да върнем него,
      // отколкото твърда грешка на потребителя.
      if (citiesMemCache) {
        console.warn('[econt/cities] Връщам stale in-memory кеш като fallback.')
        return NextResponse.json({ cities: citiesMemCache.data, count: citiesMemCache.data.length })
      }
      return NextResponse.json({ error: 'Econt API unreachable after retries', using_demo: IS_DEMO }, { status: 502 })
    }

    const { res, rawText } = result

    if (!res.ok) {
      console.error(`[econt/cities] HTTP ${res.status} след retry-и:`, rawText.slice(0, 500))
      if (citiesMemCache) return NextResponse.json({ cities: citiesMemCache.data, count: citiesMemCache.data.length })
      return NextResponse.json({
        error: `Econt API returned ${res.status}`,
        detail: rawText.slice(0, 300),
        using_demo: IS_DEMO,
      }, { status: 502 })
    }

    let data: any
    try {
      data = JSON.parse(rawText)
    } catch {
      console.error(`[econt/cities] Non-JSON body след retry-и. length=${rawText.length} raw="${rawText.slice(0, 300)}"`)
      if (citiesMemCache) return NextResponse.json({ cities: citiesMemCache.data, count: citiesMemCache.data.length })
      return NextResponse.json({ error: 'Econt returned non-JSON', raw: rawText.slice(0, 300) }, { status: 502 })
    }

    const raw: any[] = Array.isArray(data) ? data : (data.cities || data.Cities || [])

    if (raw.length === 0) {
      console.warn('[econt/cities] Empty result, keys:', Object.keys(data))
      if (citiesMemCache) return NextResponse.json({ cities: citiesMemCache.data, count: citiesMemCache.data.length })
      return NextResponse.json({
        error: 'No cities returned',
        keys: Object.keys(data),
        using_demo: IS_DEMO,
      }, { status: 502 })
    }

    const cities: EcontCityOut[] = raw
      .filter((c: any) => {
        const code = c.country?.code3 || c.country?.code2 || c.countryCode || ''
        return code === 'BGR' || code === 'BG' || code === ''
      })
      .filter((c: any) => c.name && /^[\u0400-\u04FF\s\-\.()0-9]+$/.test(c.name))
      .map((c: any) => ({
        id:         c.id,
        name:       c.name,
        postCode:   c.postCode || c.post_code || '',
        regionName: c.regionName || c.region || '',
      }))
      .filter((c: any) => c.id && c.name)
      .sort((a: any, b: any) => {
        const byName = a.name.localeCompare(b.name, 'bg')
        if (byName !== 0) return byName
        return String(a.postCode).localeCompare(String(b.postCode))
      })

    // ✅ Пазим само малкия филтриран резултат — типично неколкостотин KB, спокойно
    citiesMemCache = { data: cities, savedAt: Date.now() }

    return NextResponse.json({ cities, count: cities.length }, {
      headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' },
    })

  } catch (e: any) {
    console.error('[econt/cities] fetch error:', e.message)
    if (citiesMemCache) return NextResponse.json({ cities: citiesMemCache.data, count: citiesMemCache.data.length })
    return NextResponse.json({ error: e.message, using_demo: IS_DEMO }, { status: 500 })
  }
}
