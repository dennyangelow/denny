// app/api/orders/[id]/notify/route.ts — v4
//
// ✅ ПОПРАВКА: фактурата се чете от DB (order.invoice_data), не само от body
// ✅ Показва фактурния embed само ако wants_invoice = true / invoice_data е попълнен
// ✅ force=true заобикаля already_sent check (за admin ре-изпращане)
// ✅ discord_sent = true се записва САМО след успешно изпращане

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id
    const body = await req.json().catch(() => ({}))
    const force = body.force === true

    // ── 1. Вземаме поръчката от DB (с invoice_data!) ─────────────────────────
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) {
      console.error(`Discord notify: поръчка ${orderId} не е намерена`)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // ── 2. Already sent check (пропускаме при force=true) ────────────────────
    if (!force && order.discord_sent) {
      console.log(`Discord notify: поръчка #${order.order_number} вече е изпратена — skipped`)
      return NextResponse.json({ skipped: true, reason: 'already_sent' })
    }

    // ── 3. Проверяваме webhook ────────────────────────────────────────────────
    const discordWebhook = process.env.DISCORD_WEBHOOK_URL
    if (!discordWebhook) {
      console.error('❌ DISCORD_WEBHOOK_URL не е настроен в environment variables!')
      return NextResponse.json(
        { error: 'DISCORD_WEBHOOK_URL не е настроен. Добави го в Vercel Environment Variables.' },
        { status: 503 }
      )
    }

    // ── 4. Форматиране ────────────────────────────────────────────────────────
    const sym          = body.currency_symbol || '€'
    const fmt          = (n: number) => `${Number(n).toFixed(2)} ${sym}`
    const courierLabel = (order.courier || body.courier) === 'speedy' ? 'Спиди 🚀' : 'Еконт 📦'

    const dbItems   = (order.order_items || []) as any[]
    const bodyItems = Array.isArray(body.items) && body.items.length > 0 ? body.items : null
    const allItems  = bodyItems || dbItems

    const regularItems = allItems.filter((i: any) => !i.from_offer)
    const offerItems   = allItems.filter((i: any) => i.from_offer)

    const fmtItem = (i: any) => {
      const qty    = i.quantity ?? i.qty ?? 1
      const price  = i.unit_price ?? i.price ?? 0
      const tprice = i.total_price ?? (price * qty)
      const saving = i.compare_price && i.compare_price > price
        ? ` ~~${fmt(i.compare_price * qty)}~~` : ''
      const discBadge = i.offer_discount_pct ? ` **[-${i.offer_discount_pct}% оферта]**` : ''
      return `> 📦 **${i.product_name}** — ${qty} бр.\n> 💰 ${fmt(price)} × ${qty} = **${fmt(tprice)}**${saving}${discBadge}`
    }

    const regularLines = regularItems.length > 0
      ? regularItems.map(fmtItem).join('\n')
      : (dbItems.length > 0 ? dbItems.map(fmtItem).join('\n') : '—')

    const offerLines = offerItems.length > 0
      ? offerItems.map((i: any) => {
          const qty    = i.quantity ?? i.qty ?? 1
          const price  = i.unit_price ?? i.price ?? 0
          const tprice = i.total_price ?? (price * qty)
          const typeLabel = i.offer_type === 'cross_sell' ? '🔀 Cross-sell' : '⬆️ Cart Upsell'
          const saving = i.compare_price && i.compare_price > price
            ? ` ~~${fmt(i.compare_price * qty)}~~` : ''
          const discBadge = i.offer_discount_pct ? ` **[-${i.offer_discount_pct}%]**` : ''
          return `> ✨ **${i.product_name}** *(${typeLabel})* — ${qty} бр.\n> 💰 ${fmt(price)} × ${qty} = **${fmt(tprice)}**${saving}${discBadge}`
        }).join('\n')
      : null

    // Post-purchase (само от CartSystem body)
    const pp      = body.post_purchase || null
    const ppLines = pp
      ? (() => {
          const origLine = pp.original_price && pp.original_price > pp.unit_price
            ? ` ~~${fmt(pp.original_price)}~~` : ''
          const discLine = pp.discount_pct ? ` **[-${pp.discount_pct}% само веднъж!]**` : ''
          return `> ⚡ **${pp.product_name}** *(Post-Purchase)*\n> 💰 ${fmt(pp.unit_price)}${origLine}${discLine}`
        })()
      : null

    // Финансово резюме
    const subtotal     = Number(order.subtotal ?? body.subtotal ?? 0)
    const shipping     = Number(order.shipping ?? body.shipping ?? 0)
    const total        = Number(order.total    ?? body.total    ?? 0)
    const totalSavings = Number(body.total_savings || 0)
    const finalTotal   = pp ? total + pp.unit_price : total

    const totalSavingsWithPP = totalSavings +
      (pp?.original_price && pp.original_price > pp.unit_price
        ? pp.original_price - pp.unit_price : 0)

    const sumsValue = [
      `Продукти: **${fmt(subtotal)}**`,
      totalSavings > 0 ? `🏷️ Спестено (оферти): **-${fmt(totalSavings)}**` : null,
      `🚚 Доставка: **${shipping === 0 ? 'Безплатна 🎉' : fmt(shipping)}**`,
      ppLines ? `⚡ Post-Purchase добавен: **+${fmt(pp.unit_price)}**` : null,
      `\n━━━━━━━━━━━━━━━━━━`,
      `✅ **ОБЩО: ${fmt(finalTotal)}**`,
      totalSavingsWithPP > 0 ? `💚 Клиентът спести общо: **${fmt(totalSavingsWithPP)}**` : null,
    ].filter(Boolean).join('\n')

    // Offer badges
    const notes        = order.customer_notes || body.customer_notes || ''
    const hasUpsell    = body.has_upsell    || allItems.some((i: any) => i.from_offer && i.offer_type === 'cart_upsell') || notes.includes('[CART-UPSELL]')
    const hasCrossSell = body.has_cross_sell || allItems.some((i: any) => i.from_offer && i.offer_type === 'cross_sell') || notes.includes('[CROSS-SELL]')
    const offerSummary: string[] = []
    if (hasUpsell)                                               offerSummary.push('📈 Cart-Upsell')
    if (hasCrossSell)                                            offerSummary.push('🔀 Cross-sell')
    if (pp || notes.includes('[POST-PURCHASE'))                  offerSummary.push('⚡ Post-Purchase')

    // Цвят по стойност
    const color = finalTotal >= 300 ? 0xf59e0b
      : finalTotal >= 150 ? 0x16a34a
      : finalTotal >= 100 ? 0x0ea5e9
      : 0x64748b

    const titleSuffix = force ? ' *(admin resend)*' : ''

    // ── 5. Изграждане на Discord embed ────────────────────────────────────────
    const fields: any[] = [
      {
        name: '👤 Клиент',
        value: `**${order.customer_name}**\n📞 ${order.customer_phone}`,
        inline: true,
      },
      {
        name: '📍 Доставка',
        value: `${order.customer_city}\n${order.customer_address}\n${courierLabel}`,
        inline: true,
      },
      {
        name: '💳 Плащане',
        value: `Наложен платеж 💵${offerSummary.length > 0 ? '\n' + offerSummary.join('  ·  ') : ''}`,
        inline: true,
      },
      {
        name: '🛒 Поръчани артикули',
        value: regularLines,
        inline: false,
      },
    ]

    if (offerLines) {
      fields.push({ name: '✨ Добавени от оферта', value: offerLines, inline: false })
    }
    if (ppLines) {
      fields.push({ name: '⚡ Post-Purchase Upsell', value: ppLines, inline: false })
    }

    fields.push({ name: '💰 Финансово резюме', value: sumsValue, inline: false })

    // Показваме бележките без системните маркери
    const cleanNotes = notes
      .replace(/\[CART-UPSELL\]/g, '')
      .replace(/\[CROSS-SELL\]/g, '')
      .replace(/\[POST-PURCHASE[^\]]*\]/g, '')
      .trim()
    if (cleanNotes) {
      fields.push({ name: '💬 Бележка от клиента', value: cleanNotes, inline: false })
    }

    // ── ФАКТУРА: чете се ОТ DB (order.invoice_data), body само като fallback ──
    // ✅ ПОПРАВКА: вземаме данните от БД, не от body
    const invoiceData = order.invoice_data || body.invoice || null

    if (invoiceData && invoiceData.type && invoiceData.type !== 'none') {
      let invValue = ''
      if (invoiceData.type === 'company') {
        const vatLine = invoiceData.company_vat_registered
          ? `✅ ДДС регистрирана${invoiceData.company_vat_number ? ` · \`${invoiceData.company_vat_number}\`` : ''}`
          : '❌ Без ДДС регистрация'
        invValue = [
          `🏢 **${invoiceData.company_name || '—'}**`,
          invoiceData.company_eik     ? `ЕИК: \`${invoiceData.company_eik}\``         : null,
          invoiceData.company_mol     ? `МОЛ: ${invoiceData.company_mol}`               : null,
          invoiceData.company_address ? `Адрес: ${invoiceData.company_address}`         : null,
          vatLine,
        ].filter(Boolean).join('\n')
      } else if (invoiceData.type === 'person') {
        invValue = [
          `👤 **${invoiceData.person_names || '—'}**`,
          invoiceData.person_egn     ? `ЕГН: \`${invoiceData.person_egn}\``   : null,
          invoiceData.person_address ? `Адрес: ${invoiceData.person_address}` : null,
          invoiceData.person_phone   ? `Тел: ${invoiceData.person_phone}`     : null,
        ].filter(Boolean).join('\n')
      }

      if (invValue) {
        fields.push({
          name: `🧾 Фактура — ${invoiceData.type === 'company' ? 'Фирма' : 'Физ. лице'}`,
          value: invValue,
          inline: false,
        })
      }
    }

    const embed = {
      title: `🛒 Нова поръчка #${order.order_number}${titleSuffix}`,
      color,
      fields,
      footer: {
        text: `dennyangelow.com  •  ${new Date().toLocaleString('bg-BG', { timeZone: 'Europe/Sofia' })}${force ? '  •  ⚠️ Admin resend' : ''}`,
      },
      timestamp: new Date().toISOString(),
    }

    // ── 6. Изпращаме към Discord ──────────────────────────────────────────────
    const discordRes = await fetch(discordWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })

    if (!discordRes.ok) {
      const discordError = await discordRes.text().catch(() => '')
      console.error(`❌ Discord webhook грешка за #${order.order_number}: HTTP ${discordRes.status} — ${discordError}`)
      return NextResponse.json(
        { error: `Discord HTTP ${discordRes.status}: ${discordError}` },
        { status: 502 }
      )
    }

    // ── 7. Маркираме СЛЕД успешно изпращане ──────────────────────────────────
    await supabaseAdmin
      .from('orders')
      .update({ discord_sent: true })
      .eq('id', orderId)

    console.log(`✅ Discord изпратен за поръчка #${order.order_number}${force ? ' (admin force)' : ''}`)
    return NextResponse.json({ ok: true })

  } catch (error: any) {
    console.error('Discord notify error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
