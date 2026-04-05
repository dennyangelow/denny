// app/api/econt/cities/route.ts
import { NextResponse } from 'next/server'

const ECONT_USER = process.env.ECONT_USER || 'iasp-dev'
const ECONT_PASS = process.env.ECONT_PASS || '1Asp-dev'
const IS_DEMO    = process.env.ECONT_ENV === 'demo' || (!process.env.ECONT_USER)
const ECONT_API  = IS_DEMO
  ? 'https://demo.econt.com/ee/services/Nomenclatures'
  : 'https://ee.econt.com/services/Nomenclatures'

// ISR: Next.js кешира отговора на сървъра за 6 часа
// CDN (Vercel/Cloudflare) кешира допълнително чрез Cache-Control header
export const revalidate = 21600 // 6 часа

export async function GET() {
  const auth = Buffer.from(`${ECONT_USER}:${ECONT_PASS}`).toString('base64')
  const url  = `${ECONT_API}/NomenclaturesService.getCities.json`

  let rawText = ''
  let statusCode = 0

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({}),
      // force-cache: Next.js кешира fetch резултата между revalidations
      next: { revalidate: 21600 },
    })

    statusCode = res.status
    rawText = await res.text()

    if (!res.ok) {
      console.error(`[econt/cities] HTTP ${statusCode}:`, rawText.slice(0, 500))
      return NextResponse.json({
        error: `Econt API returned ${statusCode}`,
        detail: rawText.slice(0, 500),
        url,
        using_demo: IS_DEMO,
      }, { status: 502 })
    }

    let data: any
    try {
      data = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ error: 'Econt returned non-JSON', raw: rawText.slice(0, 500) }, { status: 502 })
    }

    const raw = Array.isArray(data) ? data : (data.cities || data.Cities || [])

    if (raw.length === 0) {
      console.warn('[econt/cities] Empty result, keys:', Object.keys(data))
      return NextResponse.json({ error: 'No cities returned', keys: Object.keys(data), sample: rawText.slice(0, 300) }, { status: 502 })
    }

    const cities = raw
      .filter((c: any) => {
        const code = c.country?.code3 || c.country?.code2 || c.countryCode || ''
        return code === 'BGR' || code === 'BG' || code === ''
      })
      // Допълнителен филтър — само кирилски имена (без гръцки, румънски и др.)
      .filter((c: any) => c.name && /^[\u0400-\u04FF\s\-\.()0-9]+$/.test(c.name))
      .map((c: any) => ({
        id:         c.id,
        name:       c.name,
        postCode:   c.postCode || c.post_code || '',
        regionName: c.regionName || c.region || '',
      }))
      .filter((c: any) => c.id && c.name)
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg'))

    return NextResponse.json({ cities, count: cities.length }, {
      headers: {
        // CDN кешира за 6 часа, stale-while-revalidate за още 24
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
      },
    })

  } catch (e: any) {
    console.error('[econt/cities] fetch error:', e.message)
    return NextResponse.json({
      error: e.message,
      url,
      using_demo: IS_DEMO,
    }, { status: 500 })
  }
}
