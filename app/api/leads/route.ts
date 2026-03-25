// app/api/leads/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { email, name, source, utm_source, utm_campaign } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Невалиден имейл' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('leads')
      .upsert(
        {
          email: email.toLowerCase().trim(),
          name,
          source: source || 'naruchnik',
          utm_source,
          utm_campaign,
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error && error.code !== '23505') throw error

    await sendWelcomeEmail(email, name).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Lead error:', error)
    return NextResponse.json({ error: 'Грешка. Моля опитай отново.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page  = parseInt(searchParams.get('page')  || '1')
  const limit = parseInt(searchParams.get('limit') || '500')

  const { data, error, count } = await supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ leads: data, total: count })
}

async function sendWelcomeEmail(email: string, name?: string) {
  if (!process.env.RESEND_API_KEY) return
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  const greeting = name ? `Здравей, ${name}!` : 'Здравей!'

  await resend.emails.send({
    from: 'Denny Angelow <denny@dennyangelow.com>',
    to: email,
    subject: '📗 Твоят наръчник "Тайните на Едрите Домати" е тук!',
    html: `
      <div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <div style="background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:40px;border-radius:16px 16px 0 0;text-align:center">
          <h1 style="color:#fff;font-size:26px;margin:0">🍅 Наръчникът е тук!</h1>
          <p style="color:rgba(255,255,255,.75);margin:10px 0 0;font-size:14px">"Тайните на Едрите и Вкусни Домати"</p>
        </div>
        <div style="padding:40px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px">
          <p style="font-size:17px">${greeting}</p>
          <p style="color:#6b7280">Радвам се, че се присъедини! Ето твоят безплатен наръчник:</p>
          <div style="text-align:center;margin:32px 0">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/naruchnik-super-domati"
               style="background:#2d6a4f;color:#fff;padding:16px 32px;border-radius:10px;text-decoration:none;font-size:16px;font-weight:600;display:inline-block">
              📗 Изтегли Наръчника →
            </a>
          </div>
          <p style="font-size:14px;color:#374151">Вътре ще намериш:</p>
          <ul style="line-height:2.2;font-size:14px;color:#374151">
            <li>✓ Как да предпазиш от болести и вредители</li>
            <li>✓ Кои торове работят наистина</li>
            <li>✓ Календар за третиране</li>
            <li>✓ Грешките, които убиват реколтата</li>
          </ul>
          <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:20px">
            Въпроси? <a href="mailto:support@dennyangelow.com" style="color:#2d6a4f">support@dennyangelow.com</a> ·
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color:#9ca3af">Отпиши се</a>
          </p>
        </div>
      </div>
    `,
  })
}
