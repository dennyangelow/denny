// app/api/automations/tick/route.ts — v1
// ✅ Генерален executor — обработва ВСИЧКИ активни workflows/enrollments
//    наведнъж, независимо от trigger_type. Замества naruchnik-специфичния
//    блок, който преди живееше в app/api/leads/sequence/route.ts (виж
//    там v2 — блокът е премахнат, abandoned order/cart логиката остава).
//
// ⚠️ ЗАДЪЛЖИТЕЛНО: пусни нов Supabase pg_cron job, hourly, сочещ към
//    този endpoint (успоредно на съществуващия за /api/leads/sequence,
//    не вместо него — abandoned order/cart все още минават през стария).
//    Пример SQL (замени URL-а с твоя реален домейн):
//
//    select cron.schedule(
//      'automations-tick-hourly',
//      '0 * * * *',
//      $$ select net.http_get('https://dennyangelow.com/api/automations/tick') $$
//    );

import { NextRequest, NextResponse } from 'next/server'
import { processDueEnrollments } from '@/lib/automations'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true // dev mode
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
