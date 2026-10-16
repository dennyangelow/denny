// app/api/orders/[id]/route.ts — v9
// ✅ v8 → v9: audit log за tracking писмото (при "изпратена"), в същата
//    transactional_email_logs таблица като потвърждението/админ известието
//    (app/api/orders/route.ts v11). Изисква SQL миграцията от чата.
//
// v7 → v8 (запазено непроменено): tracking имейла вече използва ЕДИНИЯ
//    подател от Настройки вместо твърдо закодираното
//    'Denny Angelow <noreply@...>' — `from` вече не се подава → lib/mailer.ts
//    сам хваща buildFromHeader() от settings таблицата.
//
// v7 (запазено непроменено):
//   1. Данните в tracking имейла (име на клиент, номер на поръчка, номер за
//      проследяване) се escape-ват. Името идва от публичната форма за поръчка —
//      преди това можеше да съдържа HTML/линкове, които се вграждаха в имейла.
//   2. `courier` се приема само от списъка COURIER_LABELS.
//   3. Артикулите при post-purchase upsell се чистят (тип/дължина/граници).
//   4. Вътрешни грешки не се връщат дословно към клиента.
//
// ⚠️ PATCH и GET са само за admin (middleware.ts: '/api/orders' е защитен префикс;
//    публични са единствено POST /api/orders и POST /api/orders/[id]/notify).
//    Ако клиентската страница "благодаря" вика PATCH за upsell, тя ще получава 401 —
//    провери с една тестова поръчка дали post-purchase upsell реално се записва.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/mailer'
import { COURIER_LABELS } from '@/lib/constants'

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

// ✅ v9 — същата помощна функция като в orders/route.ts v11 (нарочно
// дублирана тук, а не изнесена в общ файл — двата route.ts файла си
// остават самостоятелни и лесни за четене поотделно; таблицата е една и
// съща). Грешка при логването никога не чупи заявката.
async function logTransactionalEmail(params: {
  order_id: string
  to_email: string
  kind: 'order_confirmation' | 'admin_notify' | 'tracking'
  subject: string
  success: boolean
  ses_message_id?: string | null
  error?: string | null
}) {
  await supabaseAdmin.from('transactional_email_logs').insert({
    order_id:       params.order_id,
    to_email:       params.to_email,
    kind:           params.kind,
    subject:        params.subject,
    success:        params.success,
    ses_message_id: params.ses_message_id || null,
    error:          params.error ? String(params.error).slice(0, 500) : null,
    sent_at:        new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.error('[transactional_email_logs] insert error:', error.message)
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id
    const body    = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Невалидна заявка' }, { status: 400 })
    }

    // ── 1. POST-PURCHASE UPSELL режим ────────────────────────────────────────
    if (body.add_items || body.add_to_total !== undefined) {
      const { add_items, offer_type, add_to_notes, add_to_total } = body

      const { data: order, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('id, total, customer_notes, offer_type, has_post_purchase_upsell')
        .eq('id', orderId)
        .single()

      if (fetchError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      if (add_items && Array.isArray(add_items) && add_items.length > 0) {
        const newItems = add_items.slice(0, 20).map((item: any) => {
          const name = String(item?.product_name ?? 'Продукт').slice(0, 200)
          return {
            order_id:     orderId,
            product_name: name.startsWith('[POST-PURCHASE]') ? name : `[POST-PURCHASE] ${name}`,
            quantity:     Math.min(100, Math.max(1, parseInt(String(item?.quantity ?? 1), 10) || 1)),
            unit_price:   Number(item?.unit_price)  >= 0 ? Number(item.unit_price)  : 0,
            total_price:  Number(item?.total_price) >= 0 ? Number(item.total_price) : (Number(item?.unit_price) || 0),
          }
        })

        const { error: itemsError } = await supabaseAdmin
          .from('order_items')
          .insert(newItems)

        if (itemsError) {
          console.error('Error inserting post-purchase items:', itemsError.message)
          return NextResponse.json({ error: 'Грешка при запис на артикулите' }, { status: 500 })
        }
      }

      const newTotal = (Number(order.total) || 0) + (Number(add_to_total) || 0)

      const newNotes = [order.customer_notes || '', typeof add_to_notes === 'string' ? add_to_notes.slice(0, 500) : '']
        .filter(Boolean).join(' ').trim()

      const existingOfferType = order.offer_type
      const finalOfferType = existingOfferType || (typeof offer_type === 'string' ? offer_type.slice(0, 60) : null) || null

      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          total:                    +newTotal.toFixed(2),
          offer_type:               finalOfferType,
          customer_notes:           newNotes || null,
          has_post_purchase_upsell: true,
          updated_at:               new Date().toISOString(),
        })
        .eq('id', orderId)

      if (updateError) {
        console.error('Error updating order (upsell):', updateError.message)
        return NextResponse.json({ error: 'Грешка при обновяване на поръчката' }, { status: 500 })
      }

      return NextResponse.json({ success: true, order_id: orderId, new_total: +newTotal.toFixed(2) })
    }

    // ── 2. STATUS / TRACKING UPDATE режим ────────────────────────────────────
    const updates: Record<string, any> = {}

    if (body.status !== undefined)          updates.status          = body.status
    if (body.payment_status !== undefined)  updates.payment_status  = body.payment_status
    if (body.tracking_number !== undefined) updates.tracking_number = body.tracking_number ? String(body.tracking_number).trim().slice(0, 60) : null
    if (body.courier !== undefined && Object.keys(COURIER_LABELS).includes(body.courier)) updates.courier = body.courier

    if (body.status === 'shipped')   updates.shipped_at   = new Date().toISOString()
    if (body.status === 'delivered') updates.delivered_at = new Date().toISOString()

    updates.updated_at = new Date().toISOString()

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

    // Tracking имейл при shipped (през Amazon SES, подателят от Настройки)
    // ✅ v9 — логваме опита в transactional_email_logs, успех или грешка.
    if (body.status === 'shipped' && data.customer_email && body.tracking_number) {
      const courierLabel = data.courier === 'speedy' ? 'Спиди' : 'Еконт'
      const trackingSubject = `🚚 Поръчка ${String(data.order_number ?? '').replace(/[\r\n]/g, ' ')} е изпратена`
      const trackingHtml = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
            <div style="background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:28px;border-radius:12px 12px 0 0;text-align:center">
              <p style="font-size:32px;margin:0">🚚</p>
              <h1 style="color:#fff;font-size:20px;margin:8px 0 0">Поръчката ти е на път!</h1>
            </div>
            <div style="padding:28px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
              <p>Здравей, <strong>${esc(data.customer_name)}</strong>!</p>
              <p>Поръчка <strong>${esc(data.order_number)}</strong> беше изпратена с <strong>${esc(courierLabel)}</strong>.</p>
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin:16px 0;text-align:center">
                <p style="font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;margin:0 0 6px">Номер за проследяване</p>
                <p style="font-size:20px;font-weight:900;color:#166534;font-family:monospace;margin:0">${esc(updates.tracking_number)}</p>
              </div>
              <p style="color:#6b7280;font-size:13px">Доставката е 1-2 работни дни за цяла България.</p>
            </div>
          </div>
        `
      try {
        const result = await sendEmail({ to: data.customer_email, subject: trackingSubject, html: trackingHtml })
        await logTransactionalEmail({
          order_id: orderId, to_email: data.customer_email, kind: 'tracking',
          subject: trackingSubject, success: true, ses_message_id: result.messageId,
        })
      } catch (e: any) {
        console.error('Tracking email error:', e?.message || e)
        await logTransactionalEmail({
          order_id: orderId, to_email: data.customer_email, kind: 'tracking',
          subject: trackingSubject, success: false, error: e?.message || e,
        })
      }
    }

    return NextResponse.json({ success: true, order: data })
  } catch (error: any) {
    console.error('PATCH /api/orders/[id] error:', error?.message || error)
    return NextResponse.json({ error: 'Грешка при обновяване на поръчката' }, { status: 500 })
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

  if (error) return NextResponse.json({ error: 'Не е намерена' }, { status: 404 })
  return NextResponse.json(data)
}
