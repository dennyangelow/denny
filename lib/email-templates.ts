// lib/email-templates.ts — централни имейл шаблони

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com'

const baseWrapper = (content: string) => `
<div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;background:#ffffff">
  <div style="background:linear-gradient(135deg,#0f1f16,#2d6a4f);padding:32px;text-align:center;border-radius:12px 12px 0 0">
    <p style="font-size:36px;margin:0 0 6px">🍅</p>
    <p style="color:rgba(255,255,255,.5);font-size:12px;margin:0;letter-spacing:.06em;text-transform:uppercase">Denny Angelow · Агро Консултант</p>
  </div>
  <div style="padding:32px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
    ${content}
  </div>
  <div style="padding:20px 32px;text-align:center">
    <p style="font-size:12px;color:#9ca3af;margin:0">
      Имаш въпроси? <a href="mailto:support@dennyangelow.com" style="color:#16a34a">support@dennyangelow.com</a>
    </p>
  </div>
</div>`

const unsubLink = (email: string) =>
  `<a href="${SITE_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color:#9ca3af">отпиши се тук</a>`

const footer = (email: string) => `
<hr style="border:none;border-top:1px solid #eee;margin:24px 0">
<p style="font-size:12px;color:#9ca3af;margin:0">
  Получаваш този имейл защото се регистрира на dennyangelow.com.<br>
  Не желаеш повече? ${unsubLink(email)}.
</p>`

// ── Welcome email ───────────────────────────────────────────
export function welcomeEmail(opts: {
  email: string
  name?: string
  slug: string
}): { subject: string; html: string } {
  const greeting = opts.name ? `Здравей, ${opts.name}!` : 'Здравей!'
  const downloadUrl = `${SITE_URL}/naruchnik/${opts.slug}`
  return {
    subject: '📗 Твоят безплатен наръчник е тук!',
    html: baseWrapper(`
      <h1 style="font-size:22px;font-weight:800;margin:0 0 8px;color:#111">${greeting}</h1>
      <p style="font-size:15px;color:#374151;margin:0 0 24px">
        Благодарим ти! Наръчникът ти е готов за сваляне — кликни по-долу.
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="${downloadUrl}" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:16px 36px;border-radius:12px;text-decoration:none;font-weight:900;font-size:16px;display:inline-block">
          📥 Изтегли наръчника →
        </a>
      </div>
      <p style="font-size:14px;color:#6b7280;margin:24px 0 0">
        В следващите дни ще получаваш от нас практични агро съвети директно в имейла. 🌱
      </p>
      ${footer(opts.email)}
    `),
  }
}

// ── Follow-up day 2 ─────────────────────────────────────────
export function followUp2Email(opts: {
  email: string
  name?: string
  slug: string
}): { subject: string; html: string } {
  const hi = opts.name ? `${opts.name}` : 'приятелю'
  const downloadUrl = `${SITE_URL}/naruchnik/${opts.slug}`
  return {
    subject: '🌱 Успя ли да прочетеш наръчника?',
    html: baseWrapper(`
      <h1 style="font-size:20px;font-weight:800;margin:0 0 12px;color:#111">
        ${hi}, успя ли да разгледаш наръчника?
      </h1>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">
        Преди 2 дни ти изпратих безплатния наръчник. Надявам се да е полезен! 📗
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px">
        Ако не си имал/а възможност да го разгледаш, ето линкът отново:
      </p>
      <div style="text-align:center;margin:20px 0">
        <a href="${downloadUrl}" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:900;font-size:15px;display:inline-block">
          📥 Отвори наръчника →
        </a>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px;margin:20px 0">
        <p style="font-size:13px;font-weight:800;color:#15803d;margin:0 0 10px;text-transform:uppercase;letter-spacing:.04em">
          💡 Съвет на деня
        </p>
        <p style="font-size:14px;color:#166534;margin:0;line-height:1.6">
          Добавянето на органично вещество в почвата преди засаждане може да увеличи добива с до 30%. 
          Atlas Terra помага точно с това.
        </p>
      </div>
      ${footer(opts.email)}
    `),
  }
}

// ── Follow-up day 5 ─────────────────────────────────────────
export function followUp5Email(opts: {
  email: string
  name?: string
}): { subject: string; html: string } {
  const hi = opts.name ? `${opts.name}` : 'приятелю'
  return {
    subject: '🍅 Топ 3 грешки при отглеждане на домати',
    html: baseWrapper(`
      <h1 style="font-size:20px;font-weight:800;margin:0 0 12px;color:#111">
        Топ 3 грешки, ${hi}
      </h1>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px">
        След разговори с хиляди фермери, ето най-честите грешки при домати:
      </p>
      ${['Поливане по листата вместо по корена — причинява листни болести', 
         'Торене само с азот — без калций и магнезий плодовете гният', 
         'Пропускане на профилактично пръскане — лечението е 10x по-скъпо от превенцията']
        .map((err, i) => `
          <div style="display:flex;gap:12px;margin-bottom:14px;align-items:flex-start">
            <div style="background:#ef4444;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0;margin-top:1px">${i+1}</div>
            <p style="font-size:14px;color:#374151;margin:0;line-height:1.6">${err}</p>
          </div>`).join('')}
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:20px 0">
        В наръчника са описани всички решения подробно. Ако имаш въпроси, отговарям лично.
      </p>
      <div style="text-align:center;margin:20px 0">
        <a href="${SITE_URL}/#products" style="background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:900;font-size:15px;display:inline-block">
          🛒 Виж препоръчаните продукти →
        </a>
      </div>
      ${footer(opts.email)}
    `),
  }
}

// ── Follow-up day 10 ────────────────────────────────────────
export function followUp10Email(opts: {
  email: string
  name?: string
}): { subject: string; html: string } {
  const hi = opts.name ? `${opts.name}` : 'приятелю'
  return {
    subject: '🎁 Специална оферта само за теб',
    html: baseWrapper(`
      <h1 style="font-size:20px;font-weight:800;margin:0 0 12px;color:#111">
        ${hi}, имам нещо специално за теб
      </h1>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">
        Вече 10 дни от нашето запознанство. Радвам се, че следиш съветите ми!
      </p>
      <div style="background:linear-gradient(135deg,#0f1f16,#2d6a4f);border-radius:16px;padding:24px;text-align:center;margin:20px 0">
        <p style="color:#86efac;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">Специална оферта</p>
        <p style="color:#fff;font-size:22px;font-weight:900;margin:0 0 4px">Atlas Terra пакет</p>
        <p style="color:rgba(255,255,255,.7);font-size:14px;margin:0 0 20px">Atlas Terra + Atlas Terra AMINO</p>
        <a href="${SITE_URL}/#atlas" style="background:linear-gradient(135deg,#4ade80,#22c55e);color:#052e16;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:900;font-size:15px;display:inline-block">
          Поръчай сега →
        </a>
      </div>
      <p style="font-size:13px;color:#6b7280;text-align:center;margin:12px 0 0">
        Безплатна доставка при поръчка над 60 €
      </p>
      ${footer(opts.email)}
    `),
  }
}

// ── Abandoned order reminder ────────────────────────────────
export function abandonedOrderEmail(opts: {
  email: string
  name?: string
  orderNumber: string
}): { subject: string; html: string } {
  return {
    subject: `⚠️ Поръчка ${opts.orderNumber} чака потвърждение`,
    html: baseWrapper(`
      <h1 style="font-size:20px;font-weight:800;margin:0 0 12px;color:#111">
        Имаш ли въпроси за поръчката?
      </h1>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">
        Здравей${opts.name ? `, ${opts.name}` : ''}! Поръчката ти <strong>${opts.orderNumber}</strong> е при нас, 
        но все още чака обработка.
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px">
        Ако имаш въпроси или искаш да промениш нещо — отговарям лично на имейла.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px;margin:20px 0;text-align:center">
        <p style="font-size:14px;color:#166534;margin:0 0 12px">Свържи се с нас директно:</p>
        <a href="mailto:support@dennyangelow.com" style="color:#16a34a;font-weight:700;font-size:15px">
          support@dennyangelow.com
        </a>
      </div>
      ${footer(opts.email)}
    `),
  }
}

// ── Order confirmation ──────────────────────────────────────
export function orderConfirmationEmail(opts: {
  order: {
    order_number: string
    customer_name: string
    customer_email: string
    customer_address: string
    customer_city: string
    shipping: number
    total: number
    courier?: string
  }
  items: { product_name: string; quantity: number; total_price: number }[]
}): { subject: string; html: string } {
  const { order, items } = opts
  const itemsHtml = items.map(item =>
    `<tr>
      <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6">${item.product_name}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:center">${item.quantity}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:right">${Number(item.total_price).toFixed(2)} €</td>
    </tr>`
  ).join('')

  const courierLabel = order.courier === 'speedy' ? 'Спиди' : 'Еконт'

  return {
    subject: `✅ Поръчка ${order.order_number} е получена`,
    html: baseWrapper(`
      <p style="font-size:15px;margin:0 0 6px">Здравей, <strong>${order.customer_name}</strong>!</p>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
        Получихме твоята поръчка и ще се свържем в рамките на 24 часа за потвърждение.
      </p>
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
            <td colspan="2" style="padding:9px 12px;color:#6b7280;font-size:13px">Доставка (${courierLabel})</td>
            <td style="padding:9px 12px;text-align:right;color:#6b7280;font-size:13px">${Number(order.shipping).toFixed(2)} €</td>
          </tr>
          <tr style="border-top:2px solid #e5e7eb">
            <td colspan="2" style="padding:10px 12px;font-weight:800;font-size:16px">Общо</td>
            <td style="padding:10px 12px;text-align:right;font-weight:800;font-size:16px;color:#16a34a">${Number(order.total).toFixed(2)} €</td>
          </tr>
        </tfoot>
      </table>
      <div style="background:#f9fafb;border-radius:10px;padding:16px;font-size:14px">
        <p style="margin:0 0 4px"><strong>Адрес за доставка:</strong></p>
        <p style="margin:0;color:#374151">${order.customer_address}, ${order.customer_city}</p>
      </div>
      ${footer(order.customer_email)}
    `),
  }
}

// ── Admin notification ──────────────────────────────────────
export function adminNotifyEmail(opts: {
  order: { order_number: string; customer_name: string; customer_phone: string; customer_address: string; customer_city: string; total: number; courier?: string }
  items: { product_name: string; quantity: number }[]
  siteUrl: string
}): { subject: string; html: string } {
  const { order, items, siteUrl } = opts
  const itemsList = items.map(i => `• ${i.product_name} × ${i.quantity}`).join('<br>')
  const courierLabel = order.courier === 'speedy' ? 'Спиди' : 'Еконт'

  return {
    subject: `🛒 Нова поръчка ${order.order_number} — ${Number(order.total).toFixed(2)} €`,
    html: `
      <p><strong>${order.order_number}</strong> · ${Number(order.total).toFixed(2)} € · ${courierLabel}</p>
      <p>${order.customer_name} · ${order.customer_phone}</p>
      <p>${order.customer_address}, ${order.customer_city}</p>
      <div style="background:#f9fafb;padding:12px;border-radius:8px;font-size:13px;margin:12px 0">${itemsList}</div>
      <a href="${siteUrl}/admin" style="background:#1b4332;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">
        Отвори Admin панела →
      </a>
    `,
  }
}
