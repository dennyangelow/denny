// app/api/site-data/route.ts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const [
      settingsRes,
      atlasRes,
      affiliateRes,
      categoryRes,
      testimonialsRes,
      faqRes,
    ] = await Promise.all([
      supabase.from('settings').select('key, value'),
      supabase.from('products').select('*').eq('active', true).order('sort_order'),
      supabase.from('affiliate_products').select('*').eq('active', true).order('sort_order'),
      supabase.from('category_links').select('*').eq('active', true).order('sort_order'),
      supabase.from('testimonials').select('*').eq('active', true).order('sort_order'),
      supabase.from('faq').select('*').eq('active', true).order('sort_order'),
    ])

    return NextResponse.json({
      settings:          settingsRes.data     || [],
      atlasProducts:     atlasRes.data        || [],
      affiliateProducts: affiliateRes.data    || [],
      categoryLinks:     categoryRes.data     || [],
      testimonials:      testimonialsRes.data || [],
      faq:               faqRes.data          || [],
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      }
    })
  } catch (err) {
    console.error('site-data error:', err)
    return NextResponse.json({
      settings: [], atlasProducts: [], affiliateProducts: [],
      categoryLinks: [], testimonials: [], faq: [],
    }, { status: 500 })
  }
}
