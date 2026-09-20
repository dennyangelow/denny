// lib/mailer.ts — единна точка за изпращане на имейли в целия проект
//
// Всеки route.ts, който трябва да прати имейл, минава ЕДИНСТВЕНО през
// sendEmail() тук — никога директно през SES/Resend SDK. Това прави
// смяната или добавянето на провайдър в бъдеще (напр. Resend отгоре)
// въпрос на редактиране само на този файл, не на всеки route.

import { sendViaSES } from '@/lib/ses'

export interface SendEmailParams {
  to:      string
  from?:   string
  subject: string
  html:    string
}

// Default подател — ползва се навсякъде, където не е подаден изричен 'from'.
const DEFAULT_FROM = 'Denny Angelow <support@dennyangelow.com>'

export async function sendEmail({ to, from, subject, html }: SendEmailParams) {
  return sendViaSES({
    to,
    from: from || DEFAULT_FROM,
    subject,
    html,
  })
}
