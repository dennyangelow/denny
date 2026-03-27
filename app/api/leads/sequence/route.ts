// app/api/leads/sequence/route.ts — Email sequence processor (Vercel Cron)
// Добави в vercel.json:
// { "crons": [{ "path": "/api/leads/sequence", "schedule": "0 * * * *" }] }

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import {
  followUp2Email,
  followUp5Email,
  followUp10Email,
} from '@/lib/email-templates'

// Защита — само Vercel Cron или admin може да извика
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // dev mode
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY не е настроен' }, { status: 500 })
  }

  const resend = new Resend(apiKey)
  const now    = new Date()
  let sent     = 0
  const errors: string[] = []

  try {
    // Вземаме активните sequence стъпки
    const { data: steps } = await supabaseAdmin
      .from('email_sequence_steps')
      .select('*')
      .eq('active', true)
      .eq('sequence_name', 'naruchnik')
      .order('step_number')

    if (!steps || steps.length === 0) {
      return NextResponse.json({ sent: 0, message: 'Няма активни стъпки' })
    }

    // За всяка стъпка (без welcome — тя се изпраща веднага)
    for (const step of steps.filter(s => s.step_number > 1)) {
      // Намираме leads, които трябва да получат тази стъпка
      const targetDate = new Date(now.getTime() - step.delay_days * 86400000)
      const from = new Date(targetDate.getTime() - 3600000).toISOString() // ±1 час прозорец
      const to   = new Date(targetDate.getTime() + 3600000).toISOString()

      // Leads, регистрирани в прозореца, subscribed, и не са получили тази стъпка
      const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('id, email, name, naruchnik_slug')
        .eq('subscribed', true)
        .gte('downloaded_at', from)
        .lte('downloaded_at', to)

      if (!leads || leads.length === 0) continue

      // Изключи тези, които вече са получили тази стъпка
      const leadIds = leads.map(l => l.id)
      const { data: sentLogs } = await supabaseAdmin
        .from('email_logs')
        .select('lead_id')
        .eq('sequence_name', 'naruchnik')
        .eq('step_number', step.step_number)
        .in('lead_id', leadIds)

      const alreadySentIds = new Set((sentLogs || []).map(l => l.lead_id))
      const toSend = leads.filter(l => !alreadySentIds.has(l.id))

      for (const lead of toSend) {
        try {
          let emailData: { subject: string; html: string } | null = null

          if (step.template === 'followup_2') {
            emailData = followUp2Email({ email: lead.email, name: lead.name || undefined, slug: lead.naruchnik_slug || 'super-domati' })
          } else if (step.template === 'followup_5') {
            emailData = followUp5Email({ email: lead.email, name: lead.name || undefined })
          } else if (step.template === 'followup_10') {
            emailData = followUp10Email({ email: lead.email, name: lead.name || undefined })
          }

          if (!emailData) continue

          await resend.emails.send({
            from: 'Denny Angelow <denny@dennyangelow.com>',
            to: lead.email,
            subject: emailData.subject,
            html: emailData.html,
          })

          // Записваме в log
          await supabaseAdmin.from('email_logs').insert({
            lead_id:       lead.id,
            sequence_name: 'naruchnik',
            step_number:   step.step_number,
            sent_at:       now.toISOString(),
          })

          // Update lead
          await supabaseAdmin.from('leads').update({
            last_email_sent_at: now.toISOString(),
          }).eq('id', lead.id)

          sent++

          // Малка пауза за да не hit-ваме rate limit
          await new Promise(r => setTimeout(r, 100))
        } catch (e: any) {
          errors.push(`${lead.email}: ${e.message}`)
        }
      }
    }

    // Abandoned order check — поръчки "new" > 24 часа без обработка
    const abandonedCutoff = new Date(now.getTime() - 24 * 3600000).toISOString()
    const { data: abandonedOrders } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, customer_email, customer_name')
      .eq('status', 'new')
      .lt('created_at', abandonedCutoff)
      .not('customer_email', 'is', null)

    for (const order of (abandonedOrders || [])) {
      if (!order.customer_email) continue

      // Проверяваме дали вече сме изпратили
      const { data: alreadySent } = await supabaseAdmin
        .from('email_logs')
        .select('id')
        .eq('sequence_name', 'abandoned_order')
        .eq('step_number', 1)
        .eq('lead_id', order.id)
        .maybeSingle()

      if (alreadySent) continue

      try {
        await resend.emails.send({
          from: 'Denny Angelow <denny@dennyangelow.com>',
          to: order.customer_email,
          subject: `⚠️ Поръчка ${order.order_number} чака потвърждение`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
              <div style="background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:24px;border-radius:12px 12px 0 0;text-align:center">
                <p style="font-size:30px;margin:0">📦</p>
                <h1 style="color:#fff;font-size:18px;margin:8px 0 0">Имаш ли въпроси за поръчката?</h1>
              </div>
              <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
                <p>Здравей${order.customer_name ? `, <strong>${order.customer_name}</strong>` : ''}!</p>
                <p>Поръчката ти <strong>${order.order_number}</strong> е при нас, но все още чака обработка.</p>
                <p>Ако имаш въпроси или искаш да промениш нещо — пиши ни директно.</p>
                <div style="text-align:center;margin:20px 0">
                  <a href="mailto:support@dennyangelow.com" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700">
                    Свържи се с нас →
                  </a>
                </div>
              </div>
            </div>
          `,
        })
        sent++
      } catch (e: any) {
        errors.push(`Abandoned ${order.order_number}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    })
  } catch (err: any) {
    console.error('Sequence error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
