// lib/mailer.ts — единна точка за изпращане на имейли в целия проект — v3
//
// ✅ v3: sendEmail() вече връща { messageId } (от sendViaSES() v4) — нужно
//    на lib/automations.ts, за да го запише в email_logs.ses_message_id
//    (виж бележката в lib/ses.ts v4 и app/api/webhooks/ses/route.ts v3).
//    Никой съществуващ caller не четеше предишния връщан обект, затова
//    промяната на формата е безопасна.
//
// ✅ v2: подателят и Reply-To вече идват от lib/email-settings.ts (settings
//    таблицата, редактируема от Настройки → ✉️ Email настройки), вместо от
//    хардкоднат низ тук. Преди тези полета в админ панела съществуваха, но
//    не влияеха на нищо реално — sendEmail() винаги пращаше от
//    'Denny Angelow <support@dennyangelow.com>' без значение какво пише
//    администраторът в Настройки.
//    `from` параметърът (ако е подаден изрично от caller-а — виж
//    app/api/orders/[id]/route.ts tracking имейла) продължава да печели,
//    непроменено поведение за местата, които вече го задават сами.
//
// Всеки route.ts, който трябва да прати имейл, минава ЕДИНСТВЕНО през
// sendEmail() тук — никога директно през SES/Resend SDK. Това прави
// смяната или добавянето на провайдър в бъдеще (напр. Resend отгоре)
// въпрос на редактиране само на този файл, не на всеки route.

import { sendViaSES, type SESSendResult } from '@/lib/ses'
import { buildFromHeader, getEmailSettings } from '@/lib/email-settings'

export interface SendEmailParams {
  to:      string
  from?:   string
  subject: string
  html:    string
}

export async function sendEmail({ to, from, subject, html }: SendEmailParams): Promise<SESSendResult> {
  const [resolvedFrom, settings] = await Promise.all([
    from ? Promise.resolve(from) : buildFromHeader(),
    getEmailSettings(),
  ])

  return sendViaSES({
    to,
    from:    resolvedFrom,
    subject,
    html,
    replyTo: settings.replyTo,
  })
}
