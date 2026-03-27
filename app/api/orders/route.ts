// app/api/orders/route.ts — v2 с rate limiting и подобрена валидация
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'
import { rateLimit, getIP } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limit: 3 поръчки от един IP за 10 минути
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
      payment_method, items, subtotal, shipping, total,
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

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_name: customer_name.trim(),
        customer_phone: customer_phone.trim(),
        customer_email: customer_email?.trim() || null,
        customer_address: customer_address.trim(),
        customer_city: customer_city.trim(),
        customer_notes: customer_notes?.trim() || null,
        payment_method: payment_method || 'cod',
        subtotal: Number(subtotal),
        shipping: Number(shipping),
        total: Number(total),
        utm_source: utm_source || null,
        utm_campaign: utm_campaign || null,
      })
      .select()
      .single()

    if (orderError) throw orderError

    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_name: item.product_name,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      total_price: Number(item.total_price),
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems)

    if (itemsError) throw itemsError

    if (customer_email) {
      await sendOrderConfirmationEmail(order, items).catch(console.error)
    }
    await notifyAdmin(order, items).catch(console.error)

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

async function sendOrderConfirmationEmail(order: any, items: any[]) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  const resend = new Resend(apiKey)

  const itemsHtml = items.map(item =>
    `<tr>
      <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6">${item.product_name}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:center">${item.quantity}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:right">${Number(item.total_price).toFixed(2)} лв.</td>
    </tr>`
  ).join('')

  await resend.emails.send({
    from: 'Denny Angelow <noreply@dennyangelow.com>',
    to: order.customer_email,
    subject: `✅ Поръчка ${order.order_number} е получена`,
    html: `
      <div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;color:#111">
        <div style="background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:36px;border-radius:12px 12px 0 0;text-align:center">
          <p style="font-size:36px;margin:0 0 8px">🍅</p>
          <h1 style="color:#fff;font-size:22px;margin:0 0 4px">Поръчката е получена!</h1>
          <p style="color:rgba(255,255,255,.7);font-size:13px;margin:0">${order.order_number}</p>
        </div>
        <div style="padding:28px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
          <p style="font-size:15px;margin:0 0 6px">Здравей, <strong>${order.customer_name}</strong>!</p>
          <p style="color:#6b7280;font-size:14px;margin:0 0 24px">Получихме твоята поръчка и ще се свържем в рамките на 24 часа за потвърждение.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700">Продукт</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700">Бр.</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700">Цена</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding:9px 12px;color:#6b7280;font-size:13px">Доставка</td>
                <td style="padding:9px 12px;text-align:right;color:#6b7280;font-size:13px">${Number(order.shipping).toFixed(2)} лв.</td>
              </tr>
              <tr style="border-top:2px solid #e5e7eb">
                <td colspan="2" style="padding:10px 12px;font-weight:800;font-size:16px">Общо</td>
                <td style="padding:10px 12px;text-align:right;font-weight:800;font-size:16px;color:#16a34a">${Number(order.total).toFixed(2)} лв.</td>
              </tr>
            </tfoot>
          </table>
          <div style="background:#f9fafb;border-radius:10px;padding:16px;font-size:14px">
            <p style="margin:0 0 4px"><strong>Адрес за доставка:</strong></p>
            <p style="margin:0;color:#374151">${order.customer_address}, ${order.customer_city}</p>
          </div>
          <p style="font-size:12px;color:#9ca3af;margin-top:28px;border-top:1px solid #eee;padding-top:16px">
            Въпроси? <a href="mailto:support@dennyangelow.com" style="color:#16a34a">support@dennyangelow.com</a>
          </p>
        </div>
      </div>
    `,
  })
}

async function notifyAdmin(order: any, items: any[]) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  const resend = new Resend(apiKey)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com'

  const itemsList = items.map(i => `• ${i.product_name} × ${i.quantity}`).join('\n')

  await resend.emails.send({
    from: 'System <noreply@dennyangelow.com>',
    to: process.env.ADMIN_EMAIL || 'support@dennyangelow.com',
    subject: `🛒 Нова поръчка ${order.order_number} — ${Number(order.total).toFixed(2)} лв.`,
    html: `
      <p><strong>${order.order_number}</strong> · ${Number(order.total).toFixed(2)} лв.</p>
      <p>${order.customer_name} · ${order.customer_phone}</p>
      <p>${order.customer_address}, ${order.customer_city}</p>
      <pre style="background:#f9fafb;padding:12px;border-radius:8px;font-size:13px">${itemsList}</pre>
      <p><a href="${siteUrl}/admin" style="background:#1b4332;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700">Отвори Admin панела →</a></p>
    `,
  })
}
