// app/api/analytics/affiliate-click/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { partner, product_slug } = body

    if (!partner) return NextResponse.json({ success: false }, { status: 400 })

    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0].trim() || 'unknown'
    const userAgent = req.headers.get('user-agent')

    // Записваме клика в базата
    const { error } = await supabaseAdmin.from('affiliate_clicks').insert({
      partner,
      product_slug: product_slug || null,
      ip_address: ip,
      user_agent: userAgent,
      referrer: req.headers.get('referer'),
    })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Click tracking error:', err.message)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

export async function GET() {
  try {
    const last30daysDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // 1. Вземаме само суровата статистика чрез по-бърза заявка
    const { data, error } = await supabaseAdmin
      .from('affiliate_clicks')
      .select('partner, product_slug, created_at')
      .order('created_at', { ascending: false })
      .limit(5000) // Увеличаваме лимита, но оптимизираме обработката

    if (error) throw error

    const byPartner: Record<string, number> = {}
    const byProduct: Record<string, number> = {}
    let last30daysCount = 0

    if (data) {
      for (const click of data) {
        // Броим партньорите
        byPartner[click.partner] = (byPartner[click.partner] || 0) + 1
        
        // Броим продуктите
        if (click.product_slug) {
          byProduct[click.product_slug] = (byProduct[click.product_slug] || 0) + 1
        }

        // Броим последните 30 дни
        if (click.created_at > last30daysDate) {
          last30daysCount++
        }
      }
    }

    return NextResponse.json({
      total: data?.length || 0,
      last30days: last30daysCount,
      byPartner,
      byProduct,
      lastUpdate: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}