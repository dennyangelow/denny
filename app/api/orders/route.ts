import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      customer_name, customer_phone, customer_email,
      customer_address, customer_city, customer_notes,
      payment_method, items, subtotal, shipping, total,
      utm_source, utm_campaign,
    } = body

    // Validate
    if (!customer_name || !customer_phone || !customer_address || !customer_city) {
      return NextResponse.json({ error: 'Задължителните полета липсват' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Количката е празна' }, { status: 400 })
    }

    // Create order (order_number set by DB trigger)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        customer_address,
        customer_city,
        customer_notes: customer_notes || null,
        payment_method: payment_method || 'cod',
        subtotal,
        shipping,
        total,
        utm_source: utm_source || null,
        utm_campaign: utm_campaign || null,
      })
      .select()
      .single()

    if (orderError) throw orderError

    // Add order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems)

    if (itemsError) throw itemsError

    // Send confirmation email (via Resend)
    if (customer_email) {
      await sendOrderConfirmationEmail(order, items)
    }

    // Notify admin
    await notifyAdmin(order)

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
  // Admin only - protected by middleware
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 20
  const status = searchParams.get('status')

  let query = supabaseAdmin
    .from('orders')
    .select(`*, order_items(*)`)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ orders: data, total: count, page, limit })
}

async function sendOrderConfirmationEmail(order: any, items: any[]) {
  if (!process.env.RESEND_API_KEY) return
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  const itemsHtml = items.map(item =>
    `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td>${item.total_price.toFixed(2)} лв.</td></tr>`
  ).join('')

  await resend.emails.send({
    from: 'Denny Angelow <noreply@dennyangelow.com>',
    to: order.customer_email,
    subject: `Поръчка ${order.order_number} — потвърдена`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2d6a4f;">🍅 Поръчката е получена!</h1>
        <p>Здравей, <strong>${order.customer_name}</strong>!</p>
        <p>Получихме твоята поръчка с номер <strong>${order.order_number}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr style="background:#f3f4f6;"><th>Продукт</th><th>Кол.</th><th>Цена</th></tr>
          ${itemsHtml}
          <tr style="font-weight:bold;border-top:2px solid #e5e7eb;">
            <td colspan="2">Общо с доставка</td>
            <td>${order.total.toFixed(2)} лв.</td>
          </tr>
        </table>
        <p><strong>Доставка:</strong> ${order.customer_address}, ${order.customer_city}</p>
        <p><strong>Начин на плащане:</strong> ${order.payment_method === 'cod' ? 'Наложен платеж' : 'Банков превод'}</p>
        <p>Ще се свържем с теб в рамките на 24 часа за потвърждение.</p>
        <p style="color:#6b7280;font-size:13px;">При въпроси: support@dennyangelow.com</p>
      </div>
    `,
  })
}

async function notifyAdmin(order: any) {
  if (!process.env.RESEND_API_KEY) return
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: 'System <noreply@dennyangelow.com>',
    to: process.env.ADMIN_EMAIL || 'support@dennyangelow.com',
    subject: `🛒 Нова поръчка ${order.order_number} — ${order.total.toFixed(2)} лв.`,
    html: `
      <p><strong>${order.order_number}</strong></p>
      <p>${order.customer_name} · ${order.customer_phone}</p>
      <p>${order.customer_address}, ${order.customer_city}</p>
      <p><strong>Общо: ${order.total.toFixed(2)} лв.</strong></p>
    `,
  })
}
