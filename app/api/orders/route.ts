// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      customer_name, customer_phone, customer_email,
      customer_address, customer_city, customer_notes,
      payment_method, items, subtotal, shipping, total,
      utm_source, utm_campaign,
    } = body

    if (!customer_name || !customer_phone || !customer_address || !customer_city) {
      return NextResponse.json({ error: 'Задължителните полета липсват' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Количката е празна' }, { status: 400 })
    }

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

    // Изпращане на имейли само ако имаме API ключ
    if (customer_email) {
      await sendOrderConfirmationEmail(order, items).catch(console.error)
    }
    await notifyAdmin(order).catch(console.error)

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
  const page   = parseInt(searchParams.get('page')  || '1')
  const limit  = parseInt(searchParams.get('limit') || '20')
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

async function sendOrderConfirmationEmail(order: any, items: any[]) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const resend = new Resend(apiKey) // Инициализираме тук
  const itemsHtml = items.map(item =>
    `<tr><td style="padding:8px">${item.product_name}</td><td style="padding:8px">${item.quantity}</td><td style="padding:8px">${Number(item.total_price).toFixed(2)} €</td></tr>`
  ).join('')

  await resend.emails.send({
    from: 'Denny Angelow <noreply@dennyangelow.com>',
    to: order.customer_email,
    subject: `Поръчка ${order.order_number} — потвърдена ✓`,
    html: `
      <div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;color:#111">
        <div style="background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:36px;border-radius:16px 16px 0 0;text-align:center">
          <p style="font-size:32px;margin:0">🍅</p>
          <h1 style="color:#fff;font-size:22px;margin:12px 0 4px">Поръчката е получена!</h1>
          <p style="color:rgba(255,255,255,.7);font-size:14px;margin:0">${order.order_number}</p>
        </div>
        <div style="padding:32px;background:#fff;border:1px solid #e5e7eb;border-top:none">
          <p style="font-size:16px">Здравей, <strong>${order.customer_name}</strong>!</p>
          <p style="color:#6b7280;font-size:14px">Получихме твоята поръчка и ще се свържем в рамките на 24 часа.</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
            <tr style="background:#f9fafb">
              <th style="padding:10px 8px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase">Продукт</th>
              <th style="padding:10px 8px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase">Бр.</th>
              <th style="padding:10px 8px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase">Цена</th>
            </tr>
            ${itemsHtml}
            <tr style="border-top:2px solid #e5e7eb;font-weight:700">
              <td colspan="2" style="padding:10px 8px">Общо с доставка</td>
              <td style="padding:10px 8px">${Number(order.total).toFixed(2)} €</td>
            </tr>
          </table>
          <p style="font-size:14px"><strong>Адрес:</strong> ${order.customer_address}, ${order.customer_city}</p>
          <p style="color:#6b7280;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">
            Въпроси? <a href="mailto:support@dennyangelow.com" style="color:#2d6a4f">support@dennyangelow.com</a>
          </p>
        </div>
      </div>
    `,
  })
}

async function notifyAdmin(order: any) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const resend = new Resend(apiKey) // Инициализираме тук
  await resend.emails.send({
    from: 'System <noreply@dennyangelow.com>',
    to: process.env.ADMIN_EMAIL || 'support@dennyangelow.com',
    subject: `🛒 Нова поръчка ${order.order_number} — ${Number(order.total).toFixed(2)} €`,
    html: `
      <p><strong>${order.order_number}</strong> · ${Number(order.total).toFixed(2)} €</p>
      <p>${order.customer_name} · ${order.customer_phone}</p>
      <p>${order.customer_address}, ${order.customer_city}</p>
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin">Отвори Admin панела →</a></p>
    `,
  })
}