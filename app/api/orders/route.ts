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

    // 1. Валидация на входните данни
    if (!customer_name || !customer_phone || !customer_address || !customer_city) {
      return NextResponse.json({ error: 'Задължителните полета липсват' }, { status: 400 })
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Количката е празна' }, { status: 400 })
    }

    // 2. Записване на основната поръчка
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

    // 3. Подготовка и записване на продуктите в поръчката
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

    if (itemsError) {
      console.error('Грешка при запис на продуктите:', itemsError)
      // Връщаме грешка, но поръчката в главната таблица вече е създадена
    }

    // 4. Изпращане на известия (Асинхронно, за да не бавим отговора)
    // Използваме try/catch вътре, за да не сринем поръчката, ако имейлът се провали
    try {
      if (customer_email && process.env.RESEND_API_KEY) {
        await sendOrderConfirmationEmail(order, items)
      }
      if (process.env.RESEND_API_KEY) {
        await notifyAdmin(order)
      }
    } catch (mailErr) {
      console.error('Email error:', mailErr)
    }

    return NextResponse.json({
      success: true,
      order_number: order.order_number,
      order_id: order.id,
    })
  } catch (error: any) {
    console.error('Critical order error:', error)
    return NextResponse.json({ error: 'Грешка при обработка на поръчката.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page   = parseInt(searchParams.get('page')   || '1')
    const limit  = parseInt(searchParams.get('limit')  || '20')
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

    if (error) throw error

    return NextResponse.json({ orders: data, total: count, page, limit })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Помощни функции за имейли
async function sendOrderConfirmationEmail(order: any, items: any[]) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const itemsHtml = items.map(item =>
    `<tr><td style="padding:8px">${item.product_name}</td><td style="padding:8px">${item.quantity}</td><td style="padding:8px">${Number(item.total_price).toFixed(2)} €</td></tr>`
  ).join('')

  await resend.emails.send({
    from: 'Denny Angelow <noreply@dennyangelow.com>',
    to: order.customer_email,
    subject: `Поръчка ${order.order_number} — потвърдена ✓`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#2d6a4f">Благодарим за поръчката!</h1>
        <p>Номер на поръчка: <strong>${order.order_number}</strong></p>
        <table style="width:100%; border-collapse: collapse;">
          ${itemsHtml}
        </table>
        <p>Обща сума: ${Number(order.total).toFixed(2)} €</p>
      </div>
    `,
  })
}

async function notifyAdmin(order: any) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'System <noreply@dennyangelow.com>',
    to: process.env.ADMIN_EMAIL || 'support@dennyangelow.com',
    subject: `🛒 Нова поръчка ${order.order_number}`,
    html: `<p>Има нова поръчка от <strong>${order.customer_name}</strong> на стойност ${Number(order.total).toFixed(2)} €.</p>`,
  })
}