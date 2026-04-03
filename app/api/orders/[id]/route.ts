// app/api/orders/[id]/route.ts — v4 MERGED
// ✅ PATCH поддържа 2 режима:
//    1. Status/tracking update (status, payment_status, tracking_number, courier)
//    2. Post-purchase upsell (add_items, add_to_total, offer_type, add_to_notes)
// ✅ Tracking имейл при shipped
// ✅ GET с order_items

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Resend } from 'resend'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id
    const body    = await req.json()

    // ── 1. POST-PURCHASE UPSELL режим ────────────────────────────────────────
    // Разпознаваме по наличието на add_items или add_to_total
    if (body.add_items || body.add_to_total !== undefined) {
      const {
        add_items,
        offer_type,
        add_to_notes,
        add_to_total,
      } = body

      // Взимаме оригиналната поръчка
      const { data: order, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single()

      if (fetchError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      // Добавяме новите items
      if (add_items && Array.isArray(add_items) && add_items.length > 0) {
        const newItems = add_items.map((item: any) => ({
          order_id:     orderId,
          product_name: item.product_name,
          quantity:     item.quantity,
          unit_price:   item.unit_price,
          total_price:  item.total_price,
        }))

        const { error: itemsError } = await supabaseAdmin
          .from('order_items')
          .insert(newItems)

        if (itemsError) {
          console.error('Error inserting post-purchase items:', itemsError)
          return NextResponse.json({ error: itemsError.message }, { status: 500 })
        }
      }

      // Update-ваме поръчката: total, offer_type, notes
      const newTotal = (order.total || 0) + (add_to_total || 0)
      const newNotes = [
        order.customer_notes || '',
        add_to_notes || '',
      ].filter(Boolean).join(' ').trim()

      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          total:                    +newTotal.toFixed(2),
          offer_type:               offer_type || order.offer_type || null,
          customer_notes:           newNotes || null,
          has_post_purchase_upsell: true,
          updated_at:               new Date().toISOString(),
        })
        .eq('id', orderId)

      if (updateError) {
        console.error('Error updating order (upsell):', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({
        success:   true,
        order_id:  orderId,
        new_total: newTotal,
      })
    }

    // ── 2. STATUS / TRACKING UPDATE режим ────────────────────────────────────
    const updates: Record<string, any> = {}

    if (body.status !== undefined)           updates.status           = body.status
    if (body.payment_status !== undefined)   updates.payment_status   = body.payment_status
    if (body.tracking_number !== undefined)  updates.tracking_number  = body.tracking_number || null
    if (body.courier !== undefined)          updates.courier          = body.courier

    if (body.status === 'shipped')    updates.shipped_at   = new Date().toISOString()
    if (body.status === 'delivered')  updates.delivered_at = new Date().toISOString()

    updates.updated_at = new Date().toISOString()

    // Ако няма реални промени (само updated_at), връщаме success без DB call
    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ success: true })
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single()

    if (error) throw error

    // Изпращаме tracking имейл при shipped
    if (body.status === 'shipped' && data.customer_email && body.tracking_number) {
      const apiKey = process.env.RESEND_API_KEY
      if (apiKey) {
        const resend = new Resend(apiKey)
        const courierLabel = data.courier === 'speedy' ? 'Спиди' : 'Еконт'
        await resend.emails.send({
          from: 'Denny Angelow <noreply@dennyangelow.com>',
          to: data.customer_email,
          subject: `🚚 Поръчка ${data.order_number} е изпратена`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
              <div style="background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:28px;border-radius:12px 12px 0 0;text-align:center">
                <p style="font-size:32px;margin:0">🚚</p>
                <h1 style="color:#fff;font-size:20px;margin:8px 0 0">Поръчката ти е на път!</h1>
              </div>
              <div style="padding:28px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
                <p>Здравей, <strong>${data.customer_name}</strong>!</p>
                <p>Поръчка <strong>${data.order_number}</strong> беше изпратена с <strong>${courierLabel}</strong>.</p>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin:16px 0;text-align:center">
                  <p style="font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;margin:0 0 6px">Номер за проследяване</p>
                  <p style="font-size:20px;font-weight:900;color:#166534;font-family:monospace;margin:0">${body.tracking_number}</p>
                </div>
                <p style="color:#6b7280;font-size:13px">Доставката е 1-2 работни дни за цяла България.</p>
              </div>
            </div>
          `,
        }).catch(console.error)
      }
    }

    return NextResponse.json({ success: true, order: data })
  } catch (error: any) {
    console.error('PATCH /api/orders/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}
