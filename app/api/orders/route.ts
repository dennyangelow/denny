// app/api/orders/route.ts — v8
// ✅ v7 → v8:
//   1. БЕЗ console.log на тялото на поръчката и на фактурата. Преди във Vercel
//      логовете оставаха имена, телефони, адреси и ЕГН (при фактура на физическо
//      лице) — лични данни в логове. Остава само номерът на поръчката.
//   2. Входът се чисти и ограничава: дължини на текстовете, брой артикули (макс. 50),
//      количество 1–100, цена 0–100 000, формат на имейла. Преди нищо от това
//      не се проверяваше.
//   3. Вътрешните DB грешки не се връщат към клиента (само се логват на сървъра).
//   4. Ако сборът на артикулите + доставката се разминава с подадената обща сума,
//      се записва предупреждение в логовете (без лични данни).
//
// ⚠️ ЦЕНИТЕ все още идват от клиента (unit_price / total). Истинска защита е
//    сървърът да вземе цената от таблица `products` по id/slug на артикула —
//    за това ми трябва CartSystem.tsx (какви полета носи всеки артикул).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/mailer'
import { orderConfirmationEmail, adminNotifyEmail } from '@/lib/email-templates'
import { COURIER_LABELS } from '@/lib/constants'

const MAX_ITEMS = 50
const EMAIL_RE  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const str = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : NaN
}

const round2 = (n: number) => Math.round(n * 100) / 100

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = rateLimit(`orders:${ip}`, { limit: 5, window: 600 })
  if (!rl.success) {
    return NextResponse.json(
      { error: `Твърде много заявки. Изчакай ${rl.resetIn} секунди.` },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Невалидна заявка' }, { status: 400 })
    }

    const customer_name    = str(body.customer_name, 120)
    const customer_phone   = str(body.customer_phone, 40)
    const customer_email   = str(body.customer_email, 254)
    const customer_address = str(body.customer_address, 300)
    const customer_city    = str(body.customer_city, 100)
    const customer_notes   = str(body.customer_notes, 1000)
    const payment_method   = str(body.payment_method, 30) || 'cod'
    const utm_source       = str(body.utm_source, 100)
    const utm_campaign     = str(body.utm_campaign, 100)
    const { courier, items, invoice } = body

    // ── Валидация ──────────────────────────────────────────────────────────
    const errors: string[] = []

    if (!customer_name)    errors.push('Липсва три имена')
    if (!customer_phone)   errors.push('Липсва телефон')
    if (!customer_address) errors.push('Липсва адрес')
    if (!customer_city)    errors.push('Липсва град')
    if (customer_email && !EMAIL_RE.test(customer_email)) errors.push('Невалиден имейл')

    if (!Array.isArray(items) || items.length === 0) {
      errors.push('Количката е празна')
    } else if (items.length > MAX_ITEMS) {
      errors.push('Твърде много артикули в поръчката')
    }

    const parsedTotal    = num(body.total)
    const parsedSubtotal = num(body.subtotal ?? 0)
    const parsedShipping = num(body.shipping ?? 0)

    if (!Number.isFinite(parsedTotal) || parsedTotal <= 0 || parsedTotal > 100000) errors.push('Невалидна обща сума')
    if (!Number.isFinite(parsedSubtotal) || parsedSubtotal < 0 || parsedSubtotal > 100000) errors.push('Невалидна сума на артикулите')
    if (!Number.isFinite(parsedShipping) || parsedShipping < 0 || parsedShipping > 1000) errors.push('Невалидна цена на доставката')

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 })
    }

    // ── Артикули: чистене и ограничения ────────────────────────────────────
    const cleanItems: { product_name: string; quantity: number; unit_price: number; total_price: number }[] = []
    for (const raw of items as any[]) {
      const quantity   = Math.min(100, Math.max(1, parseInt(String(raw?.quantity ?? 1), 10) || 1))
      const unit_price = num(raw?.unit_price ?? raw?.price ?? 0)
      if (!Number.isFinite(unit_price) || unit_price < 0 || unit_price > 100000) {
        return NextResponse.json({ error: 'Невалидна цена на артикул' }, { status: 400 })
      }
      const givenTotal = num(raw?.total_price)
      const total_price = Number.isFinite(givenTotal) && givenTotal >= 0 && givenTotal <= 1000000
        ? round2(givenTotal)
        : round2(unit_price * quantity)

      cleanItems.push({
        product_name: str(raw?.product_name ?? raw?.name, 200) || 'Продукт',
        quantity,
        unit_price:   round2(unit_price),
        total_price,
      })
    }

    const computed = round2(cleanItems.reduce((s, i) => s + i.total_price, 0) + parsedShipping)
    if (Math.abs(computed - parsedTotal) > 0.05) {
      console.warn(`[orders] Разминаване в сумата: изчислено ${computed}, подадено ${parsedTotal}`)
    }

    // ── Обработка на фактура ───────────────────────────────────────────────
    let invoiceData: Record<string, any> | null = null
    let wantsInvoice = false

    if (invoice && typeof invoice === 'object' && invoice.type && invoice.type !== 'none') {
      wantsInvoice = true
      if (invoice.type === 'company') {
        invoiceData = {
          type:                   'company',
          company_name:           str(invoice.company_name, 200)    || null,
          company_eik:            str(invoice.company_eik, 30)      || null,
          company_address:        str(invoice.company_address, 300) || null,
          company_mol:            str(invoice.company_mol, 120)     || null,
          company_vat_registered: invoice.company_vat_registered === true,
          company_vat_number:     str(invoice.company_vat_number, 30) || null,
        }
      } else if (invoice.type === 'person') {
        invoiceData = {
          type:           'person',
          person_names:   str(invoice.person_names, 120)   || null,
          person_egn:     str(invoice.person_egn, 20)      || null,
          person_address: str(invoice.person_address, 300) || null,
          person_phone:   str(invoice.person_phone, 40)    || null,
        }
      }
    }

    const validCouriers   = Object.keys(COURIER_LABELS)
    const selectedCourier = validCouriers.includes(courier) ? courier : 'econt'

    // ── Вмъкване на поръчка ────────────────────────────────────────────────
    const insertPayload = {
      customer_name,
      customer_phone,
      customer_email:   customer_email || null,
      customer_address,
      customer_city,
      customer_notes:   customer_notes || null,
      payment_method,
      courier:          selectedCourier,
      subtotal:         parsedSubtotal,
      shipping:         parsedShipping,
      total:            parsedTotal,
      utm_source:       utm_source || null,
      utm_campaign:     utm_campaign || null,
      wants_invoice:    wantsInvoice,
      invoice_data:     invoiceData,
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(insertPayload)
      .select()
      .single()

    if (orderError || !order) {
      console.error('❌ Order insert error:', orderError?.message)
      return NextResponse.json(
        { error: 'Грешка при запис на поръчката. Моля опитай отново.' },
        { status: 500 }
      )
    }

    // ── Вмъкване на артикули ───────────────────────────────────────────────
    const orderItems = cleanItems.map(i => ({ order_id: order.id, ...i }))

    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItems)
    if (itemsError) {
      console.error('❌ Order items error:', itemsError.message)
    }

    // ── Emails (през Amazon SES) ────────────────────────────────────────────
    if (order.customer_email) {
      const { subject, html } = orderConfirmationEmail({ order, items: orderItems })
      await sendEmail({
        to:      order.customer_email,
        from:    'Denny Angelow <noreply@dennyangelow.com>',
        subject,
        html,
      }).catch(e => console.error('Customer email error:', e?.message || e))
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'support@dennyangelow.com'
    const { subject: as, html: ah } = adminNotifyEmail({ order, items: orderItems, siteUrl: process.env.NEXT_PUBLIC_SITE_URL })
    await sendEmail({
      to:      adminEmail,
      from:    'System <noreply@dennyangelow.com>',
      subject: as,
      html:    ah,
    }).catch(e => console.error('Admin email error:', e?.message || e))

    console.log('✅ Order created:', order.order_number, wantsInvoice ? `| Фактура: ${invoiceData?.type}` : '')

    return NextResponse.json({
      success: true,
      order_number: order.order_number,
      order_id: order.id,
    })
  } catch (error: any) {
    console.error('❌ Order creation failed:', error?.message || error)
    return NextResponse.json(
      { error: 'Грешка при поръчката. Моля опитай отново.' },
      { status: 500 }
    )
  }
}

// GET — само за admin (защитено в middleware.ts)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page   = Math.max(1, parseInt(searchParams.get('page')  || '1', 10) || 1)
  const limit  = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('orders')
    .select('*, order_items(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data, total: count, page, limit })
}
