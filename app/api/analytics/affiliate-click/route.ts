import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { partner, product_slug } = await req.json()

    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded?.split(',')[0] || 'unknown'

    await supabaseAdmin.from('affiliate_clicks').insert({
      partner,
      product_slug,
      ip_address: ip,
      user_agent: req.headers.get('user-agent'),
      referrer: req.headers.get('referer'),
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false })
  }
}

export async function GET(req: NextRequest) {
  const { data } = await supabaseAdmin
    .from('affiliate_clicks')
    .select('partner, product_slug, created_at')
    .order('created_at', { ascending: false })
    .limit(1000)

  // Aggregate by partner
  const byPartner: Record<string, number> = {}
  const byProduct: Record<string, number> = {}
  const last30days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  data?.forEach(click => {
    byPartner[click.partner] = (byPartner[click.partner] || 0) + 1
    if (click.product_slug) {
      byProduct[click.product_slug] = (byProduct[click.product_slug] || 0) + 1
    }
  })

  const recent = data?.filter(c => new Date(c.created_at) > last30days).length || 0

  return NextResponse.json({
    total: data?.length || 0,
    last30days: recent,
    byPartner,
    byProduct,
  })
}
