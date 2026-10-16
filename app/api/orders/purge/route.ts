// app/api/orders/purge/route.ts — v1
// Изтрива поръчки ЗАВИНАГИ (+ артикулите им) и по избор свързани данни:
//   • customers        — по нормализиран телефон (последните 9 цифри), САМО ако клиентът
//                        няма други останали поръчки
//   • abandoned_carts  — само по имейл (точно съвпадение)
//   • leads            — само по имейл (точно съвпадение); отписаните НИКОГА не се трият
//
// ⚠️ Защо leads/колички НЕ се търсят по телефон: много хора пишат фалшиви номера
//    (0888888888) — по телефон бихме изтрили напълно непознати абонати.
//
// Достъп: само admin — middleware.ts v15 е fail-closed за всичко под /api,
// а /api/orders/purge не е в списъка с публичните.
//
// POST { ids: string[], options?: { customers, abandoned_carts, leads }, dry_run?: boolean }
//   dry_run=true → нищо не се трие, връща само преглед (какво ще бъде изтрито).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const UUID_RE   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_IDS   = 500
const ID_CHUNK  = 100
const KEY_CHUNK = 20

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const phone9 = (v: unknown): string => {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : ''
}

const SAFE_EMAIL = /^[^\s,()"'\\*%]+@[^\s,()"'\\*%]+$/
const normEmail = (v: unknown): string => {
  const e = String(v ?? '').trim().toLowerCase()
  return e && e.length <= 254 && SAFE_EMAIL.test(e) ? e : ''
}

type OrderRow = { id: string; order_number: string | null; customer_phone: string | null; customer_email: string | null }

// Кои ключове (телефон/имейл) се ползват още от поръчки, които НЕ се трият
async function keysStillInUse(phones: string[], emails: string[], excluded: Set<string>) {
  const phonesUsed = new Set<string>()
  const emailsUsed = new Set<string>()

  for (const part of chunk(phones, KEY_CHUNK)) {
    const filter = part.map(p => `customer_phone.like.*${p}`).join(',')
    const { data, error } = await supabaseAdmin.from('orders').select('id, customer_phone').or(filter)
    if (error) throw new Error(`orders(phone): ${error.message}`)
    for (const r of data || []) {
      if (excluded.has(r.id)) continue
      const p = phone9(r.customer_phone)
      if (p) phonesUsed.add(p)
    }
  }
  for (const part of chunk(emails, 50)) {
    const variants = Array.from(new Set(part.flatMap(e => [e, e.toLowerCase()])))
    const { data, error } = await supabaseAdmin.from('orders').select('id, customer_email').in('customer_email', variants)
    if (error) throw new Error(`orders(email): ${error.message}`)
    for (const r of data || []) {
      if (excluded.has(r.id)) continue
      const e = normEmail(r.customer_email)
      if (e) emailsUsed.add(e)
    }
  }
  return { phonesUsed, emailsUsed }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Невалидна заявка' }, { status: 400 })
  }

  const ids: string[] = Array.isArray(body.ids)
    ? Array.from(new Set<string>(body.ids.filter((x: unknown): x is string => typeof x === 'string' && UUID_RE.test(x))))
    : []
  if (ids.length === 0 || ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Избери между 1 и ${MAX_IDS} поръчки` }, { status: 400 })
  }

  const dryRun = body.dry_run === true
  const opts = {
    customers:       body.options?.customers       === true,
    abandoned_carts: body.options?.abandoned_carts === true,
    leads:           body.options?.leads           === true,
  }
  const warnings: string[] = []

  try {
    // 1) Какво точно ще изтриваме
    const orders: OrderRow[] = []
    for (const part of chunk(ids, ID_CHUNK)) {
      const { data, error } = await supabaseAdmin
        .from('orders').select('id, order_number, customer_phone, customer_email').in('id', part)
      if (error) throw new Error(`orders: ${error.message}`)
      orders.push(...((data || []) as OrderRow[]))
    }
    if (orders.length === 0) {
      return NextResponse.json({ success: true, dry_run: dryRun, deleted: 0, deleted_ids: [], preview: null })
    }

    // 2) Брой артикули (за прегледа)
    let itemsCount = 0
    for (const part of chunk(orders.map(o => o.id), ID_CHUNK)) {
      const { count } = await supabaseAdmin
        .from('order_items').select('id', { count: 'exact', head: true }).in('order_id', part)
      itemsCount += count || 0
    }

    // 3) Изтриване на самите поръчки (ако не е dry run)
    let deletedIds = orders.map(o => o.id)
    if (!dryRun) {
      deletedIds = []
      for (const part of chunk(orders.map(o => o.id), ID_CHUNK)) {
        const { error: itemsErr } = await supabaseAdmin.from('order_items').delete().in('order_id', part)
        if (itemsErr) {
          console.error('❌ purge order_items:', itemsErr.message)
          return NextResponse.json({ error: 'Грешка при изтриване на артикулите', deleted_ids: deletedIds }, { status: 500 })
        }
        const { data, error } = await supabaseAdmin.from('orders').delete().in('id', part).select('id')
        if (error) {
          console.error('❌ purge orders:', error.message)
          return NextResponse.json({ error: 'Грешка при изтриване на поръчките', deleted_ids: deletedIds }, { status: 500 })
        }
        deletedIds.push(...(data || []).map(r => r.id))
      }
    }

    // 4) Свързани данни — само за реално изтритите (или за всички при dry run)
    const gone      = new Set(deletedIds)
    const goneRows  = orders.filter(o => gone.has(o.id))
    const phones    = Array.from(new Set(goneRows.map(o => phone9(o.customer_phone)).filter(Boolean)))
    const emails    = Array.from(new Set(goneRows.map(o => normEmail(o.customer_email)).filter(Boolean)))

    const { phonesUsed, emailsUsed } = await keysStillInUse(phones, emails, gone)
    const freePhones = phones.filter(p => !phonesUsed.has(p))
    const freeEmails = emails.filter(e => !emailsUsed.has(e))
    const keptShared = (phones.length - freePhones.length) + (emails.length - freeEmails.length)

    // 4а) customers (по телефон)
    let customerRows: { id: string; name: string | null }[] = []
    if (opts.customers && freePhones.length) {
      for (const part of chunk(freePhones, 50)) {
        const { data, error } = await supabaseAdmin.from('customers').select('id, name').in('phone_normalized', part)
        if (error) warnings.push(`customers: ${error.message}`)
        else customerRows.push(...(data || []))
      }
    }

    // 4б) abandoned_carts и leads (само по имейл)
    const byEmail = async (table: 'abandoned_carts' | 'leads', select: string) => {
      const rows: any[] = []
      for (const part of chunk(freeEmails, 50)) {
        const variants = Array.from(new Set(part.flatMap(e => [e, e.toLowerCase()])))
        const { data, error } = await supabaseAdmin.from(table).select(select).in('email', variants)
        if (error) warnings.push(`${table}: ${error.message}`)
        else rows.push(...((data || []) as any[]))
      }
      return rows.filter(r => freeEmails.includes(normEmail(r.email)))
    }
    const cartRows  = opts.abandoned_carts && freeEmails.length ? await byEmail('abandoned_carts', 'id, email, name') : []
    const leadAll   = opts.leads && freeEmails.length ? await byEmail('leads', 'id, email, name, subscribed, unsubscribed_at') : []
    const leadRows  = leadAll.filter(r => !r.unsubscribed_at && r.subscribed !== false)
    const leadsKeptUnsub = leadAll.length - leadRows.length

    const preview = {
      orders:  orders.length,
      items:   itemsCount,
      customers:       { count: customerRows.length, sample: customerRows.slice(0, 5).map(r => r.name || '—') },
      abandoned_carts: { count: cartRows.length,     sample: cartRows.slice(0, 5).map(r => r.email) },
      leads:           { count: leadRows.length,     sample: leadRows.slice(0, 5).map(r => r.email), kept_unsubscribed: leadsKeptUnsub },
      kept_shared_keys: keptShared,
    }

    if (dryRun) {
      return NextResponse.json({ success: true, dry_run: true, preview, warnings })
    }

    // 5) Реално изтриване на свързаните данни (всяка стъпка е независима)
    const removed = { customers: 0, abandoned_carts: 0, leads: 0 }
    const purge = async (table: 'customers' | 'abandoned_carts' | 'leads', rows: { id: string }[]) => {
      for (const part of chunk(rows.map(r => r.id), ID_CHUNK)) {
        const { data, error } = await supabaseAdmin.from(table).delete().in('id', part).select('id')
        if (error) { warnings.push(`${table}: ${error.message}`); console.error(`❌ purge ${table}:`, error.message); break }
        removed[table] += (data || []).length
      }
    }
    await purge('customers', customerRows)
    await purge('abandoned_carts', cartRows)
    await purge('leads', leadRows)

    return NextResponse.json({
      success: true, dry_run: false,
      deleted: deletedIds.length, deleted_ids: deletedIds,
      removed, kept_unsubscribed_leads: leadsKeptUnsub, kept_shared_keys: keptShared,
      warnings,
    })
  } catch (e: any) {
    console.error('❌ purge error:', e?.message || e)
    return NextResponse.json({ error: 'Грешка при изтриването' }, { status: 500 })
  }
}
