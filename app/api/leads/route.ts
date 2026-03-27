// app/api/leads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, name, source, utm_source, utm_campaign, naruchnik_slug } = body

    // По-строга валидация
    if (!email || !email.includes('@') || email.length < 5) {
      return NextResponse.json({ error: 'Моля, въведете валиден имейл адрес' }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()

    // 1. Използваме upsert за запис/обновяване
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .upsert(
        {
          email: cleanEmail,
          name: name?.trim() || null,
          source: source || 'naruchnik',
          naruchnik_slug: naruchnik_slug || 'super-domati',
          utm_source: utm_source || null,
          utm_campaign: utm_campaign || null,
          downloaded_at: new Date().toISOString(),
          subscribed: true // При повторно записване, ако се е отписал, го записваме пак
        },
        { onConflict: 'email' }
      )
      .select()
      .single()

    if (error) throw error

    // 2. Изпращаме имейла асинхронно
    // Използваме try/catch тук, за да не върнем грешка на потребителя, ако само имейлът се провали
    try {
      if (process.env.RESEND_API_KEY) {
        await sendWelcomeEmail(cleanEmail, name, naruchnik_slug)
      }
    } catch (mailErr) {
      console.error('Грешка при изпращане на Welcome Email:', mailErr)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Lead error:', error)
    return NextResponse.json({ error: 'Възникна техническа грешка. Опитайте пак.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    // ТУК Е ДОБРЕ ДА ИМА ПРОВЕРКА ЗА АДМИН (Auth)
    // Ако нямаш auth система още, поне сложи лимит или таен ключ
    
    const { searchParams } = new URL(req.url)
    const page  = parseInt(searchParams.get('page')  || '1')
    const limit = parseInt(searchParams.get('limit') || '500')

    const { data, error, count } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (error) throw error

    return NextResponse.json({ leads: data, total: count })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function sendWelcomeEmail(email: string, name?: string, slug?: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const resend = new Resend(apiKey)
  const greeting = name ? `Здравей, ${name}!` : 'Здравей!'
  const targetSlug = slug || 'super-domati'
  
  // Правилен линк към твоя сайт
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com'
  const downloadUrl = `${siteUrl}/naruchnik/${targetSlug}`
  const unsubscribeUrl = `${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}`

  await resend.emails.send({
    from: 'Denny Angelow <denny@dennyangelow.com>',
    to: email,
    subject: '📗 Твоят наръчник е тук!',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;line-height:1.6">
        <div style="text-align:center;padding:20px">
          <span style="font-size:40px">📗</span>
        </div>
        <h2 style="color:#2d6a4f;text-align:center">${greeting}</h2>
        <p>Радвам се, че реши да изтеглиш наръчника! Вярвам, че ще ти бъде полезен за твоята градина.</p>
        <div style="margin:30px 0;text-align:center">
          <a href="${downloadUrl}" 
             style="background:#2d6a4f;color:#fff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;box-shadow:0 4px 6px rgba(45,106,79,0.2)">
             Изтегли наръчника тук →
          </a>
        </div>
        <p style="font-size:14px;color:#666">Ако бутонът не работи, копирай този линк: <br> ${downloadUrl}</p>
        <footer style="margin-top:50px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center">
          © ${new Date().getFullYear()} Denny Angelow. Всички права запазени.<br>
          <a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline">Отписване от бюлетина</a>
        </footer>
      </div>
    `,
  })
}