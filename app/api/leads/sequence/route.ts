// app/api/leads/sequence/route.ts — v3
// ✅ ПРОМЯНА спрямо v2: naruchnik-специфичният sequence блок (стъпки 2/5/10
//    по email_sequence_steps) е ПРЕМАХНАТ оттук — сега живее в
//    app/api/automations/tick/route.ts (виж lib/automations.ts), защото
//    вече е конфигурируем от админ панела ("Naruchnik — Welcome серия"
//    workflow) вместо hardcoded тук. Двата endpoint-а да текат ЕДНОВРЕМЕННО
//    щеше да дублира имейли — оставяш само единия активен за naruchnik.
//
//    Abandoned order + abandoned cart логиката ОСТАВА тук непроменена —
//    все още не са мигрирани към новия workflow модел (Фаза 3 от плана).
//
// ⚠️ Викан от Supabase pg_cron hourly, успоредно с новия
//    /api/automations/tick — виж бележката там за добавяне на втори cron job.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/mailer'

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${cronSecret}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now    = new Date()
  let sent     = 0
  const errors: string[] = []

  try {
    // Abandoned order check — поръчки "new" > 24 часа без обработка
    const abandonedCutoff = new Date(now.getTime() - 24 * 3600000).toISOString()
    const { data: abandonedOrders } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, customer_email, customer_name')
      .eq('status', 'new')
      .lt('created_at', abandonedCutoff)
      .not('customer_email', 'is', null)

    for (const order of (abandonedOrders || [])) {
      if (!order.customer_email) continue

      const { data: alreadySent } = await supabaseAdmin
        .from('email_logs')
        .select('id')
        .eq('sequence_name', 'abandoned_order')
        .eq('step_number', 1)
        .eq('lead_id', order.id)
        .maybeSingle()

      if (alreadySent) continue

      try {
        await sendEmail({
          to:      order.customer_email,
          subject: `⚠️ Поръчка ${order.order_number} чака потвърждение`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
              <div style="background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:24px;border-radius:12px 12px 0 0;text-align:center">
                <p style="font-size:30px;margin:0">📦</p>
                <h1 style="color:#fff;font-size:18px;margin:8px 0 0">Имаш ли въпроси за поръчката?</h1>
              </div>
              <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
                <p>Здравей${order.customer_name ? `, <strong>${order.customer_name}</strong>` : ''}!</p>
                <p>Поръчката ти <strong>${order.order_number}</strong> е при нас, но все още чака обработка.</p>
                <p>Ако имаш въпроси или искаш да промениш нещо — пиши ни директно.</p>
                <div style="text-align:center;margin:20px 0">
                  <a href="mailto:support@dennyangelow.com" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700">
                    Свържи се с нас →
                  </a>
                </div>
              </div>
            </div>
          `,
        })
        sent++
      } catch (e: any) {
        errors.push(`Abandoned ${order.order_number}: ${e.message}`)
      }
    }

    // Abandoned CART check — draft-и (email въведен, но поръчка никога не
    // е завършена) на повече от 2 часа, без вече изпратен reminder.
    const cartCutoff = new Date(now.getTime() - 2 * 3600000).toISOString()
    const { data: abandonedCarts } = await supabaseAdmin
      .from('abandoned_carts')
      .select('id, email, name, items, total')
      .eq('converted', false)
      .is('reminded_at', null)
      .lt('updated_at', cartCutoff)

    for (const cart of (abandonedCarts || [])) {
      try {
        const itemsList = (cart.items as { product_name: string; quantity: number }[])
          .map(i => `• ${i.product_name} × ${i.quantity}`).join('<br>')

        await sendEmail({
          to:      cart.email,
          subject: '🛒 Забрави нещо в количката си?',
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
              <div style="background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:24px;border-radius:12px 12px 0 0;text-align:center">
                <p style="font-size:30px;margin:0">🛒</p>
                <h1 style="color:#fff;font-size:18px;margin:8px 0 0">Количката ти те чака</h1>
              </div>
              <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
                <p>Здравей${cart.name ? `, <strong>${cart.name}</strong>` : ''}!</p>
                <p>Забеляза, че си оставил/а следните продукти в количката си:</p>
                <div style="background:#f9fafb;border-radius:10px;padding:14px 18px;margin:16px 0;font-size:14px;line-height:1.8">
                  ${itemsList}
                  <p style="margin-top:10px;font-weight:800;border-top:1px solid #eee;padding-top:8px">Общо: ${Number(cart.total).toFixed(2)} €</p>
                </div>
                <div style="text-align:center;margin:20px 0">
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com'}/#products" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700">
                    Довърши поръчката →
                  </a>
                </div>
              </div>
            </div>
          `,
        })

        await supabaseAdmin.from('abandoned_carts')
          .update({ reminded_at: now.toISOString() })
          .eq('id', cart.id)

        sent++
      } catch (e: any) {
        errors.push(`Cart ${cart.email}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    })
  } catch (err: any) {
    console.error('Sequence error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
