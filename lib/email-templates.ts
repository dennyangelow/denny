// lib/email-templates.ts — v2
//
// ПОПРАВКИ v2 (спрямо v1):
//   ✅ Unsubscribe линкът вече носи подписан &token= (lib/unsubscribe-token.ts)
//      — /api/leads/unsubscribe/route.ts v2 вече изисква валиден token,
//      иначе всеки, който познае/открадне чужд email, може да го отпише.
//      Това прави unsubLink()/footer() async (crypto.subtle е async) —
//      wrapper() е СПЕЦИАЛНО оставен sync и взима готов footerHtml низ,
//      за да не стане async и orderConfirmationEmail/adminNotifyEmail
//      (които не пращат unsub линк изобщо и нямат нужда от await верига).
//      Засегнатите функции (welcomeEmail, followUp2/5/10Email,
//      abandonedOrderEmail, abandonedCartEmail) вече са async — виж
//      call site-овете в lib/automations.ts и app/api/leads/route.ts.
//   ✅ welcomeEmail() "Вътре ще намериш" списъкът твърдеше неща, които ги
//      няма в реалните PDF-и — "пълен календар" (реално е схема по фази),
//      "органични методи" (PDF-ите дават и химична защита — Ридомил Голд,
//      Топаз, Кораген и т.н.), и "тайните на двойния добив" (недоказано,
//      никъде не се появява такова число). Пренаписано да отговаря на
//      реалното съдържание — вярно е и за двата наръчника (домати/
//      краставици), защото функцията е generic по slug.
//   ✅ followUp10Email() препоръчваше "Органичен фунгицид" и "Течен хумат
//      + фулвати" — и двете не съществуват в реалния каталог (виж
//      lib/marketing-data.ts PRODUCTS). Заменени с трите продукта, които
//      реално са в каталога (Амалгерол, Турбо Рут, Калитех).

import { createUnsubscribeToken } from '@/lib/unsubscribe-token'

interface EmailParams {
  email: string
  name?: string
  slug?: string
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com'

function greeting(name?: string) {
  return name ? `Здравей, ${name}!` : 'Здравей!'
}

async function unsubLink(email: string): Promise<string> {
  const token = await createUnsubscribeToken(email)
  return `${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`
}

async function footer(email: string): Promise<string> {
  return `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
    <p style="font-size:12px;color:#9ca3af;text-align:center">
      Получаваш този имейл, защото се регистрира на dennyangelow.com.<br>
      <a href="${await unsubLink(email)}" style="color:#9ca3af">Отпиши се тук</a>
    </p>
  `
}

// ✅ wrapper() остава СИНХРОНЕН нарочно — взима вече готов footerHtml низ
// (изчислен от извикващата функция с await footer(email)), вместо сам да
// вика async footer() вътрешно. Това пази orderConfirmationEmail() (която
// вика wrapper() без email, без unsub линк) синхронна — без ripple ефект
// към нейния неизвестен на мен caller.
function wrapper(content: string, footerHtml: string = '') {
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
      <div style="background:linear-gradient(135deg,#0f1f16,#1b4332);padding:28px 32px;text-align:center">
        <p style="font-size:28px;margin:0">🍅</p>
        <p style="color:rgba(255,255,255,.8);font-size:13px;margin:8px 0 0">Denny Angelow — Агро Консултант</p>
      </div>
      <div style="padding:28px 32px">
        ${content}
      </div>
      ${footerHtml}
    </div>
  `
}

// ─── Welcome (Step 1) ───────────────────────────────────────────────
export async function welcomeEmail({ email, name, slug = 'super-domati' }: EmailParams) {
  const downloadUrl = `${siteUrl}/naruchnik/${slug}?email=${encodeURIComponent(email)}${name ? `&name=${encodeURIComponent(name)}` : ''}`
  const unsubUrl     = await unsubLink(email)

  const subject = name
    ? `${name}, ето твоя наръчник! 📗`
    : 'Ето твоя безплатен наръчник! 📗'

  const html = `
    <div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:linear-gradient(135deg,#0f1f16,#1b4332);padding:28px 32px;text-align:center;border-radius:16px 16px 0 0">
        <p style="font-size:36px;margin:0">🍅</p>
        <h1 style="color:#fff;font-size:20px;font-weight:800;margin:12px 0 4px">Наръчникът е готов!</h1>
        <p style="color:rgba(255,255,255,.7);font-size:13px;margin:0">Кликни на бутона за да го изтеглиш</p>
      </div>

      <div style="padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px">
        <p style="font-size:16px;font-weight:600;color:#111;margin:0 0 12px">${greeting(name)}</p>
        <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 20px">
          Регистрацията е успешна! Наръчникът е готов за изтегляне — кликни на бутона по-долу.
        </p>

        <div style="text-align:center;margin:24px 0">
          <a href="${downloadUrl}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:16px 32px;text-decoration:none;font-weight:900;font-size:16px;box-shadow:0 8px 24px rgba(22,163,74,.3)">
            📥 Изтегли Наръчника (PDF)
          </a>
        </div>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin:20px 0">
          <p style="font-size:11px;font-weight:800;color:#15803d;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px">Вътре ще намериш:</p>
          <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px">
            ${[
              'Пълна схема на торене по фази — от разсад до беритба',
              'Кои продукти реално работят, с точни дози',
              'Разпознаване на болести и неприятели по конкретни симптоми',
              'Най-честите грешки, които коства реколтата',
              'Химичен и биологичен вариант за всяка стъпка',
            ].map(i => `<li style="font-size:13.5px;color:#166534;font-weight:500">✓ ${i}</li>`).join('')}
          </ul>
        </div>

        <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0">
          Ако имаш въпроси или искаш съвет за твоята реколта — отговори директно на този имейл.
        </p>
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0">
      <p style="font-size:12px;color:#9ca3af;text-align:center;padding:16px 32px">
        Ако не желаеш да получаваш повече имейли: <a href="${unsubUrl}" style="color:#9ca3af">отпиши се тук</a>.
      </p>
    </div>
  `

  return { subject, html }
}

// ─── Follow-up Day 2 ────────────────────────────────────────────────
export async function followUp2Email({ email, name, slug = 'super-domati' }: EmailParams) {
  const subject = '📌 Прочете ли Глава 2 от наръчника?'
  const downloadUrl = `${siteUrl}/naruchnik/${slug}?email=${encodeURIComponent(email)}${name ? `&name=${encodeURIComponent(name)}` : ''}`

  const html = wrapper(`
    <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">${greeting(name)}</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">
      Надявам се вече си разгледал наръчника! Искам да те насоча към <strong>Глава 2 — Торенето</strong>.
      Там ще намериш точния график, по-месечно, кое и кога да приложиш за максимален добив.
    </p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 20px">
      Повечето хора пропускат тази стъпка и после се чудят защо доматите им не растат добре. 😅
    </p>
    <div style="text-align:center;margin:20px 0">
      <a href="${downloadUrl}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">
        📖 Отвори Наръчника
      </a>
    </div>
    <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0">
      Имаш въпрос за торовете? Отговори директно на този имейл — четем всяко писмо.
    </p>
  `, await footer(email))

  return { subject, html }
}

// ─── Follow-up Day 5 ────────────────────────────────────────────────
export async function followUp5Email({ email, name }: EmailParams) {
  const subject = '🌱 Тази грешка убива 80% от доматите...'

  const html = wrapper(`
    <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">${greeting(name)}</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">
      Знаеш ли коя е <strong>грешката №1</strong>, която правят повечето градинари с домати?
    </p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">
      <strong>Поливат твърде много</strong> — и то в грешното време на деня.
    </p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">
      Доматите обичат умерена влага, но мразят „мокри крака". Поливането вечер оставя листата влажни цяла нощ —
      идеална среда за <em>фитофтора</em> и <em>сиво гниене</em>.
    </p>
    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:14px 18px;margin:16px 0">
      <p style="font-size:13.5px;color:#713f12;font-weight:600;margin:0">
        💡 Съвет: Полявай сутрин, в основата на растението. Листата трябва да са сухи преди залез.
      </p>
    </div>
    <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0">
      В наръчника има цял раздел за напояването с точни количества и честота по сезон.
      Ако все още не си го изтеглил — <a href="${siteUrl}" style="color:#16a34a;font-weight:700">вземи го тук</a>.
    </p>
  `, await footer(email))

  return { subject, html }
}

// ─── Follow-up Day 10 ───────────────────────────────────────────────
export async function followUp10Email({ email, name }: EmailParams) {
  const subject = '🍅 Как е реколтата? + специална оферта'
  const shopUrl = `${siteUrl}/#products`

  // ✅ ФИКС: преди тук стояха "Органичен фунгицид" / "Течен хумат +
  // фулвати" — нито едно от двете не съществува в реалния каталог (виж
  // lib/marketing-data.ts). Заменени с продуктите, които реално се
  // продават под тези имена.
  const html = wrapper(`
    <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">${greeting(name)}</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">
      Минаха 10 дни откакто изтегли наръчника — как вървят нещата?
    </p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">
      Ако искаш да направиш следващата крачка и да получиш <strong>едри, здрави домати с минимален труд</strong>,
      разгледай продуктите, които аз лично използвам:
    </p>
    <div style="display:grid;gap:12px;margin:20px 0">
      ${[
        { emoji: '🌿', name: 'Амалгерол', desc: '100% природен биостимулатор — щит срещу стреса на растението' },
        { emoji: '🌱', name: 'Турбо Рут', desc: 'Стимулира бързото вкореняване на разсада' },
        { emoji: '🛡️', name: 'Калитех', desc: 'Калциев биостимулатор — предпазва от върхово гниене' },
      ].map(p => `
        <div style="display:flex;gap:14px;align-items:flex-start;background:#f8fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px">
          <span style="font-size:26px">${p.emoji}</span>
          <div>
            <p style="font-size:14px;font-weight:700;color:#111;margin:0 0 3px">${p.name}</p>
            <p style="font-size:12.5px;color:#6b7280;margin:0">${p.desc}</p>
          </div>
        </div>
      `).join('')}
    </div>
    <div style="text-align:center;margin:20px 0">
      <a href="${shopUrl}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">
        🛒 Разгледай Продуктите
      </a>
    </div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:8px 0 0">
      Безплатна доставка при поръчка над 60 € | Еконт / Спиди
    </p>
  `, await footer(email))

  return { subject, html }
}

// ─── Изоставена поръчка (status='new' >24ч) — poll тригер, viz lib/automations.ts ──
export async function abandonedOrderEmail({ email, name, context }: EmailParams & { context?: any }) {
  const orderNumber = context?.order_number || ''
  const subject = `⚠️ Поръчка ${orderNumber} чака потвърждение`
  const html = wrapper(`
    <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">${greeting(name)}</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">
      Поръчката ти <strong>${orderNumber}</strong> е при нас, но все още чака обработка.
      Ако имаш въпроси или искаш да промениш нещо — пиши ни директно, отговаряме на всеки имейл.
    </p>
    <div style="text-align:center;margin:20px 0">
      <a href="mailto:support@dennyangelow.com" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">
        Свържи се с нас →
      </a>
    </div>
  `, await footer(email))
  return { subject, html }
}

// ─── Изоставена количка (>2ч, неконвертирана) — poll тригер ──────────────────
export async function abandonedCartEmail({ email, name, context }: EmailParams & { context?: any }) {
  const items: { product_name: string; quantity: number }[] = context?.items || []
  const total = Number(context?.total || 0)
  const subject = '🛒 Забрави нещо в количката си?'
  const itemsHtml = items.map(i => `<li style="font-size:14px;margin-bottom:6px">${i.product_name} × ${i.quantity}</li>`).join('')
  const html = wrapper(`
    <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">${greeting(name)}</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">
      Забеляза, че си оставил/а следните продукти в количката си:
    </p>
    <div style="background:#f9fafb;border-radius:10px;padding:14px 18px;margin:16px 0;font-size:14px">
      <ul style="padding-left:20px;margin:0">${itemsHtml}</ul>
      <p style="margin-top:10px;font-weight:800;border-top:1px solid #eee;padding-top:8px">Общо: ${total.toFixed(2)} €</p>
    </div>
    <div style="text-align:center;margin:20px 0">
      <a href="${siteUrl}/#products" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">
        Довърши поръчката →
      </a>
    </div>
  `, await footer(email))
  return { subject, html }
}

// Код за потвърждение на поръчка (към клиента)
// ✅ Остава СИНХРОННА — не праща unsub линк (транзакционен имейл), wrapper()
// тук се вика без footerHtml, значи няма нужда от await верига.
export function orderConfirmationEmail({ order, items }: any) {
  const subject = `Поръчка #${order.order_number} — Denny Angelow`

  const itemsHtml = items.map((i: any) =>
    `<li style="font-size:14px;margin-bottom:8px"><strong>${i.product_name}</strong> (x${i.quantity}) — ${i.total_price.toFixed(2)} €</li>`
  ).join('')

  const html = wrapper(`
    <h2 style="color:#111;font-size:18px;margin-bottom:12px">Благодарим за поръчката!</h2>
    <p style="font-size:14px;color:#4b5563;margin-bottom:16px">Здравейте, ${order.customer_name}. Поръчката ви е приета и ще бъде изпратена скоро.</p>
    <div style="background:#f9fafb;padding:16px;border-radius:12px;margin-bottom:16px">
      <p style="font-size:13px;font-weight:700;margin-bottom:8px">ВАШАТА ПОРЪЧКА:</p>
      <ul style="padding-left:20px;margin:0">${itemsHtml}</ul>
      <p style="margin-top:12px;font-weight:800;border-top:1px solid #eee;padding-top:8px">ОБЩО: ${order.total.toFixed(2)} €</p>
    </div>
    <p style="font-size:13px;color:#6b7280">Доставка до: ${order.customer_city}, ${order.customer_address}</p>
  `)

  return { subject, html }
}

// Код за известие към теб (админа)
export function adminNotifyEmail({ order, items }: any) {
  const subject = `НОВА ПОРЪЧКА: #${order.order_number} (${order.customer_name})`

  const itemsHtml = items.map((i: any) =>
    `<li>${i.product_name} (x${i.quantity})</li>`
  ).join('')

  const html = `
    <h1>Нова поръчка от сайта!</h1>
    <p><strong>Клиент:</strong> ${order.customer_name}</p>
    <p><strong>Телефон:</strong> ${order.customer_phone}</p>
    <p><strong>Адрес:</strong> ${order.customer_city}, ${order.customer_address}</p>
    <hr>
    <h3>Продукти:</h3>
    <ul>${itemsHtml}</ul>
    <p><strong>Обща сума:</strong> ${order.total.toFixed(2)} €</p>
  `

  return { subject, html }
}
