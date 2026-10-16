// app/api/admin/email-templates/send-test/route.ts — v1
// ✅ Праща ТЕСТОВО писмо до избран адрес (напр. твоя Yahoo/Gmail) през
//    реалния sendEmail() + buildCustomEmail() — виждаш точно какво ще
//    получи клиентът във ВСЕКИ mail клиент, не само в прегледа в админа.
//    Темата се префиксира с "[ТЕСТ] ". Не пише в email_logs (не е част
//    от статистиката). Защитено от middleware.ts (/api/admin/* е admin-only).

import { NextRequest, NextResponse } from 'next/server'
import { buildCustomEmail } from '@/lib/email-templates'
import { sendEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const to       = String(body.to ?? '').trim().toLowerCase()
    const subject  = String(body.subject ?? '').slice(0, 300)
    const bodyHtml = String(body.body_html ?? '').slice(0, 100_000)

    if (!EMAIL_RE.test(to) || to.length > 254) {
      return NextResponse.json({ error: 'Невалиден имейл адрес' }, { status: 400 })
    }
    if (!subject.trim() || !bodyHtml.trim()) {
      return NextResponse.json({ error: 'Темата и съдържанието са задължителни' }, { status: 400 })
    }

    const { subject: finalSubject, html } = await buildCustomEmail({
      subjectTemplate:  subject,
      bodyHtmlTemplate: bodyHtml,
      email: to,
      name:  'Иван Иванов',
      slug:  'super-domati',
      context: { order_number: 'DA-2026-1963', total: 49.9, courier: 'econt', tracking_number: '1051234567890' },
    })

    await sendEmail({ to, subject: `[ТЕСТ] ${finalSubject}`, html })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('POST /api/admin/email-templates/send-test error:', e?.message || e)
    return NextResponse.json({ error: e?.message || 'Грешка при изпращане' }, { status: 500 })
  }
}
