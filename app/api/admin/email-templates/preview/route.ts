// app/api/admin/email-templates/preview/route.ts — v1
// ✅ ПРЕГЛЕД 1:1. Вика buildCustomEmail() — СЪЩАТА функция, през която минава
//    всяко реално автоматизационно писмо (lib/automations.ts runStep()).
//    Значи рамката (лого, tagline, футър, отписване), шрифтовете, бутоните
//    и заместването на {{променливи}} са идентични с изпратеното писмо.
//    Единствената разлика са примерните данни (име, поръчка, сума).
// Защитено от middleware.ts (/api/admin/* е admin-only).

import { NextRequest, NextResponse } from 'next/server'
import { buildCustomEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const subject  = String(body.subject ?? '').slice(0, 300)
    const bodyHtml = String(body.body_html ?? '').slice(0, 100_000)
    if (!subject.trim() || !bodyHtml.trim()) {
      return NextResponse.json({ error: 'Темата и съдържанието са задължителни' }, { status: 400 })
    }

    const { subject: finalSubject, html } = await buildCustomEmail({
      subjectTemplate:  subject,
      bodyHtmlTemplate: bodyHtml,
      email: 'ivan@example.com',
      name:  'Иван Иванов',
      slug:  'super-domati',                         // реален PDF линк от naruchnici
      context: { order_number: 'DA-2026-1963', total: 49.9, courier: 'econt', tracking_number: '1051234567890' },
    })

    return NextResponse.json({ subject: finalSubject, html })
  } catch (e: any) {
    console.error('POST /api/admin/email-templates/preview error:', e?.message || e)
    return NextResponse.json({ error: 'Грешка при генериране на прегледа' }, { status: 500 })
  }
}
