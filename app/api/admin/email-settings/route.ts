// app/api/admin/email-settings/route.ts — v1
// Връща САМО публично-безопасните полета за preview-а в EmailTemplatesTab
// (не целия settings ред) — реалния fromName/tagline/footer, вместо примерни.
// Защитено от middleware.ts (/api/admin/* е admin-only).

import { NextResponse } from 'next/server'
import { getEmailSettings } from '@/lib/email-settings'

export async function GET() {
  try {
    const s = await getEmailSettings()
    return NextResponse.json({
      fromName:      s.fromName,
      senderTagline: s.senderTagline,
      footerText:    s.footerText,
    })
  } catch (e: any) {
    console.error('GET /api/admin/email-settings error:', e?.message || e)
    return NextResponse.json({ error: 'Грешка при зареждане на настройките' }, { status: 500 })
  }
}
