// app/api/admin/automations/run-now/route.ts — v1
//
// ЗАМЕНЯ стария /api/leads/sequence (изтрит — беше от pre-mega-plan ерата).
// Старият ендпойнт:
//   - обработваше само част от автоматизациите (накрая — само abandoned
//     cart/order, не и naruchnik/workflow-базираните серии),
//   - се очакваше да е CRON_SECRET Bearer-защитен (виж security checklist-а
//     в SettingsTab.tsx) — несъвместимо с обикновен fetch() от браузъра,
//     значи бутонът "▶ Стартирай ръчно сега" вероятно е гърмял с 401.
//
// Този route вика directно processDueEnrollments() — СЪЩАТА функция, която
// hourly cron-ът (/api/automations/tick) вика — но зад admin session auth
// (през middleware.ts, като всеки друг /api/admin/* route), не зад
// CRON_SECRET. Обработва ВСИЧКИ активни workflows наведнъж.

import { NextResponse } from 'next/server'
import { processDueEnrollments } from '@/lib/automations'

export async function POST() {
  try {
    const result = await processDueEnrollments()
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    console.error('POST /api/admin/automations/run-now error:', e?.message || e)
    return NextResponse.json(
      { error: e?.message || 'Грешка при стартиране на автоматизациите' },
      { status: 500 }
    )
  }
}
