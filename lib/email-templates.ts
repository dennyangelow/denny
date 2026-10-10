// lib/email-templates.ts — v6
//
// ПОПРАВКИ v6 (спрямо v5):
//   ✅ СИГУРНОСТ: orderConfirmationEmail() и adminNotifyEmail() вече escape-ват
//      customer_name / customer_phone / customer_city / customer_address и
//      имената на артикулите, преди да ги сложат в HTML-а на писмото.
//      Същият клас проблем вече беше поправен в tracking имейла
//      (app/api/orders/[id]/route.ts v7, виж esc() там) — полетата от
//      публичната форма за поръчка НЕ са ограничени до безопасни символи
//      (за разлика от lead name, което validateName() пуска само буква/
//      интервал/тире). Без escape, адрес/име с "<script>" или подвеждащ
//      линк се вгражда необработено в писмото до клиента И до админа.
//
// ПОПРАВКИ v5 (спрямо v4) — редактируем footer/sender от Настройки:
//   ✅ footer() вече взима дисклеймър текста от lib/email-settings.ts
//      (settings.email_footer_text), вместо хардкоднатия "Получаваш този
//      имейл, защото се регистрира на dennyangelow.com." низ.
//   ✅ wrapper() приема нов `tagline` параметър — малкия сив ред под
//      логото в header-а на писмото ("Denny Angelow — Агро Консултант").
//      Идва от settings.email_sender_tagline. Default параметър пази
//      старото поведение, ако някой извика wrapper() без да го подаде.
//   ✅ welcomeEmail() (единствената функция с ИЗЦЯЛО собствен header/footer,
//      не минава през wrapper()/footer()) също вече чете настройките —
//      taglinе под логото и footer текста над unsubscribe линка.
//   ✅ Всички функции, които вече бяха `async` (нужни са за await
//      getEmailSettings(), едно DB извикване повече, кеширано 1 минута —
//      виж lib/email-settings.ts), остават async — няма промяна в сигнатурите
//      им навън, само вътре викат getEmailSettings() веднъж в началото.
//
// ПОПРАВКИ v4 (спрямо v3):
//   ✅ НОВО: buildCustomEmail() — рендва имейл от ТЕКСТ, въведен в админ
//      панела (app/admin/components/EmailTemplatesTab.tsx), вместо от
//      хардкоднат TS код. Поддържа {{name}}/{{email}}/{{pdf_url}}/
//      {{page_url}}/{{shop_url}}/{{order_number}}/{{total}} placeholder-и
//      (виж lib/email-template-keys.ts за кой темплейт поддържа кои).
//      Извикващата страна (lib/automations.ts runStep()) първо проверява
//      дали има override ред в новата email_templates таблица за дадения
//      template_key — ако да, вика тази функция; ако не, пада към
//      съответната кодирана функция по-долу (welcomeEmail/followUp*Email/
//      abandoned*Email) както досега. Брандинг рамката (wrapper()) и
//      unsubscribe футъра (footer()) се добавят автоматично и тук —
//      администраторът пише САМО вътрешния текст, не цялото писмо.

import { createUnsubscribeToken } from '@/lib/unsubscribe-token'
import { supabaseAdmin } from '@/lib/supabase'
import { getEmailSettings } from '@/lib/email-settings'

interface EmailParams {
  email: string
  name?: string
  slug?: string
  context?: Record<string, any>
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com'

// ✅ v6 — същият escape helper като в app/api/orders/[id]/route.ts (esc()).
// Данни от публичната поръчкова форма (име, телефон, град, адрес) не минават
// през validateName()-стил ограничение на символите — трябва да се escape-ват
// преди да влязат в HTML на писмо.
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function greeting(name?: string) {
  return name ? `Здравей, ${name}!` : 'Здравей!'
}

async function unsubLink(email: string): Promise<string> {
  const token = await createUnsubscribeToken(email)
  return `${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`
}

// ✅ v5 — footerText вече идва от settings.email_footer_text (редактируем
// от Настройки → ✉️ Email настройки), вместо хардкоднат низ тук.
async function footer(email: string): Promise<string> {
  const { footerText } = await getEmailSettings()
  return `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
    <p style="font-size:12px;color:#9ca3af;text-align:center">
      ${footerText}<br>
      <a href="${await unsubLink(email)}" style="color:#9ca3af">Отпиши се тук</a>
    </p>
  `
}

// ✅ НОВО (v3) — директен PDF линк вместо връщане към squeeze страницата.
// pageUrl е fallback (ако pdf_url липсва в БД по някаква причина) — виж
// бележката в заглавния коментар по-горе.
async function getNaruchnikDownload(slug: string): Promise<{ pdfUrl: string; pageUrl: string; title: string }> {
  const pageUrl = `${siteUrl}/naruchnik/${slug}`
  try {
    const { data } = await supabaseAdmin
      .from('naruchnici')
      .select('pdf_url, title')
      .eq('slug', slug)
      .maybeSingle()
    return {
      pdfUrl: data?.pdf_url || pageUrl,
      pageUrl,
      title: data?.title || 'Наръчникът',
    }
  } catch {
    // БД грешка → не оставяме лийда без линк, пращаме го към страницата
    return { pdfUrl: pageUrl, pageUrl, title: 'Наръчникът' }
  }
}

// ✅ НОВО (v4) — заменя {{var}} placeholder-и с реални стойности. Непознат
// placeholder (нещо, което авторът на текста си е измислил, напр. {{foo}})
// просто изчезва (замества се с празен низ) — безопасно, никога не гърми.
function substituteVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? '')
}

// ✅ НОВО (v4) — рендва имейл от админ-редактиран текст (email_templates
// override), вместо от кодирана функция. Вика се от lib/automations.ts
// САМО когато за дадения template_key има запазен ред в email_templates.
export async function buildCustomEmail({
  subjectTemplate, bodyHtmlTemplate, email, name, slug, context,
}: {
  subjectTemplate: string
  bodyHtmlTemplate: string
  email: string
  name?: string
  slug?: string
  context?: Record<string, any>
}): Promise<{ subject: string; html: string }> {
  const vars: Record<string, string> = {
    name: name || 'приятел',
    email,
  }
  if (slug) {
    const { pdfUrl, pageUrl } = await getNaruchnikDownload(slug)
    vars.pdf_url  = pdfUrl
    vars.page_url = pageUrl
  }
  vars.shop_url = `${siteUrl}/#products`
  if (context?.order_number != null) vars.order_number = String(context.order_number)
  if (context?.total != null)        vars.total = `${Number(context.total).toFixed(2)} €`

  const subject  = substituteVars(subjectTemplate, vars)
  const bodyHtml = substituteVars(bodyHtmlTemplate, vars)
  const { senderTagline } = await getEmailSettings()
  const html = wrapper(bodyHtml, await footer(email), senderTagline)

  return { subject, html }
}

// ✅ v5 — приема `tagline` (малкият сив ред под логото). Default параметър
// пази старото фиксирано поведение за всеки caller, който не го подаде.
// wrapper() остава СИНХРОНЕН нарочно — взима вече готови footerHtml/tagline
// низове (изчислени от извикващата функция с await), вместо сам да вика
// async getEmailSettings()/footer() вътрешно. Това пази orderConfirmationEmail()
// (която вика wrapper() без email, без unsub линк) синхронна — без ripple
// ефект към нейния неизвестен на мен caller.
function wrapper(content: string, footerHtml: string = '', tagline: string = 'Denny Angelow — Агро Консултант') {
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
      <div style="background:linear-gradient(135deg,#0f1f16,#1b4332);padding:28px 32px;text-align:center">
        <p style="font-size:28px;margin:0">🍅</p>
        <p style="color:rgba(255,255,255,.8);font-size:13px;margin:8px 0 0">${tagline}</p>
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
  // ✅ ФИКС v3: директен PDF линк (виж getNaruchnikDownload по-горе) —
  // преди тук стоеше линк към /naruchnik/${slug}?email=..., който връщаше
  // лийда на squeeze страницата да попълва формата отново.
  const { pdfUrl } = await getNaruchnikDownload(slug)
  const unsubUrl    = await unsubLink(email)
  // ✅ v5 — taglinе и footer текст от Настройки (тази функция не минава
  // през общия wrapper()/footer(), има собствен header/footer в HTML-а).
  const { senderTagline, footerText } = await getEmailSettings()

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
          <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:16px 32px;text-decoration:none;font-weight:900;font-size:16px;box-shadow:0 8px 24px rgba(22,163,74,.3)">
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
          Ако бутонът не се отвори — <a href="${pdfUrl}" style="color:#16a34a;font-weight:700">кликни тук</a>.
          Ако имаш въпроси или искаш съвет за твоята реколта — отговори директно на този имейл.
        </p>
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0">
      <p style="font-size:12px;color:#9ca3af;text-align:center;padding:16px 32px">
        ${footerText}<br>
        Ако не желаеш да получаваш повече имейли: <a href="${unsubUrl}" style="color:#9ca3af">отпиши се тук</a>.
      </p>
    </div>
  `

  return { subject, html }
}

// ─── Follow-up Day 2 ────────────────────────────────────────────────
export async function followUp2Email({ email, name, slug = 'super-domati' }: EmailParams) {
  const subject = '📌 Прочете ли Глава 2 от наръчника?'
  // ✅ ФИКС v3: същият директен PDF линк вместо връщане към squeeze страницата.
  const { pdfUrl } = await getNaruchnikDownload(slug)
  const { senderTagline } = await getEmailSettings()

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
      <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">
        📖 Отвори Наръчника
      </a>
    </div>
    <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0">
      Имаш въпрос за торовете? Отговори директно на този имейл — четем всяко писмо.
    </p>
  `, await footer(email), senderTagline)

  return { subject, html }
}

// ─── Follow-up Day 5 ────────────────────────────────────────────────
export async function followUp5Email({ email, name }: EmailParams) {
  const subject = '🌱 Тази грешка убива 80% от доматите...'
  const { senderTagline } = await getEmailSettings()

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
  `, await footer(email), senderTagline)

  return { subject, html }
}

// ─── Follow-up Day 10 ───────────────────────────────────────────────
export async function followUp10Email({ email, name }: EmailParams) {
  const subject = '🍅 Как е реколтата? + специална оферта'
  const shopUrl = `${siteUrl}/#products`
  const { senderTagline } = await getEmailSettings()

  // ✅ ФИКС: преди тук стояха "Органичен фунгицид" / "Течен хумат +
  // фулвати" — нито едно от двете не съществува в реалния каталог (виж
  // lib/marketing-data.ts PRODUCTS). Заменени с продуктите, които реално се
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
  `, await footer(email), senderTagline)

  return { subject, html }
}

// ─── Изоставена поръчка (status='new' >24ч) — poll тригер, viz lib/automations.ts ──
export async function abandonedOrderEmail({ email, name, context }: EmailParams & { context?: any }) {
  // ✅ v6 — order_number escape-нат (защита в дълбочина, дори да е
  // системно генериран) и подаден и в subject, и в тялото еднакво.
  const orderNumber = esc(context?.order_number || '')
  const subject = `⚠️ Поръчка ${orderNumber} чака потвърждение`
  const { senderTagline } = await getEmailSettings()
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
  `, await footer(email), senderTagline)
  return { subject, html }
}

// ─── Изоставена количка (>2ч, неконвертирана) — poll тригер ──────────────────
export async function abandonedCartEmail({ email, name, context }: EmailParams & { context?: any }) {
  const items: { product_name: string; quantity: number }[] = context?.items || []
  const total = Number(context?.total || 0)
  const subject = '🛒 Забрави нещо в количката си?'
  const { senderTagline } = await getEmailSettings()
  // ✅ v6 — product_name escape-нат (идва от количката, виж бележката при
  // orderConfirmationEmail/adminNotifyEmail по-долу за същия клас проблем).
  const itemsHtml = items.map(i => `<li style="font-size:14px;margin-bottom:6px">${esc(i.product_name)} × ${esc(i.quantity)}</li>`).join('')
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
  `, await footer(email), senderTagline)
  return { subject, html }
}

// Код за потвърждение на поръчка (към клиента)
// ✅ Остава СИНХРОННА — не праща unsub линк (транзакционен имейл), wrapper()
// тук се вика без footerHtml/tagline (пада се на default-а), няма нужда от
// await верига.
// ✅ v6 — ВСИЧКИ полета от order (customer_name/city/address) и product_name
// вече минават през esc(). Тези стойности идват от публичната форма за
// поръчка/количката — не са ограничени до безопасни символи (за разлика от
// lead name, виж validateName() в lib/validation.ts) и преди влизаха сурови
// в HTML-а на писмото до клиента.
export function orderConfirmationEmail({ order, items }: any) {
  const subject = `Поръчка #${esc(order.order_number)} — Denny Angelow`

  const itemsHtml = items.map((i: any) =>
    `<li style="font-size:14px;margin-bottom:8px"><strong>${esc(i.product_name)}</strong> (x${esc(i.quantity)}) — ${Number(i.total_price).toFixed(2)} €</li>`
  ).join('')

  const html = wrapper(`
    <h2 style="color:#111;font-size:18px;margin-bottom:12px">Благодарим за поръчката!</h2>
    <p style="font-size:14px;color:#4b5563;margin-bottom:16px">Здравейте, ${esc(order.customer_name)}. Поръчката ви е приета и ще бъде изпратена скоро.</p>
    <div style="background:#f9fafb;padding:16px;border-radius:12px;margin-bottom:16px">
      <p style="font-size:13px;font-weight:700;margin-bottom:8px">ВАШАТА ПОРЪЧКА:</p>
      <ul style="padding-left:20px;margin:0">${itemsHtml}</ul>
      <p style="margin-top:12px;font-weight:800;border-top:1px solid #eee;padding-top:8px">ОБЩО: ${Number(order.total).toFixed(2)} €</p>
    </div>
    <p style="font-size:13px;color:#6b7280">Доставка до: ${esc(order.customer_city)}, ${esc(order.customer_address)}</p>
  `)

  return { subject, html }
}

// Код за известие към теб (админа)
// ✅ v6 — същото escape-ване като orderConfirmationEmail (виж бележката там).
export function adminNotifyEmail({ order, items }: any) {
  const subject = `НОВА ПОРЪЧКА: #${esc(order.order_number)} (${esc(order.customer_name)})`

  const itemsHtml = items.map((i: any) =>
    `<li>${esc(i.product_name)} (x${esc(i.quantity)})</li>`
  ).join('')

  const html = `
    <h1>Нова поръчка от сайта!</h1>
    <p><strong>Клиент:</strong> ${esc(order.customer_name)}</p>
    <p><strong>Телефон:</strong> ${esc(order.customer_phone)}</p>
    <p><strong>Адрес:</strong> ${esc(order.customer_city)}, ${esc(order.customer_address)}</p>
    <hr>
    <h3>Продукти:</h3>
    <ul>${itemsHtml}</ul>
    <p><strong>Обща сума:</strong> ${Number(order.total).toFixed(2)} €</p>
  `

  return { subject, html }
}
