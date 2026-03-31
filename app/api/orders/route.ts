// app/api/orders/route.ts — ФИКС v4
// Поправки:
// 1. По-детайлни error messages за debugging
// 2. По-добра валидация на items
// 3. shipping/subtotal/total са числа, не стрингове

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
    } = body

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

    const validCouriers = Object.keys(COURIER_LABELS)
    const selectedCourier = validCouriers.includes(courier) ? courier : 'econt'

    // ── Вмъкване на поръчка ────────────────────────────────────────────────
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
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
      })
      .select()
      .single()

    if (orderError) {
      console.error('❌ Order insert error:', orderError)
      throw new Error(`DB грешка: ${orderError.message}`)
    }

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
      // Не хвърляме грешка тук — поръчката е създадена, само items са проблем
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

    console.log('✅ Order created:', order.order_number)

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
