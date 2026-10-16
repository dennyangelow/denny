// lib/email-templates.ts — v13 (= твоят v11 + малки добавки; нищо от v11/v10/v9 не е махано)
//
// ПОПРАВКИ v13 (спрямо v12):
//   ✅ {{courier}} вече е името за клиента (Еконт / Спиди — както в tracking писмото
//      в orders/[id]/route.ts), не кодът от поръчката ("econt"). Липсва ли → "—".
//   ✅ {{tracking_number}} → "—", ако поръчката няма товарителница (вместо празно място).
//
// ПОПРАВКИ v12 (спрямо твоя v11):
//   ✅ {{tracking_number}} и {{courier}} — нови променливи за писмата на тригера
//      "Изпратена, но не доставена" (lib/automations.ts v10). Escape-ват се в HTML.
//   ✅ Защита на siteUrl: ако NEXT_PUBLIC_SITE_URL по погрешка сочи към *.vercel.app
//      (напр. чужд/preview домейн), линковете в писмата — в т.ч. "Отпиши се" с
//      токен — вече НЕ отиват там, а към https://dennyangelow.com. Празна или
//      невалидна стойност → пак dennyangelow.com. Крайният "/" се маха.
//      ⚠️ Истинската поправка е стойността във Vercel; това е само предпазна мрежа
//      и важи САМО за този файл (останалите файлове четат env-а директно).
//
// ПОПРАВКИ v11 (спрямо v10) — само текстове и данни; всичко от v10/v9 е запазено
// (escape в substituteVars, plain-text режим, solid background-color на бутоните):
//   ✅ greeting(): името се escape-ва (преди влизаше сурово в HTML на fallback писмата).
//   ✅ Теми на писма за поръчка — обикновен текст (subjectText), не HTML-escape-нати
//      ("O'Brien" излизаше като "O&#39;Brien" в темата).
//   ✅ Fallback welcome/ден 2/ден 5/ден 10 — текстът е подравнен с реалното съдържание на PDF-а
//      (без „точни дози“, „Глава 2“, „убива 80%“, „+ специална оферта“, „предпазва от върхово гниене“).
//   ✅ orderConfirmationEmail: номер на поръчката, доставка, контакт. adminNotifyEmail: имейл, куриер,
//      плащане, бележка, фактура, цени и линк към админ панела (siteUrl вече се ползва).
//   ✅ getNaruchnikDownload(): само активен наръчник.
//   ⚠️ Живите писма от автоматизациите четат body_html от таблицата email_templates — за тях е
//      отделният SQL (email-templates-db-fixes.sql).
//
// (v10 по-долу)
//
// ПОПРАВКИ v10 (спрямо v9):
//   ✅ СИГУРНОСТ: substituteVars() вече escape-ва потребителски-въведените
//      стойности ({{name}}, {{email}}, {{order_number}}) при вмъкване в HTML
//      тялото. Преди това име като <img src=x onerror=...> от формата за
//      наръчник влизаше суров в писмото. URL-ите/сумата остават непроменени.
//      В темата (subject) се махат само нови редове (header injection).
//   ✅ НОВО: обикновен текст без HTML тагове (редът "Здравей {{name}}\n\nТекст")
//      автоматично става параграфи + <br> + кликаеми линкове. Може да
//      пишеш писма като нормален имейл, без HTML.
//   ✅ wrapper(): тялото на писмото има базов шрифт/размер/цвят (15px, 1.7,
//      #374151) — редакторът в админа ползва същите, за да е преглед 1:1.
//   ✅ export wrapper-ът НЕ е променян като сигнатура; preview route-ът вика
//      САМО buildCustomEmail() — същия код, който праща реалните писма.
//
// ПОПРАВКИ v9 (спрямо v8):
//   ✅ БЪГ ОТКРИТ: всички бутони (CTA) и header-ите в писмата ползваха
//      САМО `background: linear-gradient(...)` — без solid `background-color`
//      fallback. Много mail клиенти (Yahoo Mail, Outlook desktop/365,
//      по-стари Gmail renderer-и) НЕ поддържат CSS gradients в имейли и
//      просто ИЗЦЯЛО махат свойството при санитизация на HTML-а — бутонът
//      остава БЕЗ фон, а белият текст (color:#fff) пада върху белия фон на
//      писмото = невидим текст. Точно това виждаше потребителят в Yahoo
//      Mail ("Довърши поръчката" бутонът — текстът се виждаше само като се
//      маркира/selectне ръчно).
//      ФИКС: добавен `background-color:#16a34a` (зелено, същия тон като
//      началото на градиента) ПРЕДИ `background:linear-gradient(...)` на
//      ВСЯКО място с бутон, и `background-color:#0f1f16` на header-ите
//      (wrapper() + welcomeEmail()'s собствен header). CSS правилото е:
//      по-късно декларираната стойност печели АКО клиентът разбира
//      gradients — тогава вижда красивия градиент; ако клиентът не
//      разбира `linear-gradient`, просто пада обратно на солидния цвят —
//      никога вече напълно прозрачен/бял фон.
//      ⚠️ Това коригира КОДА (welcomeEmail/followUp*Email/abandoned*Email/
//      wrapper — hardcoded fallback функциите), но живите писма, които
//      минават през automations (workflow_enrollments → buildCustomEmail),
//      четат body_html от `email_templates` таблицата в БАЗАТА, не от тук.
//      За тях е нужен отделен SQL UPDATE (даден отделно в чата) — виж
//      бележката в lib/automations.ts runStep(): "ВИНАГИ от базата
//      (email_templates), никакъв код fallback повече".
//
// ПОПРАВКИ v8 (спрямо v7):
//   ✅ orderConfirmationEmail() и adminNotifyEmail() вече са async и четат
//      getCurrencySymbol() вместо hardcoded "€" — последните 2 от общо 4
//      места с хардкоднатата валута в проекта (другите 2 — buildCustomEmail()
//      и abandonedCartEmail() — бяха оправени в v7). Качена е
//      app/api/orders/route.ts (v9) и потвърдих: вика двете функции само
//      ТУК (един caller), без await преди — вече добавен await на двата
//      повика. Никой друг файл не ги вика (провери се).
//
// ПОПРАВКИ v7 (спрямо v6):
//   ✅ Валутният символ вече е конфигурируем (settings.currency_symbol,
//      виж lib/currency.ts), но buildCustomEmail() и abandonedCartEmail()
//      имаха hardcoded "€" — ако някога смениш валутата от админ панела
//      (💶 Валута секция в Настройки), тези две писма щяха да продължат да
//      показват € въпреки новата настройка. Сега и двете четат
//      getCurrencySymbol() (същият 1-минутен кеш модел като останалите
//      settings четения тук).
//      ⚠️ orderConfirmationEmail()/adminNotifyEmail() ОСТАВАТ с hardcoded €
//      засега — те са СИНХРОННИ функции и правенето им async изисква await
//      на викащата страна (app/api/orders/route.ts), която не е прегледана
//      в тази промяна. Виж бележката при всяка от двете по-долу.
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
import { getCurrencySymbol } from '@/lib/currency'

interface EmailParams {
  email: string
  name?: string
  slug?: string
  context?: Record<string, any>
}

// ✅ v12 — виж бележката най-горе. *.vercel.app никога не е домейнът на сайта.
function resolveSiteUrl(): string {
  const fallback = 'https://dennyangelow.com'
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '')
  if (!raw) return fallback
  try {
    return new URL(raw).hostname.endsWith('.vercel.app') ? fallback : raw
  } catch {
    return fallback
  }
}
const siteUrl = resolveSiteUrl()

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

// ✅ v11 — тема на писмо = обикновен текст: маха нови редове/контролни символи, реже дължината.
function subjectText(v: unknown, max = 120): string {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

// ✅ v13 — код на куриера → име за клиента (същото като в tracking писмото).
function courierName(c: unknown): string {
  const v = String(c ?? '').trim().toLowerCase()
  if (!v) return '—'
  if (v === 'speedy') return 'Спиди'
  if (v === 'econt')  return 'Еконт'
  return String(c).trim()
}

function greeting(name?: string) {
  return name ? `Здравей, ${esc(name)}!` : 'Здравей!'
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
      .eq('active', true)
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
// Ключове, чиито стойности идват от потребителя/поръчка → escape в HTML.
const ESCAPED_VAR_KEYS = new Set(['name', 'email', 'order_number', 'tracking_number', 'courier'])

function substituteVars(template: string, vars: Record<string, string>, asHtml = false): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const v = vars[key] ?? ''
    if (asHtml) return ESCAPED_VAR_KEYS.has(key) ? esc(v) : v
    return v.replace(/[\r\n]+/g, ' ')   // тема: без нови редове
  })
}

// Дали текстът изглежда като HTML (има поне един таг).
function looksLikeHtml(s: string): boolean {
  return /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(s)
}

// Обикновен текст → параграфи/<br>/линкове. Вика се ПРЕДИ substituteVars,
// затова {{var}} остават непокътнати (не съдържат <>&).
function plainToHtml(text: string): string {
  const p = 'font-size:15px;line-height:1.7;color:#374151;margin:0 0 14px'
  return text
    .replace(/\r\n/g, '\n').trim()
    .split(/\n{2,}/)
    .map(par => {
      const safe = esc(par)
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#15803d">$1</a>')
        .replace(/\n/g, '<br>')
      return `<p style="${p}">${safe}</p>`
    })
    .join('')
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
  // ✅ v12 — данни за пратката (тригер "Изпратена, но не доставена")
  vars.tracking_number = context?.tracking_number ? String(context.tracking_number) : '—'
  vars.courier         = courierName(context?.courier)
  // ✅ v7 — валутен символ от settings (currency_symbol), не hardcoded €.
  if (context?.total != null) {
    const symbol = await getCurrencySymbol()
    vars.total = `${Number(context.total).toFixed(2)} ${symbol}`
  }

  const subject  = substituteVars(subjectTemplate, vars)
  const rawBody  = looksLikeHtml(bodyHtmlTemplate) ? bodyHtmlTemplate : plainToHtml(bodyHtmlTemplate)
  const bodyHtml = substituteVars(rawBody, vars, true)
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
// ✅ v9 — добавен solid background-color:#0f1f16 ПРЕДИ linear-gradient-а на
// header-а — виж бележката в заглавния коментар (gradient-only фон изчезва
// изцяло в Yahoo/Outlook, бял текст пада върху бял фон = невидим header).
function wrapper(content: string, footerHtml: string = '', tagline: string = 'Denny Angelow — Агро Консултант') {
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
      <div style="background-color:#0f1f16;background:linear-gradient(135deg,#0f1f16,#1b4332);padding:28px 32px;text-align:center">
        <p style="font-size:28px;margin:0">🍅</p>
        <p style="color:rgba(255,255,255,.8);font-size:13px;margin:8px 0 0">${tagline}</p>
      </div>
      <div style="padding:28px 32px;font-size:15px;line-height:1.7;color:#374151">
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
    ? `${subjectText(name, 60)}, ето твоя наръчник! 📗`
    : 'Ето твоя безплатен наръчник! 📗'

  const html = `
    <div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background-color:#0f1f16;background:linear-gradient(135deg,#0f1f16,#1b4332);padding:28px 32px;text-align:center;border-radius:16px 16px 0 0">
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
          <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#16a34a;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:16px 32px;text-decoration:none;font-weight:900;font-size:16px;box-shadow:0 8px 24px rgba(22,163,74,.3)">
            📥 Изтегли Наръчника (PDF)
          </a>
        </div>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin:20px 0">
          <p style="font-size:11px;font-weight:800;color:#15803d;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px">Вътре ще намериш:</p>
          <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px">
            ${[
              'Подготовка на почвата и правилно засаждане',
              'Нуждите на растението във всяка от петте фази: температура, влажност, светлина и торене',
              'Болести и вредители по фази и препоръчителни препарати',
              'Диагностична таблица „симптом – причина – решение“',
              'Общи препоръки за целия сезон: мониторинг, мулч, ротация на препаратите',
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
  const subject = '📌 Следваш ли схемата по фази?'
  // ✅ ФИКС v3: същият директен PDF линк вместо връщане към squeeze страницата.
  const { pdfUrl } = await getNaruchnikDownload(slug)
  const { senderTagline } = await getEmailSettings()

  const html = wrapper(`
    <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">${greeting(name)}</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">
      Надявам се вече си разгледал наръчника! Искам да те насоча към <strong>раздел 4 — нуждите на растението по фази</strong>.
      Там има таблици за температура, влажност, светлина и торене във всяка от петте фази — какво да даваш и кога.
    </p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 20px">
      Ако искаш да разбереш и <em>защо</em> стои зад всяка фаза, прочети
      <a href="${siteUrl}/blog/shema-torene-domati-po-fazi" style="color:#16a34a;font-weight:700">схемата за торене на домати по фази</a>.
    </p>
    <div style="text-align:center;margin:20px 0">
      <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#16a34a;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">
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
export async function followUp5Email({ email, name, slug = 'super-domati' }: EmailParams) {
  const subject = '🌱 Най-честата грешка при поливането на домати'
  const { senderTagline } = await getEmailSettings()

  const html = wrapper(`
    <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">${greeting(name)}</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">
      Знаеш ли коя е една от най-честите грешки при доматите? <strong>Нередовната влага</strong>.
    </p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">
      Доматите понасят зле резките смени: суша, после обилна поливка може да доведе до напукани плодове и върхово гниене.
      А мокрите листа през нощта улесняват гъбичните болести — мана и сиво гниене.
    </p>
    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:14px 18px;margin:16px 0">
      <p style="font-size:13.5px;color:#713f12;font-weight:600;margin:0">
        💡 Съвет: Полявай в основата на растението, за предпочитане рано сутрин, и мулчирай. Така влагата е равномерна, а листата остават сухи.
      </p>
    </div>
    <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0">
      В раздел 3 на наръчника — „Поливане: златните правила“ — са събрани седемте правила за поливане.
      Ако все още не си го изтеглил — <a href="${siteUrl}/naruchnik/${slug}" style="color:#16a34a;font-weight:700">вземи го тук</a>.
    </p>
  `, await footer(email), senderTagline)

  return { subject, html }
}

// ─── Follow-up Day 10 ───────────────────────────────────────────────
export async function followUp10Email({ email, name }: EmailParams) {
  const subject = '🍅 Как е реколтата?'
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
      Ако искаш да направиш следващата крачка, ето продуктите, които аз лично използвам при отглеждането на домати.
      Помни, че нито един продукт не замества основата — правилното поливане, pH на почвата и торенето по фази:
    </p>
    <div style="display:grid;gap:12px;margin:20px 0">
      ${[
        { emoji: '🌿', name: 'Амалгерол', desc: 'Биостимулатор — подпомага растенията при стрес' },
        { emoji: '🌱', name: 'Турбо Рут', desc: 'Подпомага вкореняването на разсада' },
        { emoji: '🛡️', name: 'Калитех', desc: 'Калциев продукт — допълва, но не замества равномерното поливане при върховото гниене' },
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
      <a href="${shopUrl}" style="display:inline-block;background-color:#16a34a;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">
        🛒 Разгледай Продуктите
      </a>
    </div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:8px 0 0">
      Доставка с Еконт или Спиди
    </p>
  `, await footer(email), senderTagline)

  return { subject, html }
}

// ─── Изоставена поръчка (status='new' >24ч) — poll тригер, viz lib/automations.ts ──
export async function abandonedOrderEmail({ email, name, context }: EmailParams & { context?: any }) {
  // ✅ v6 — order_number escape-нат (защита в дълбочина, дори да е
  // системно генериран) и подаден и в subject, и в тялото еднакво.
  const orderNumber = esc(context?.order_number || '')
  const subject = `⚠️ Поръчка ${subjectText(context?.order_number || '', 40)} чака потвърждение`
  const { senderTagline, replyTo } = await getEmailSettings()
  const html = wrapper(`
    <p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">${greeting(name)}</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">
      Поръчката ти <strong>${orderNumber}</strong> е при нас, но все още чака обработка.
      Ако имаш въпроси или искаш да промениш нещо — пиши ни директно, отговаряме на всеки имейл.
    </p>
    <div style="text-align:center;margin:20px 0">
      <a href="mailto:${esc(replyTo)}" style="display:inline-block;background-color:#16a34a;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">
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
  // ✅ v7 — валутен символ от settings (currency_symbol), не hardcoded €.
  const symbol = await getCurrencySymbol()
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
      <p style="margin-top:10px;font-weight:800;border-top:1px solid #eee;padding-top:8px">Общо: ${total.toFixed(2)} ${symbol}</p>
    </div>
    <div style="text-align:center;margin:20px 0">
      <a href="${siteUrl}/#products" style="display:inline-block;background-color:#16a34a;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">
        Довърши поръчката →
      </a>
    </div>
  `, await footer(email), senderTagline)
  return { subject, html }
}

// Код за потвърждение на поръчка (към клиента)
// ✅ Не праща unsub линк (транзакционен имейл), wrapper() тук се вика без
// footerHtml/tagline (пада се на default-а).
// ✅ v8 — вече async: чете getCurrencySymbol() вместо hardcoded €. Викащата
// страна (app/api/orders/route.ts v9) вече праща await на двата повика.
// ✅ v6 — ВСИЧКИ полета от order (customer_name/city/address) и product_name
// вече минават през esc(). Тези стойности идват от публичната форма за
// поръчка/количката — не са ограничени до безопасни символи (за разлика от
// lead name, виж validateName() в lib/validation.ts) и преди влизаха сурови
// в HTML-а на писмото до клиента.
export async function orderConfirmationEmail({ order, items }: any) {
  // ✅ v11 — темата е plain text (преди HTML-escape: "O'Brien" → "O&#39;Brien").
  const subject = `Поръчка #${subjectText(order.order_number, 40)} — Denny Angelow`
  const symbol = await getCurrencySymbol()
  const { replyTo } = await getEmailSettings()
  const fmt = (n: unknown) => `${Number(n || 0).toFixed(2)} ${symbol}`
  const shipping = Number(order.shipping || 0)

  const itemsHtml = items.map((i: any) =>
    `<li style="font-size:14px;margin-bottom:8px"><strong>${esc(i.product_name)}</strong> (x${esc(i.quantity)}) — ${fmt(i.total_price)}</li>`
  ).join('')

  const html = wrapper(`
    <h2 style="color:#111;font-size:18px;margin-bottom:12px">Благодарим за поръчката!</h2>
    <p style="font-size:14px;color:#4b5563;margin-bottom:8px">Здравейте, ${esc(order.customer_name)}. Поръчката ви е приета и ще бъде изпратена скоро.</p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 16px">Номер на поръчката: <strong>#${esc(order.order_number)}</strong></p>
    <div style="background:#f9fafb;padding:16px;border-radius:12px;margin-bottom:16px">
      <p style="font-size:13px;font-weight:700;margin-bottom:8px">ВАШАТА ПОРЪЧКА:</p>
      <ul style="padding-left:20px;margin:0">${itemsHtml}</ul>
      <p style="margin:12px 0 0;border-top:1px solid #eee;padding-top:8px;font-size:13px;color:#4b5563">Доставка: <strong>${shipping === 0 ? 'Безплатна' : fmt(shipping)}</strong></p>
      <p style="margin:6px 0 0;font-weight:800">ОБЩО: ${fmt(order.total)}</p>
    </div>
    <p style="font-size:13px;color:#6b7280">Доставка до: ${esc(order.customer_city)}, ${esc(order.customer_address)}</p>
    <p style="font-size:13px;color:#6b7280">Въпроси по поръчката? Пишете ни на <a href="mailto:${esc(replyTo)}" style="color:#16a34a">${esc(replyTo)}</a>.</p>
  `)

  return { subject, html }
}

// Известие към теб (админа)
// ✅ v11 — тема plain text; в тялото: имейл, куриер, плащане, бележка, фактура, цени и линк към админ панела.
export async function adminNotifyEmail({ order, items, siteUrl: siteUrlParam }: any) {
  const subject = `НОВА ПОРЪЧКА: #${subjectText(order.order_number, 40)} (${subjectText(order.customer_name, 60)})`
  const symbol = await getCurrencySymbol()
  const base = siteUrlParam || siteUrl
  const fmt = (n: unknown) => `${Number(n || 0).toFixed(2)} ${symbol}`
  const nl2br = (v: unknown) => esc(v).replace(/\n/g, '<br>')

  const itemsHtml = items.map((i: any) =>
    `<li>${esc(i.product_name)} (x${esc(i.quantity)}) — ${fmt(i.total_price)}</li>`
  ).join('')

  const html = `
    <h1>Нова поръчка от сайта!</h1>
    <p><strong>Номер:</strong> #${esc(order.order_number)}</p>
    <p><strong>Клиент:</strong> ${esc(order.customer_name)}</p>
    <p><strong>Телефон:</strong> ${esc(order.customer_phone)}</p>
    ${order.customer_email ? `<p><strong>Имейл:</strong> ${esc(order.customer_email)}</p>` : ''}
    <p><strong>Адрес:</strong> ${esc(order.customer_city)}, ${esc(order.customer_address)}</p>
    <p><strong>Куриер:</strong> ${esc(order.courier || '—')} · <strong>Плащане:</strong> ${esc(order.payment_method || 'cod')}</p>
    ${order.customer_notes ? `<p><strong>Бележка:</strong> ${nl2br(order.customer_notes)}</p>` : ''}
    ${order.wants_invoice ? '<p><strong>Иска фактура</strong> — данните са в админ панела.</p>' : ''}
    <hr>
    <h3>Продукти:</h3>
    <ul>${itemsHtml}</ul>
    <p><strong>Доставка:</strong> ${Number(order.shipping || 0) === 0 ? 'Безплатна' : fmt(order.shipping)}</p>
    <p><strong>Обща сума:</strong> ${fmt(order.total)}</p>
    <p><a href="${esc(base)}/admin">Отвори админ панела</a></p>
  `

  return { subject, html }
}
