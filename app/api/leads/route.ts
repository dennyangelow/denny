// app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, name, source, utm_source, utm_campaign, naruchnik_slug } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Невалиден имейл' }, { status: 400 })
    }

    // Записваме или обновяваме леада в базата
    const { error } = await supabaseAdmin
      .from('leads')
      .upsert(
        {
          email: email.toLowerCase().trim(),
          name,
          source: source || 'naruchnik',
          naruchnik_slug: naruchnik_slug || 'super-domati',
          utm_source,
          utm_campaign,
          downloaded_at: new Date().toISOString(),
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )

    if (error && error.code !== '23505') throw error

    // Изпращаме имейла (инициализираме Resend вътре в самата функция)
    await sendWelcomeEmail(email, name, naruchnik_slug).catch(console.error)

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

async function sendWelcomeEmail(email: string, name?: string, slug?: string) {
  // 1. Проверка за API ключ - предотвратява грешки при Build/Deploy
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('Пропускане на имейл: RESEND_API_KEY не е зададен.')
    return
  }

  // 2. Инициализиране на клиента тук
  const resend = new Resend(apiKey)

  const greeting = name ? `Здравей, ${name}!` : 'Здравей!'
  const targetSlug = slug || 'super-domati'
  const downloadUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/naruchnik/${targetSlug}`

  // 3. Изпращане
  await resend.emails.send({
    from: 'Denny Angelow <denny@dennyangelow.com>',
    to: email,
    subject: '📗 Твоят наръчник е тук!',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;background:#fff;padding:20px;border:1px solid #eee;border-radius:12px">
        <h2 style="color:#2d6a4f">${greeting}</h2>
        <p>Благодарим ти за интереса! Твоят безплатен наръчник е готов за сваляне.</p>
        <div style="margin:30px 0;text-align:center">
          <a href="${downloadUrl}" 
             style="background:#2d6a4f;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
             Към страницата за сваляне →
          </a>
        </div>
        <p style="font-size:12px;color:#999;margin-top:40px;border-top:1px solid #eee;padding-top:20px">
          Ако не желаеш да получаваш повече имейли, можеш да се 
          <a href="${process.env.NEXT_PUBLIC_SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color:#999">отпишеш тук</a>.
        </p>
      </div>
    `,
  })
}