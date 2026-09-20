// app/api/webhooks/ses/route.ts
//
// Приема POST заявки от SNS (топик "ses-events"), свързан с SES
// Configuration Set-а "my-first-configuration-set".
//
// Два вида заявки идват от SNS:
//   1. SubscriptionConfirmation — еднократно, при първо свързване на
//      топика с този endpoint. Трябва да "посетим" SubscribeURL-а, за
//      да потвърдим, че наистина искаме да получаваме съобщения тук.
//   2. Notification — реално събитие (delivery/bounce/complaint/open/
//      click), пратено всеки път когато се случи с изпратен имейл.
//
// Защита: няма admin token тук (SNS не носи cookie), но SNS съобщенията
// са криптографски подписани — за MVP разчитаме на "security through
// obscurity" на случайния URL path; при желание по-късно може да се
// добави пълна проверка на подписа (виж AWS SNS message verification).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface SESMailObject {
  destination: string[]
  messageId: string
}

interface SESEvent {
  eventType: 'Send' | 'Delivery' | 'Bounce' | 'Complaint' | 'Open' | 'Click' | string
  mail: SESMailObject
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Невалиден JSON' }, { status: 400 })
  }

  const messageType = req.headers.get('x-amz-sns-message-type')

  // ── 1. Еднократно потвърждение на абонамента ──────────────────────────────
  if (messageType === 'SubscriptionConfirmation') {
    const subscribeUrl = body.SubscribeUrl
    if (subscribeUrl) {
      try {
        await fetch(subscribeUrl)
        console.info('[ses-webhook] SNS subscription потвърден автоматично')
      } catch (e) {
        console.error('[ses-webhook] Грешка при потвърждаване на subscription:', e)
      }
    }
    return NextResponse.json({ success: true, confirmed: true })
  }

  // ── 2. Реално събитие ──────────────────────────────────────────────────────
  if (messageType === 'Notification') {
    let event: SESEvent
    try {
      event = JSON.parse(body.Message)
    } catch {
      return NextResponse.json({ error: 'Невалиден Message формат' }, { status: 400 })
    }

    const recipients = event.mail?.destination || []
    const now = new Date().toISOString()

    for (const email of recipients) {
      const cleanEmail = email.toLowerCase().trim()

      try {
        if (event.eventType === 'Bounce' || event.eventType === 'Complaint') {
          // ── Критично: спираме всякакво бъдещо изпращане към този адрес ──
          await supabaseAdmin
            .from('leads')
            .update({
              subscribed: false,
              unsubscribe_reason: event.eventType === 'Bounce' ? 'hard_bounce' : 'spam_complaint',
              updated_at: now,
            })
            .eq('email', cleanEmail)

          console.info(`[ses-webhook] ${event.eventType} за ${cleanEmail} — маркиран unsubscribed`)
        }

        if (event.eventType === 'Open' || event.eventType === 'Click') {
          // Намираме lead-а по email, после последния му email_logs запис
          const { data: lead } = await supabaseAdmin
            .from('leads')
            .select('id')
            .eq('email', cleanEmail)
            .single()

          if (lead) {
            const { data: lastLog } = await supabaseAdmin
              .from('email_logs')
              .select('id')
              .eq('lead_id', lead.id)
              .order('sent_at', { ascending: false })
              .limit(1)
              .single()

            if (lastLog) {
              const field = event.eventType === 'Open' ? 'opened_at' : 'clicked_at'
              await supabaseAdmin
                .from('email_logs')
                .update({ [field]: now })
                .eq('id', lastLog.id)
            }
          }
        }
        // 'Delivery' събитието само се логва — не изисква промяна в базата,
        // но е полезно за общата статистика (виж console.info по-долу).

        console.info(`[ses-webhook] ${event.eventType} за ${cleanEmail}`)
      } catch (e) {
        console.error(`[ses-webhook] Грешка при обработка на ${cleanEmail}:`, e)
      }
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ success: true, ignored: true })
}
