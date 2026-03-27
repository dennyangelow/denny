// app/api/orders/route.ts — v3 с евро и Еконт/Спиди

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import { rateLimit, getIP } from '@/lib/rate-limit'
import { orderConfirmationEmail, adminNotifyEmail } from '@/lib/email-templates'
import { COURIER_LABELS } from '@/lib/constants'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = rateLimit(`orders:${ip}`, { limit: 3, window: 600 })
  if (!rl.success) {
    return NextResponse.json(
      { error: `Твърде много заявки. Изчакай ${rl.resetIn} секунди.` },
      { status: 429, headers: { 'Retry-After': String(rl.resetIn) } }
    )
  }

  try {
    const body = await req.json()
    const {
      customer_name, customer_phone, customer_email,
      customer_address, customer_city, customer_notes,
      payment_method, courier,
      items, subtotal, shipping, total,
      utm_source, utm_campaign,
    } = body

    // Валидация
    if (!customer_name?.trim() || !customer_phone?.trim() ||
        !customer_address?.trim() || !customer_city?.trim()) {
      return NextResponse.json({ error: 'Задължителните полета липсват' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Количката е празна' }, { status: 400 })
    }
    if (isNaN(total) || total <= 0) {
      return NextResponse.json({ error: 'Невалидна сума' }, { status: 400 })
    }
    const validCouriers = Object.keys(COURIER_LABELS)
    const selectedCourier = validCouriers.includes(courier) ? courier : 'econt'

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
        subtotal:         Number(subtotal),
        shipping:         Number(shipping),
        total:            Number(total),
        utm_source:       utm_source || null,
        utm_campaign:     utm_campaign || null,
      })
      .select()
      .single()

    if (orderError) throw orderError

    const orderItems = items.map((item: any) => ({
      order_id:     order.id,
      product_name: item.product_name,
      quantity:     Number(item.quantity),
      unit_price:   Number(item.unit_price),
      total_price:  Number(item.total_price),
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems)

    if (itemsError) throw itemsError

    // Изпращаме имейли
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      const resend = new Resend(apiKey)
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com'

      if (customer_email) {
        const { subject, html } = orderConfirmationEmail({ order, items })
        await resend.emails.send({
          from: 'Denny Angelow <noreply@dennyangelow.com>',
          to: order.customer_email,
          subject,
          html,
        }).catch(console.error)
      }

      const adminEmail = process.env.ADMIN_EMAIL || 'support@dennyangelow.com'
      const { subject: as, html: ah } = adminNotifyEmail({ order, items, siteUrl })
      await resend.emails.send({
        from: 'System <noreply@dennyangelow.com>',
        to: adminEmail,
        subject: as,
        html: ah,
      }).catch(console.error)
    }

    return NextResponse.json({
      success: true,
      order_number: order.order_number,
      order_id: order.id,
    })
  } catch (error: any) {
    console.error('Order error:', error)
    return NextResponse.json({ error: 'Грешка при поръчката. Моля опитай отново.' }, { status: 500 })
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
