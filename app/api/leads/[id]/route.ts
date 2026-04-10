// ФАЙЛ: app/api/leads/[id]/route.ts — v1
//
// Липсващият route за операции върху единичен lead по ID:
//   PATCH /api/leads/:id  → обновява полета (email, subscribed, name, phone, ...)
//   DELETE /api/leads/:id → изтрива lead (по желание)
//
// Използва се от:
//   - LeadsTab.handleUnsubscribe → PATCH { subscribed: false }
//   - InvalidEmailModal "Ресетни" бутон → PATCH { email: newEmail } (преди handleResetInvalid)

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
  const ALLOWED = ['email', 'name', 'phone', 'subscribed', 'tags'] as const
  type AllowedKey = typeof ALLOWED[number]

  const updates: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Няма валидни полета за обновяване' }, { status: 400 })
  }

  // Ако се сменя имейлът → нормализираме + маркираме за нов sync
  if ('email' in updates) {
    const newEmail = String(updates.email).toLowerCase().trim()

    if (!newEmail.includes('@') || newEmail.length > 255) {
      return NextResponse.json({ error: 'Невалиден имейл адрес' }, { status: 400 })
    }

    updates.email = newEmail
    // При смяна на имейл: трябва нов sync към Systeme.io
    updates.systemeio_synced        = false
    updates.systemeio_email_invalid = false
    updates.systemeio_contact_id    = null  // стар contact-ът е за друг имейл
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // 23505 = unique violation (duplicate email)
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Този имейл вече съществува в базата' },
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

// ── GET: Вземане на единичен lead (по желание) ────────────────────────────────
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
