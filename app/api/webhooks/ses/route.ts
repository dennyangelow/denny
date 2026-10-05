// app/api/webhooks/ses/route.ts — v2
//
// Приема POST заявки от SNS (топик "ses-events"), свързан с SES
// Configuration Set-а "my-first-configuration-set".
//
// ✅ v2 — СИГУРНОСТ (v1 нямаше никаква проверка):
//   1. Подписът на всяко SNS съобщение се проверява с публичния сертификат на
//      Amazon (SigningCertURL се приема САМО от sns.<region>.amazonaws.com през
//      https). Без валиден подпис → 403. Преди това всеки в интернет можеше да
//      прати фалшиво "Bounce"/"Complaint" и да отпише всички твои leads, или да
//      накара сървъра да отвори произволен адрес чрез SubscribeURL (SSRF).
//   2. SubscribeURL се отваря само ако е https към sns.<region>.amazonaws.com.
//   3. По желание (препоръчително): задай SNS_TOPIC_ARN в Vercel → съобщения от
//      друг топик се отхвърлят.
//   4. Bounce отписва САМО при Permanent bounce (временен — пълна кутия и т.н. —
//      вече не отписва завинаги), и само реално засегнатите получатели
//      (bouncedRecipients / complainedRecipients), не всички от mail.destination.
//
// Два вида заявки идват от SNS:
//   1. SubscriptionConfirmation — еднократно, при първо свързване на топика.
//   2. Notification — реално събитие (delivery/bounce/complaint/open/click).

import { NextRequest, NextResponse } from 'next/server'
import { createVerify } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs' // нужен е node:crypto

// ─── Проверка на SNS подпис ──────────────────────────────────────────────────
const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/i
const certCache = new Map<string, string>()

function safeSnsUrl(raw: unknown, mustEndWith?: string): URL | null {
  if (typeof raw !== 'string') return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' || u.port) return null
    if (!SNS_HOST.test(u.hostname)) return null
    if (mustEndWith && !u.pathname.endsWith(mustEndWith)) return null
    return u
  } catch {
    return null
  }
}

function buildStringToSign(m: Record<string, any>): string | null {
  let keys: string[]
  if (m.Type === 'Notification') {
    keys = ['Message', 'MessageId']
    if (typeof m.Subject === 'string') keys.push('Subject')
    keys.push('Timestamp', 'TopicArn', 'Type')
  } else if (m.Type === 'SubscriptionConfirmation' || m.Type === 'UnsubscribeConfirmation') {
    keys = ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
  } else {
    return null
  }
  let out = ''
  for (const k of keys) {
    if (typeof m[k] !== 'string') return null
    out += `${k}\n${m[k]}\n`
  }
  return out
}

async function verifySnsSignature(m: Record<string, any>): Promise<boolean> {
  try {
    if (m.SignatureVersion !== '1' && m.SignatureVersion !== '2') return false
    if (typeof m.Signature !== 'string') return false

    const certUrl = safeSnsUrl(m.SigningCertURL ?? m.SigningCertUrl, '.pem')
    if (!certUrl) return false

    const toSign = buildStringToSign(m)
    if (!toSign) return false

    let pem = certCache.get(certUrl.href)
    if (!pem) {
      const res = await fetch(certUrl.href, { cache: 'no-store' })
      if (!res.ok) return false
      pem = await res.text()
      if (!pem.includes('BEGIN CERTIFICATE')) return false
      certCache.set(certUrl.href, pem)
    }

    const verifier = createVerify(m.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1')
    verifier.update(toSign, 'utf8')
    return verifier.verify(pem, m.Signature, 'base64')
  } catch (e) {
    console.error('[ses-webhook] Грешка при проверка на подпис:', e)
    return false
  }
}

// ─── Типове ──────────────────────────────────────────────────────────────────
interface SESEvent {
  eventType: 'Send' | 'Delivery' | 'Bounce' | 'Complaint' | 'Open' | 'Click' | string
  mail?: { destination?: string[]; messageId?: string }
  bounce?:    { bounceType?: string; bouncedRecipients?: { emailAddress?: string }[] }
  complaint?: { complainedRecipients?: { emailAddress?: string }[] }
}

const clean = (e: unknown) => String(e || '').toLowerCase().trim()

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Невалиден JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Невалидно съобщение' }, { status: 400 })
  }

  // ── 0. Автентичност: подпис + (по желание) очакван топик ──────────────────
  if (!(await verifySnsSignature(body))) {
    console.warn('[ses-webhook] Отхвърлено съобщение с невалиден подпис')
    return NextResponse.json({ error: 'Невалиден подпис' }, { status: 403 })
  }
  const expectedTopic = process.env.SNS_TOPIC_ARN
  if (expectedTopic && body.TopicArn !== expectedTopic) {
    console.warn('[ses-webhook] Отхвърлено: чужд топик', body.TopicArn)
    return NextResponse.json({ error: 'Непознат топик' }, { status: 403 })
  }

  const messageType: string = body.Type

  // ── 1. Еднократно потвърждение на абонамента ──────────────────────────────
  if (messageType === 'SubscriptionConfirmation') {
    const url = safeSnsUrl(body.SubscribeURL)
    if (!url) {
      return NextResponse.json({ error: 'Невалиден SubscribeURL' }, { status: 400 })
    }
    try {
      await fetch(url.href)
      console.info('[ses-webhook] SNS subscription потвърден автоматично')
    } catch (e) {
      console.error('[ses-webhook] Грешка при потвърждаване на subscription:', e)
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

    const now = new Date().toISOString()

    try {
      // ── Bounce: отписваме само при Permanent ──────────────────────────────
      if (event.eventType === 'Bounce') {
        if (event.bounce?.bounceType === 'Permanent') {
          const emails = (event.bounce.bouncedRecipients || []).map(r => clean(r.emailAddress)).filter(Boolean)
          for (const email of emails) {
            await supabaseAdmin
              .from('leads')
              .update({ subscribed: false, unsubscribe_reason: 'hard_bounce', updated_at: now })
              .eq('email', email)
            console.info(`[ses-webhook] Permanent bounce за ${email} — маркиран unsubscribed`)
          }
        } else {
          console.info(`[ses-webhook] Bounce (${event.bounce?.bounceType || 'unknown'}) — не се отписва`)
        }
      }

      // ── Complaint: винаги отписваме ───────────────────────────────────────
      else if (event.eventType === 'Complaint') {
        const emails = (event.complaint?.complainedRecipients || []).map(r => clean(r.emailAddress)).filter(Boolean)
        for (const email of emails) {
          await supabaseAdmin
            .from('leads')
            .update({ subscribed: false, unsubscribe_reason: 'spam_complaint', updated_at: now })
            .eq('email', email)
          console.info(`[ses-webhook] Complaint за ${email} — маркиран unsubscribed`)
        }
      }

      // ── Open / Click: последния email_logs запис на lead-а ─────────────────
      else if (event.eventType === 'Open' || event.eventType === 'Click') {
        for (const raw of event.mail?.destination || []) {
          const email = clean(raw)
          if (!email) continue

          const { data: lead } = await supabaseAdmin
            .from('leads').select('id').eq('email', email).maybeSingle()
          if (!lead) continue

          const { data: lastLog } = await supabaseAdmin
            .from('email_logs')
            .select('id')
            .eq('lead_id', lead.id)
            .order('sent_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (!lastLog) continue

          const field = event.eventType === 'Open' ? 'opened_at' : 'clicked_at'
          await supabaseAdmin.from('email_logs').update({ [field]: now }).eq('id', lastLog.id)
        }
      }
      // 'Delivery' / 'Send' — не изискват промяна в базата.
    } catch (e) {
      console.error('[ses-webhook] Грешка при обработка:', e)
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ success: true, ignored: true })
}
