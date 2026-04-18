// app/api/orders/[id]/notify/route.ts — v5 FINAL
//
// ✅ Всички артикули (вкл. post-purchase) се четат директно от DB order_items
// ✅ [POST-PURCHASE] префикс → показва се в Discord като отделен embed field
// ✅ [CART-UPSELL] и [CROSS-SELL] → показват се в "Добавени от оферта" field
// ✅ Чист product_name (без [POST-PURCHASE] префикс) в Discord
// ✅ discord_sent = true се записва САМО след успешно изпращане
// ✅ force=true заобикаля already_sent check (за admin ре-изпращане)

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

    // ── 1. Вземаме поръчката от DB с всички order_items ─────────────────────
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
      console.error('❌ DISCORD_WEBHOOK_URL не е настроен!')
      return NextResponse.json(
        { error: 'DISCORD_WEBHOOK_URL не е настроен. Добави го в Vercel Environment Variables.' },
        { status: 503 }
      )
    }

    // ── 4. Форматиране ────────────────────────────────────────────────────────
    const sym          = body.currency_symbol || '€'
    const fmt          = (n: number) => `${Number(n).toFixed(2)} ${sym}`
    const courierLabel = order.courier === 'speedy' ? 'Спиди 🚀' : 'Еконт 📦'

    // Взимаме артикулите ОТ DB — те съдържат post-purchase артикулите след PATCH
    const dbItems = (order.order_items || []) as any[]

    // Разпределяме артикулите по тип
    // [POST-PURCHASE] префикс = post-purchase upsell
    // from_offer = true + offer_type = cart_upsell/cross_sell = оферта от количката
    const postPurchaseItems = dbItems.filter((i: any) =>
      (i.product_name || '').startsWith('[POST-PURCHASE]') ||
      (i.product_name || '').toLowerCase().includes('(post-purchase')
    )

    // За cart upsell и cross-sell: проверяваме notes маркери + offer_type поле ако го има
    const notes = order.customer_notes || ''
    const hasCartUpsellMarker = notes.includes('[CART-UPSELL]') || notes.includes('[HAS-OFFER]')
    const hasCrossSellMarker  = notes.includes('[CROSS-SELL]')

    // От body.items вземаме from_offer флаговете (при нова поръчка)
    const bodyItems = Array.isArray(body.items) && body.items.length > 0 ? body.items : []

    // Правим map product_name → from_offer данни от body (за нови поръчки)
    const offerMap = new Map<string, { from_offer: boolean; offer_type?: string; compare_price?: number; offer_discount_pct?: number }>()
    for (const bi of bodyItems) {
      if (bi.from_offer) {
        offerMap.set(String(bi.product_name || ''), {
          from_offer: true,
          offer_type: bi.offer_type,
          compare_price: bi.compare_price,
          offer_discount_pct: bi.offer_discount_pct,
        })
      }
    }

    // Разпределяме DB артикулите в 3 групи
    const regularItems: any[]     = []
    const cartOfferItems: any[]   = []
    const ppItems: any[]          = []

    for (const item of dbItems) {
      const name = item.product_name || ''
      // Post-purchase: [POST-PURCHASE] префикс
      if (name.startsWith('[POST-PURCHASE]') || name.toLowerCase().includes('(post-purchase')) {
        ppItems.push(item)
        continue
      }
      // Оферта от количката: from_offer в body map
      const offerInfo = offerMap.get(name)
      if (offerInfo?.from_offer) {
        cartOfferItems.push({ ...item, ...offerInfo })
        continue
      }
      // Обикновен артикул
      regularItems.push(item)
    }

    // Ако нямаме from_offer данни от body, използваме heuristics
    // (-X%) в края на имото = cross-sell; upsell в имото = cart-upsell
    const finalRegular: any[]   = []
    const finalCartOffer: any[] = [...cartOfferItems]

    for (const item of regularItems) {
      const name = item.product_name || ''
      if (hasCrossSellMarker && /\(-\d+%\)/.test(name)) {
        finalCartOffer.push({ ...item, from_offer: true, offer_type: 'cross_sell' })
      } else if (hasCartUpsellMarker && name.toLowerCase().includes('upsell')) {
        finalCartOffer.push({ ...item, from_offer: true, offer_type: 'cart_upsell' })
      } else {
        finalRegular.push(item)
      }
    }

    // ── Форматиране на редове ────────────────────────────────────────────────
    const fmtItem = (i: any) => {
      const qty    = i.quantity ?? 1
      const price  = Number(i.unit_price  ?? 0)
      const tprice = Number(i.total_price ?? price * qty)
      const saving = i.compare_price && Number(i.compare_price) > price
        ? ` ~~${fmt(Number(i.compare_price) * qty)}~~` : ''
      const discBadge = i.offer_discount_pct ? ` **[-${i.offer_discount_pct}%]**` : ''
      // Чист product_name — без [POST-PURCHASE] префикс
      const cleanName = String(i.product_name || '').replace(/^\[POST-PURCHASE\]\s*/, '')
      return `> 📦 **${cleanName}** — ${qty} бр.\n> 💰 ${fmt(price)} × ${qty} = **${fmt(tprice)}**${saving}${discBadge}`
    }

    const regularLines = finalRegular.length > 0
      ? finalRegular.map(fmtItem).join('\n')
      : '—'

    const cartOfferLines = finalCartOffer.length > 0
      ? finalCartOffer.map((i: any) => {
          const qty    = i.quantity ?? 1
          const price  = Number(i.unit_price  ?? 0)
          const tprice = Number(i.total_price ?? price * qty)
          const typeLabel = i.offer_type === 'cross_sell' ? '🔀 Cross-sell' : '⬆️ Cart Upsell'
          const saving = i.compare_price && Number(i.compare_price) > price
            ? ` ~~${fmt(Number(i.compare_price) * qty)}~~` : ''
          const discBadge = i.offer_discount_pct ? ` **[-${i.offer_discount_pct}%]**` : ''
          const cleanName = String(i.product_name || '').replace(/^\[POST-PURCHASE\]\s*/, '')
          return `> ✨ **${cleanName}** *(${typeLabel})* — ${qty} бр.\n> 💰 ${fmt(price)} × ${qty} = **${fmt(tprice)}**${saving}${discBadge}`
        }).join('\n')
      : null

    // Post-purchase items от DB
    const ppLines = ppItems.length > 0
      ? ppItems.map((i: any) => {
          const qty    = i.quantity ?? 1
          const price  = Number(i.unit_price  ?? 0)
          const tprice = Number(i.total_price ?? price * qty)
          const cleanName = String(i.product_name || '').replace(/^\[POST-PURCHASE\]\s*/, '')
          // Проверяваме дали има body.post_purchase за discount info
          const pp = body.post_purchase
          const origLine = pp?.original_price && Number(pp.original_price) > price
            ? ` ~~${fmt(Number(pp.original_price))}~~` : ''
          const discLine = pp?.discount_pct ? ` **[-${pp.discount_pct}% само веднъж!]**` : ''
          return `> ⚡ **${cleanName}** *(Post-Purchase)* — ${qty} бр.\n> 💰 ${fmt(price)} × ${qty} = **${fmt(tprice)}**${origLine}${discLine}`
        }).join('\n')
      : null

    // ── Финансово резюме ─────────────────────────────────────────────────────
    const subtotal     = Number(order.subtotal ?? 0)
    const shipping     = Number(order.shipping ?? 0)
    const total        = Number(order.total    ?? 0)
    const totalSavings = Number(body.total_savings || 0)

    // Изчисляваме PP добавката от ppItems (те са вече включени в order.total след PATCH)
    const ppTotal = ppItems.reduce((s: number, i: any) => s + Number(i.total_price ?? 0), 0)
    // subtotal_without_pp = total - shipping - ppTotal (ако искаме да го покажем)
    const mainSubtotal = subtotal > 0 ? subtotal : (total - shipping - ppTotal)

    const ppSavings = body.post_purchase?.original_price && body.post_purchase.original_price > (body.post_purchase.unit_price ?? 0)
      ? Number(body.post_purchase.original_price) - Number(body.post_purchase.unit_price ?? 0)
      : 0
    const totalSavingsWithPP = totalSavings + ppSavings

    const sumsLines: string[] = [
      `Продукти: **${fmt(mainSubtotal)}**`,
    ]
    if (finalCartOffer.length > 0) {
      const offerTotal = finalCartOffer.reduce((s: number, i: any) => s + Number(i.total_price ?? 0), 0)
      sumsLines.push(`✨ Оферти (cart/cross): **${fmt(offerTotal)}**`)
    }
    if (totalSavings > 0) sumsLines.push(`🏷️ Спестено (оферти): **-${fmt(totalSavings)}**`)
    sumsLines.push(`🚚 Доставка: **${shipping === 0 ? 'Безплатна 🎉' : fmt(shipping)}**`)
    if (ppLines && ppTotal > 0) sumsLines.push(`⚡ Post-Purchase добавен: **+${fmt(ppTotal)}**`)
    sumsLines.push(`\n━━━━━━━━━━━━━━━━━━`)
    sumsLines.push(`✅ **ОБЩО: ${fmt(total)}**`)
    if (totalSavingsWithPP > 0) sumsLines.push(`💚 Клиентът спести общо: **${fmt(totalSavingsWithPP)}**`)

    const sumsValue = sumsLines.join('\n')

    // ── Offer badges ─────────────────────────────────────────────────────────
    const hasUpsell    = body.has_upsell    || finalCartOffer.some((i: any) => i.offer_type === 'cart_upsell') || hasCartUpsellMarker
    const hasCrossSell = body.has_cross_sell || finalCartOffer.some((i: any) => i.offer_type === 'cross_sell') || hasCrossSellMarker
    const hasPP        = ppItems.length > 0 || notes.includes('[POST-PURCHASE') || order.has_post_purchase_upsell

    const offerSummary: string[] = []
    if (hasUpsell)    offerSummary.push('⬆️ Cart-Upsell')
    if (hasCrossSell) offerSummary.push('🔀 Cross-sell')
    if (hasPP)        offerSummary.push('⚡ Post-Purchase')

    // Цвят по стойност
    const color = total >= 300 ? 0xf59e0b
      : total >= 150 ? 0x16a34a
      : total >= 100 ? 0x0ea5e9
      : 0x64748b

    const titleSuffix = force ? ' *(admin resend)*' : ''

    // ── 5. Discord embed fields ───────────────────────────────────────────────
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

    if (cartOfferLines) {
      fields.push({ name: '✨ Добавени от оферта (Ъпсел / Крос-сел)', value: cartOfferLines, inline: false })
    }

    if (ppLines) {
      fields.push({ name: '⚡ Post-Purchase Upsell', value: ppLines, inline: false })
    }

    fields.push({ name: '💰 Финансово резюме', value: sumsValue, inline: false })

    // Бележки (без системни маркери)
    const cleanNotes = notes
      .replace(/\[CART-UPSELL\]/g, '')
      .replace(/\[CROSS-SELL\]/g, '')
      .replace(/\[POST-PURCHASE[^\]]*\]/g, '')
      .trim()
    if (cleanNotes) {
      fields.push({ name: '💬 Бележка от клиента', value: cleanNotes, inline: false })
    }

    // Фактура (от DB)
    const invoiceData = order.invoice_data || order.invoice || body.invoice || null
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
      const errText = await discordRes.text().catch(() => '')
      console.error(`❌ Discord webhook грешка #${order.order_number}: HTTP ${discordRes.status} — ${errText}`)
      return NextResponse.json(
        { error: `Discord HTTP ${discordRes.status}: ${errText}` },
        { status: 502 }
      )
    }

    // ── 7. Маркираме след успешно изпращане ───────────────────────────────────
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
