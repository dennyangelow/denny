// app/api/orders/route.ts — ФИКС v6 FINAL
// ✅ invoice_data се записва в базата данни
// ✅ wants_invoice се записва правилно
// ✅ Детайлен debug лог за invoice

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { orderConfirmationEmail, adminNotifyEmail } from '@/lib/email-templates'
import { COURIER_LABELS } from '@/lib/constants'

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
    const body = await req.json()
    console.log('📦 New order body:', JSON.stringify(body, null, 2))

    const {
      customer_name, customer_phone, customer_email,
      customer_address, customer_city, customer_notes,
      payment_method, courier,
      items, subtotal, shipping, total,
      utm_source, utm_campaign,
      invoice, // ← фактура от frontend
    } = body

    // Debug invoice
    console.log('🧾 Invoice received:', JSON.stringify(invoice, null, 2))

    // ── Валидация ──────────────────────────────────────────────────────────
    const errors: string[] = []

    if (!customer_name?.trim())    errors.push('Липсва три имена')
    if (!customer_phone?.trim())   errors.push('Липсва телефон')
    if (!customer_address?.trim()) errors.push('Липсва адрес')
    if (!customer_city?.trim())    errors.push('Липсва град')

    if (!items || !Array.isArray(items) || items.length === 0) {
      errors.push('Количката е празна')
    }

    const parsedTotal    = parseFloat(String(total    || 0))
    const parsedSubtotal = parseFloat(String(subtotal || 0))
    const parsedShipping = parseFloat(String(shipping || 0))

    if (isNaN(parsedTotal) || parsedTotal <= 0) errors.push('Невалидна обща сума')

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 })
    }

    // ── Обработка на фактура ───────────────────────────────────────────────
    let invoiceData: Record<string, any> | null = null
    let wantsInvoice = false

    if (invoice && typeof invoice === 'object' && invoice.type && invoice.type !== 'none') {
      wantsInvoice = true
      if (invoice.type === 'company') {
        invoiceData = {
          type:                   'company',
          company_name:           invoice.company_name?.trim()    || null,
          company_eik:            invoice.company_eik?.trim()     || null,
          company_address:        invoice.company_address?.trim() || null,
          company_mol:            invoice.company_mol?.trim()     || null,
          company_vat_registered: invoice.company_vat_registered === true,
          company_vat_number:     invoice.company_vat_number?.trim() || null,
        }
      } else if (invoice.type === 'person') {
        invoiceData = {
          type:           'person',
          person_names:   invoice.person_names?.trim()   || null,
          person_egn:     invoice.person_egn?.trim()     || null,
          person_address: invoice.person_address?.trim() || null,
          person_phone:   invoice.person_phone?.trim()   || null,
        }
      }
    }

    console.log('🧾 Invoice parsed → wants_invoice:', wantsInvoice, '| invoice_data:', JSON.stringify(invoiceData))

    const validCouriers = Object.keys(COURIER_LABELS)
    const selectedCourier = validCouriers.includes(courier) ? courier : 'econt'

    // ── Вмъкване на поръчка ────────────────────────────────────────────────
    const insertPayload = {
      customer_name:    customer_name.trim(),
      customer_phone:   customer_phone.trim(),
      customer_email:   customer_email?.trim() || null,
      customer_address: customer_address.trim(),
      customer_city:    customer_city.trim(),
      customer_notes:   customer_notes?.trim() || null,
      payment_method:   payment_method || 'cod',
      courier:          selectedCourier,
      subtotal:         parsedSubtotal,
      shipping:         parsedShipping,
      total:            parsedTotal,
      utm_source:       utm_source || null,
      utm_campaign:     utm_campaign || null,
      wants_invoice:    wantsInvoice,
      invoice_data:     invoiceData,
    }

    console.log('💾 Inserting order with payload keys:', Object.keys(insertPayload))

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(insertPayload)
      .select()
      .single()

    if (orderError) {
      console.error('❌ Order insert error:', orderError)
      throw new Error(`DB грешка: ${orderError.message}`)
    }

    console.log('✅ Order inserted. wants_invoice in DB:', order.wants_invoice, '| invoice_data:', JSON.stringify(order.invoice_data))

    // ── Вмъкване на артикули ───────────────────────────────────────────────
    const orderItems = items.map((item: any) => ({
      order_id:     order.id,
      product_name: String(item.product_name || item.name || 'Продукт'),
      quantity:     parseInt(String(item.quantity || 1)),
      unit_price:   parseFloat(String(item.unit_price || item.price || 0)),
      total_price:  parseFloat(String(item.total_price || (item.unit_price * item.quantity) || 0)),
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('❌ Order items error:', itemsError)
    }

    // ── Emails ─────────────────────────────────────────────────────────────
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      const resend = new Resend(apiKey)
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com'

      if (customer_email?.trim()) {
        const { subject, html } = orderConfirmationEmail({ order, items: orderItems })
        await resend.emails.send({
          from: 'Denny Angelow <noreply@dennyangelow.com>',
          to: order.customer_email,
          subject,
          html,
        }).catch(e => console.error('Customer email error:', e))
      }

      const adminEmail = process.env.ADMIN_EMAIL || 'support@dennyangelow.com'
      const { subject: as, html: ah } = adminNotifyEmail({ order, items: orderItems, siteUrl })
      await resend.emails.send({
        from: 'System <noreply@dennyangelow.com>',
        to: adminEmail,
        subject: as,
        html: ah,
      }).catch(e => console.error('Admin email error:', e))
    }

    console.log('✅ Order created:', order.order_number, wantsInvoice ? `| Фактура: ${invoiceData?.type}` : '')

    return NextResponse.json({
      success: true,
      order_number: order.order_number,
      order_id: order.id,
    })
  } catch (error: any) {
    console.error('❌ Order creation failed:', error)
    return NextResponse.json(
      { error: error.message || 'Грешка при поръчката. Моля опитай отново.' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page   = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit  = Math.min(1000, parseInt(searchParams.get('limit') || '20'))
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
