// app/api/cron/discord-fallback/route.ts
// ✅ Vercel Cron — пуска се на всеки 5 минути
// Търси поръчки създадени преди >10 мин където discord_sent = false
// и ги изпраща директно от DB данните

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  // Защита — само Vercel Cron може да вика това
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const discordWebhook = process.env.DISCORD_WEBHOOK_URL
  if (!discordWebhook) {
    return NextResponse.json({ skipped: true, reason: 'no webhook' })
  }

  // Намираме поръчки с discord_sent = false, създадени преди >10 минути
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .eq('discord_sent', false)
    .lt('created_at', cutoff)
    .limit(10) // max 10 на един път

  if (error) {
    console.error('Cron DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let processed = 0

  for (const order of orders) {
    try {
      // Маркираме веднага за да не се изпрати два пъти
      await supabaseAdmin
        .from('orders')
        .update({ discord_sent: true })
        .eq('id', order.id)

      const sym = '€'
      const fmt = (n: number) => `${Number(n).toFixed(2)} ${sym}`
      const courierLabel = order.courier === 'speedy' ? 'Спиди 🚀' : 'Еконт 📦'

      const itemsText = (order.order_items || [])
        .map((i: any) => `> 📦 **${i.product_name}** — ${i.quantity} бр.\n> 💰 ${fmt(i.unit_price)} × ${i.quantity} = **${fmt(i.total_price)}**`)
        .join('\n') || '—'

      const embed = {
        title: `🛒 Поръчка #${order.order_number} ⚠️ fallback`,
        color: 0x6b7280,
        fields: [
          { name: '👤 Клиент',   value: `**${order.customer_name}**\n📞 ${order.customer_phone}`, inline: true },
          { name: '📍 Доставка', value: `${order.customer_city}\n${order.customer_address}\n${courierLabel}`, inline: true },
          { name: '💳 Плащане',  value: 'Наложен платеж 💵', inline: true },
          { name: '🛒 Артикули', value: itemsText, inline: false },
          { name: '💰 Общо',     value: `✅ **ОБЩО: ${fmt(order.total)}**`, inline: false },
        ],
        footer: { text: `⚠️ Изпратено от cron fallback (страницата е затворена преди изпращане)  •  dennyangelow.com` },
        timestamp: new Date().toISOString(),
      }

      await fetch(discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      })

      processed++
      console.log(`✅ Cron Discord fallback: поръчка #${order.order_number}`)

    } catch (e) {
      console.error(`Cron fallback грешка за поръчка ${order.id}:`, e)
    }
  }

  return NextResponse.json({ processed })
}
