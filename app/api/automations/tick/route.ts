// app/api/automations/tick/route.ts — v2
// ✅ v1 → v2 (сигурност): ако CRON_SECRET липсва, v1 връщаше "разрешено" и
//    ендпойнтът (който праща имейли) ставаше достъпен за всеки. Сега
//    без CRON_SECRET отворено е САМО при локална разработка (NODE_ENV !== 'production');
//    в production заявката се отхвърля. Останалото е непроменено.
//
// ✅ Генерален executor — обработва ВСИЧКИ активни workflows/enrollments
//    наведнъж, независимо от trigger_type. Замества naruchnik-специфичния
//    блок, който преди живееше в app/api/leads/sequence/route.ts (виж
//    там v2 — блокът е премахнат, abandoned order/cart логиката остава).
//
// Вика се на всеки час от Supabase pg_cron задачата 'automations-tick-hourly',
// която праща 'Authorization: Bearer <cron_secret>' (стойността е във Supabase Vault
// и трябва да е същата като CRON_SECRET във Vercel).

import { NextRequest, NextResponse } from 'next/server'
import { processDueEnrollments } from '@/lib/automations'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  // Без secret: отворено само локално, никога в production (fail-closed)
  if (!cronSecret) return process.env.NODE_ENV !== 'production'
  return req.headers.get('authorization') === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processDueEnrollments()

  return NextResponse.json({
    success: true,
    ...result,
    timestamp: new Date().toISOString(),
  })
}
