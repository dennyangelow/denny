// app/api/leads/route.ts — v2 с rate limiting
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import { rateLimit, getIP } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limit: 5 регистрации от един IP за 10 минути
  const ip = getIP(req)
  const rl = rateLimit(`leads:${ip}`, { limit: 5, window: 600 })
  if (!rl.success) {
    return NextResponse.json(
      { error: `Твърде много заявки. Изчакай ${rl.resetIn} секунди.` },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  try {
    const body = await req.json()
    const { email, name, phone, source, utm_source, utm_campaign, naruchnik_slug } = body

    if (!email || !email.includes('@') || email.length > 255) {
      return NextResponse.json({ error: 'Невалиден имейл' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('leads')
      .upsert(
        {
          email: email.toLowerCase().trim(),
          name: name?.trim() || null,
          phone: phone?.trim() || null,
          source: source || 'naruchnik',
          naruchnik_slug: naruchnik_slug || 'super-domati',
          utm_source: utm_source || null,
          utm_campaign: utm_campaign || null,
          downloaded_at: new Date().toISOString(),
          subscribed: true,
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )

    if (error && error.code !== '23505') throw error

    await sendWelcomeEmail(email.trim(), name?.trim(), naruchnik_slug).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Lead error:', error)
    return NextResponse.json({ error: 'Грешка. Моля опитай отново.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit = Math.min(1000, parseInt(searchParams.get('limit') || '500'))

  const { data, error, count } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data, total: count })
}

async function sendWelcomeEmail(email: string, name?: string, slug?: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const resend = new Resend(apiKey)
  const greeting = name ? `Здравей, ${name}!` : 'Здравей!'
  const targetSlug = slug || 'super-domati'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com'
  const downloadUrl = `${siteUrl}/naruchnik/${targetSlug}`

  await resend.emails.send({
    from: 'Denny Angelow <denny@dennyangelow.com>',
    to: email,
    subject: '📗 Твоят наръчник е тук!',
    html: `
      <div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;background:#fff">
        <div style="background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:36px;text-align:center;border-radius:12px 12px 0 0">
          <p style="font-size:40px;margin:0 0 8px">🍅</p>
          <h1 style="color:#fff;font-size:22px;margin:0 0 6px">${greeting}</h1>
          <p style="color:rgba(255,255,255,.75);font-size:14px;margin:0">Наръчникът ти е готов за сваляне</p>
        </div>
        <div style="padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <p style="font-size:15px;margin:0 0 20px">Благодарим ти! Сега можеш да изтеглиш наръчника и да започнеш да прилагаш съветите.</p>
          <div style="text-align:center;margin:28px 0">
            <a href="${downloadUrl}"
               style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:16px 36px;border-radius:12px;text-decoration:none;font-weight:900;font-size:16px;display:inline-block">
               📥 Изтегли наръчника →
            </a>
          </div>
          <p style="font-size:13px;color:#6b7280;margin:24px 0 0">
            Очаквай от нас полезни агро съвети и специални оферти. 🌱
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
          <p style="font-size:12px;color:#9ca3af;margin:0">
            Не желаеш повече имейли?
            <a href="${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}" style="color:#9ca3af">Отпиши се тук</a>.
          </p>
        </div>
      </div>
    `,
  })
}
