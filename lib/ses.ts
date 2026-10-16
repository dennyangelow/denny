// lib/ses.ts — SES транспортен слой — v5
// ✅ v5: добавена plain-text версия (Body.Text) до HTML-а на ВСЯКО писмо —
//    подобрява доставимостта (inbox-и, особено корпоративни, по-лесно маркират
//    HTML-only писма като спам/промоция). AWS SES автоматично избира коя
//    версия да покаже на клиента, в зависимост от неговия mail client.
//    htmlToText() е груб, но безопасен strip — маха <script>/<style>
//    блокове, превръща </p>/<br>/</div> в нови редове, маха остатъчните
//    тагове, decode-ва честите entity-та. Generira се АВТОМАТИЧНО от html
//    тук — никой caller (lib/mailer.ts, lib/automations.ts, route.ts-овете)
//    не трябва да се пипа, за да получи plain-text версия.
// v4: sendViaSES() вече връща { messageId } вместо целия AWS SDK отговор.
//    SES-ThismessageId е нужен на lib/automations.ts, за да го пази в
//    email_logs.ses_message_id — иначе webhook-ът (app/api/webhooks/ses)
//    не може да различи КОЕ точно писмо е било отворено/кликнато, когато
//    на един lead са изпратени няколко писма от серията (виж бележката в
//    route.ts v3). Нищо не ползваше пълния AWS отговор преди, затова тази
//    промяна е безопасна — просто по-тясна, по-полезна форма.
// v3: приема по избор `replyTo` — минава в ReplyToAddresses на SES
//    заявката. Преди Reply-To винаги падаше на SES default (самия Source
//    адрес) — полето "Reply-To" в Настройки съществуваше, но никъде не
//    влизаше в реално изпратените писма. Вика се от lib/mailer.ts, което
//    чете стойността от lib/email-settings.ts (settings таблицата).
// v2: добавен ConfigurationSetName — без него SES не праща delivered/
//     bounce/complaint/open/click събития към SNS топика (ses-events).

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

let _sesClient: SESClient | null = null

function getSESClient(): SESClient {
  if (_sesClient) return _sesClient

  const accessKeyId     = process.env.SES_ACCESS_KEY_ID
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY
  const region           = process.env.SES_REGION || 'eu-north-1'

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY не са зададени в env vars')
  }

  _sesClient = new SESClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  return _sesClient
}

// Името на Configuration Set-а, създаден в SES конзолата
// (Amazon SES → Configuration sets → my-first-configuration-set).
const CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET || 'my-first-configuration-set'

// ✅ v5 — груб, но безопасен HTML→text. Не е нужна пълна HTML парсър
// точност (plain-text версията е fallback за клиенти без HTML рендиране,
// не крайният продукт) — важното е да няма сурови тагове и да е четимо.
function htmlToText(html: string): string {
  return html
    // Изцяло маха <script>/<style> съдържание (никога не искаме в text версията)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Блокови елементи → нов ред, преди да махнем тага
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Линкове: показваме и текста, и адреса — иначе plain-text версията губи CTA-тата
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
      const clean = text.replace(/<[^>]+>/g, '').trim()
      return clean ? `${clean} (${href})` : href
    })
    // Остатъчни тагове
    .replace(/<[^>]+>/g, '')
    // Чести HTML entity-та
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Сгъстяваме празните редове/интервали
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface SESEmailParams {
  to: string
  from: string
  subject: string
  html: string
  replyTo?: string
}

export interface SESSendResult {
  messageId: string | undefined
}

export async function sendViaSES({ to, from, subject, html, replyTo }: SESEmailParams): Promise<SESSendResult> {
  const client = getSESClient()

  const command = new SendEmailCommand({
    Source: from,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: html, Charset: 'UTF-8' },
        Text: { Data: htmlToText(html), Charset: 'UTF-8' },
      },
    },
    ConfigurationSetName: CONFIGURATION_SET,
    ...(replyTo ? { ReplyToAddresses: [replyTo] } : {}),
  })

  const result = await client.send(command)
  return { messageId: result.MessageId }
}
