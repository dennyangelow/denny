// ФАЙЛ: app/api/leads/[id]/route.ts — v3
//
// ПОПРАВКИ v3 (спрямо v2):
//   ✅ Всички systemeio_* полета и логика МАХНАТИ — Systeme.io е изцяло
//      премахнат от проекта (виж leads/route.ts v18 коментара). Преди
//      ALLOWED whitelist-а и merge логиката още пишеха systemeio_blocked/
//      systemeio_synced/systemeio_email_invalid/systemeio_contact_id при
//      всяка смяна на имейл — мъртъв код, който подвеждаше при четене.
//      Колоните в базата остават (виж SQL бележка долу) — само кодът вече
//      не ги пипа.
//
// ⚠️ БАЗА ДАННИ: ако искаш да изчистиш и самите колони от `leads`
// таблицата (не са грешка да си останат, просто са мъртво тегло), пусни
// в Supabase SQL editor:
//   ALTER TABLE leads
//     DROP COLUMN IF EXISTS systemeio_blocked,
//     DROP COLUMN IF EXISTS systemeio_synced,
//     DROP COLUMN IF EXISTS systemeio_email_invalid,
//     DROP COLUMN IF EXISTS systemeio_contact_id;
// Направи го само СЛЕД като си сигурен, че никой друг route/скрипт вече
// не ги чете (grep целия проект за "systemeio" преди да трием колони).
//
// ПОПРАВКИ v2 (запазени):
//   1. При PATCH с нов имейл, ако имейлът вече съществува в базата (409/23505):
//      MERGE логика — запазваме по-добрите данни от двата записа,
//      изтриваме стария дублиран запис, обновяваме текущия.
//      Това решава случая: невалиден имейл "А" се коригира до реален имейл "Б",
//      но "Б" вече съществува от друга регистрация.
//
// Използва се от:
//   - LeadsTab.handleUnsubscribe → PATCH { subscribed: false }
//   - InvalidEmailModal "Ресетни" бутон → PATCH { email: newEmail }

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ── PATCH: Частично обновяване на lead ────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  if (!id) {
    return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Невалидно тяло на заявката' }, { status: 400 })
  }

  // Позволени полета за обновяване (whitelist за сигурност)
  const ALLOWED = ['email', 'name', 'phone', 'subscribed'] as const

  const updates: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Няма валидни полета за обновяване' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // ── Смяна на имейл: специална логика ──────────────────────────────────────
  if ('email' in updates) {
    const newEmail = String(updates.email).toLowerCase().trim()

    if (!newEmail.includes('@') || newEmail.length > 255) {
      return NextResponse.json({ error: 'Невалиден имейл адрес' }, { status: 400 })
    }

    // Взимаме текущия запис
    const { data: currentLead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()

    if (!currentLead) {
      return NextResponse.json({ error: 'Контактът не е намерен' }, { status: 404 })
    }

    // Ако имейлът не се е сменил → нищо специално, продължаваме към обикновения update
    if (newEmail === currentLead.email) {
      updates.updated_at = now
    } else {
      // Проверяваме дали новият имейл вече съществува
      const { data: existingLead } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('email', newEmail)
        .single()

      if (existingLead) {
        // ── MERGE: новият имейл вече съществува ──────────────────────────────
        // Стратегия: обновяваме existing lead-а с обединените данни,
        // изтриваме невалидния запис (current).
        //
        // "По-добро" = не-null стойността; при равенство → existing-ът печели

        const mergedName  = existingLead.name  || currentLead.name  || null
        const mergedPhone = existingLead.phone || currentLead.phone || null

        // Обединяваме naruchnici масивите
        const existingSlugs = (existingLead as any).naruchnici as string[] | null
        const currentSlugs  = (currentLead  as any).naruchnici as string[] | null
        const mergedSlugs   = Array.from(
          new Set([...(existingSlugs || []), ...(currentSlugs || [])])
        )

        // Обединяваме тагове
        const existingTags = (existingLead as any).tags as string[] | null
        const currentTags  = (currentLead  as any).tags  as string[] | null
        const mergedTags   = Array.from(
          new Set([...(existingTags || []), ...(currentTags || [])])
        )

        // Запазваме по-ранната дата на създаване
        const mergedCreatedAt = (existingLead.created_at < currentLead.created_at)
          ? existingLead.created_at
          : currentLead.created_at

        // Update existing lead с обединените данни
        const { data: mergedLead, error: mergeError } = await supabaseAdmin
          .from('leads')
          .update({
            name:       mergedName,
            phone:      mergedPhone,
            naruchnici: mergedSlugs.length > 0 ? mergedSlugs : existingSlugs,
            tags:       mergedTags.length > 0 ? mergedTags : existingTags,
            created_at: mergedCreatedAt,
            subscribed: existingLead.subscribed || currentLead.subscribed,
            updated_at: now,
          })
          .eq('id', existingLead.id)
          .select()
          .single()

        if (mergeError) {
          console.error('[leads/[id]] Merge update error:', mergeError)
          return NextResponse.json({ error: mergeError.message }, { status: 500 })
        }

        // Изтриваме стария невалиден запис (current)
        await supabaseAdmin
          .from('leads')
          .delete()
          .eq('id', id)

        console.info(`[leads/[id]] Merge: ${currentLead.email} → ${newEmail} (kept id=${existingLead.id})`)

        return NextResponse.json({
          success: true,
          merged:  true,
          lead:    mergedLead,
          message: `Обединено със съществуващ контакт (${newEmail})`,
        })
      }

      // ── Новият имейл не съществува → обикновена смяна ────────────────────
      updates.email      = newEmail
      updates.updated_at = now
    }
  } else {
    updates.updated_at = now
  }

  // ── Обикновен update ───────────────────────────────────────────────────────
  const { data, error } = await supabaseAdmin
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // 23505 = unique violation — race condition (много рядко)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Конфликт при запис — опитай отново' },
        { status: 409 }
      )
    }
    console.error('[leads/[id]] PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Контактът не е намерен' }, { status: 404 })
  }

  return NextResponse.json({ success: true, lead: data })
}

// ── DELETE: Изтриване на lead ─────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  if (!id) {
    return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('leads')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[leads/[id]] DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// ── GET: Вземане на единичен lead ─────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Контактът не е намерен' }, { status: 404 })
  }

  return NextResponse.json(data)
}
