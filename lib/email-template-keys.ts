// lib/email-template-keys.ts — v6
// ✅ v6: текстовете по подразбиране на "Пратка чака" (напомняне 1 и 2) са вече готов HTML
//    в стила на останалите писма (рамка с данни за пратката, бутон със solid background-color
//    за Yahoo/Outlook). Променливи: name, order_number, courier, tracking_number, total.
//    order_pickup_2 се показва в таб "Темплейти" като "още не е запазен" (EmailTemplatesTab v7)
//    — отваряш го, Запази, и вече го избираш като стъпка 2.
//
// (v5 по-долу)
// ✅ v5: тригерът "Изоставена поръчка" вече е "Изпратена, но не доставена" (lib/automations.ts v10).
//    • abandoned_order → ново име/текст по подразбиране: напомняне 1 (~24ч след изпращане);
//      ключът е същият, така че workflow_steps не се пипат. + променливи tracking_number, courier.
//    • НОВ ключ order_pickup_2 → напомняне 2 (~48ч). Запази го веднъж от таб "Темплейти"
//      (създава ред в email_templates), после го сложи като стъпка 2 във workflow-а.
//    Обикновен текст (без HTML) е позволен — виж lib/email-templates.ts v10+.
//    Всичко от v4 е запазено.
//
// (v4 по-долу)
//
// ✅ v4: само ТЕКСТОВЕ на дефолтите (ден 2 / ден 5 / ден 10) — подравнени с реалния PDF и без
//    непотвърдени твърдения („Глава 2“, „убива 80%“, „+ специална оферта“, „предпазва от върхово
//    гниене“). Всичко от v3 (solid background-color на бутоните) е запазено.
//
// (v3 по-долу)
//
// ПОПРАВКИ v3 (спрямо v2):
//   ✅ Същият фикс като в lib/email-templates.ts v9: всички бутони тук
//      получиха solid `background-color:#16a34a` ПРЕДИ linear-gradient-а —
//      без него Yahoo Mail/Outlook махат изцяло gradient-а и бутонът остава
//      без фон → белият текст на бутона изчезва (виж пълното обяснение в
//      email-templates.ts v9 заглавния коментар).
//      ⚠️ Тези defaultSubject/defaultBodyHtml стойности тук НЕ са самите
//      изпращани писма — те са само "начална стойност" в редактора
//      (EmailTemplatesTab.tsx), докато няма запазен ред в email_templates.
//      Истинските, вече ЗАПАЗЕНИ редове в email_templates таблицата се
//      поправят отделно със SQL UPDATE (даден в чата), не чрез тази
//      промяна — виж бележката в automations.ts: пращането чете ВИНАГИ от
//      базата, никога от тези defaults, щом вече има запазен ред.
//
// ПОПРАВКИ v2 (спрямо v1):
//   ✅ ФИКС на бъг: редакторът (EmailTemplatesTab.tsx) отваряше ПРАЗНИ
//      полета за тема/съдържание за темплейт, който още няма admin override
//      — потребителят виждаше само сивия placeholder текст (пример), не
//      РЕАЛНИЯ текст, който в момента се праща (от кодирания темплейт в
//      lib/email-templates.ts). Изглеждаше сякаш съдържанието "е изчезнало".
//      Сега всеки ключ носи defaultSubject/defaultBodyHtml — ръчно пренесено
//      копие на реалния текст от съответната функция в email-templates.ts,
//      във формàта с {{var}} placeholder-и. Редакторът ги ползва като
//      начална стойност, докато няма запазен override — така администраторът
//      винаги вижда и редактира РЕАЛНИЯ текущ текст, не празен лист.
//      ⚠️ Ако промениш кодирания текст в email-templates.ts, обнови и тук,
//      за да не се разминат "видимото по подразбиране" и "реално изпратеното".
//
// Единен списък на всички email темплейт ключове + четливи имена + кои
// {{променливи}} поддържа всеки за override-ите в email_templates таблицата.
// ЕДИНСТВЕН източник на истина за:
//   - app/admin/components/AutomationsTab.tsx   (dropdown при добавяне на стъпка)
//   - app/admin/components/EmailTemplatesTab.tsx (редактор на съдържание)
//   - app/api/admin/email-templates/route.ts     (GET списък)
//   - app/api/admin/email-templates/[key]/route.ts (валидация на key)
//
// Преди TEMPLATE_OPTIONS живееше само в AutomationsTab.tsx с коментар
// "добавяй нов ред тук ВИНАГИ заедно с нов ред в lib/automations.ts" —
// лесно за разминаване (два файла да поддържаш синхронизирани ръчно).
// Сега добавяш нов темплейт САМО тук + в lib/automations.ts TEMPLATE_REGISTRY.

export interface TemplateKeyMeta {
  key:   string
  label: string
  // Кои {{var}} placeholder-и реално се попълват за този темплейт —
  // виж buildCustomEmail() в lib/email-templates.ts за пълния списък
  // и откъде идва всяка стойност.
  vars:  string[]
  // ✅ v2 — реалният текст, който се праща в момента (копие на кодирания
  // темплейт, преведено в {{var}} формат). Служи само за предварително
  // попълване на редактора — не участва в самото изпращане, докато
  // администраторът не натисне "Запази" (което чак тогава създава истински
  // ред в email_templates).
  defaultSubject:  string
  defaultBodyHtml: string
}

export const TEMPLATE_KEYS: TemplateKeyMeta[] = [
  {
    key: 'naruchnik_welcome', label: 'Naruchnik — Welcome (ден 0)',
    vars: ['name', 'email', 'pdf_url', 'page_url'],
    defaultSubject: '{{name}}, ето твоя наръчник! 📗',
    defaultBodyHtml:
`<p style="font-size:16px;font-weight:600;color:#111;margin:0 0 12px">Здравей, {{name}}!</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 20px">Регистрацията е успешна! Наръчникът е готов за изтегляне — кликни на бутона по-долу.</p>
<div style="text-align:center;margin:24px 0">
  <a href="{{pdf_url}}" style="display:inline-block;background-color:#16a34a;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:16px 32px;text-decoration:none;font-weight:900;font-size:16px">📥 Изтегли Наръчника (PDF)</a>
</div>
<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0">Ако бутонът не се отвори — <a href="{{pdf_url}}" style="color:#16a34a;font-weight:700">кликни тук</a>. Ако имаш въпроси или искаш съвет за твоята реколта — отговори директно на този имейл.</p>`,
  },
  {
    key: 'naruchnik_followup2', label: 'Naruchnik — Follow-up ден 2',
    vars: ['name', 'email', 'pdf_url', 'page_url'],
    defaultSubject: '📌 Следваш ли схемата по фази?',
    defaultBodyHtml:
`<p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">Здравей, {{name}}!</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Надявам се вече си разгледал наръчника! Искам да те насоча към <strong>раздел 4 — нуждите на растението по фази</strong>. Там има таблици за температура, влажност, светлина и торене във всяка от петте фази — какво да даваш и кога.</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 20px">Ако искаш да разбереш и <em>защо</em> стои зад всяка фаза, прочети <a href="https://dennyangelow.com/blog/shema-torene-domati-po-fazi" style="color:#16a34a;font-weight:700">схемата за торене на домати по фази</a>.</p>
<div style="text-align:center;margin:20px 0">
  <a href="{{pdf_url}}" style="display:inline-block;background-color:#16a34a;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">📖 Отвори Наръчника</a>
</div>
<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0">Имаш въпрос за торовете? Отговори директно на този имейл — четем всяко писмо.</p>`,
  },
  {
    key: 'naruchnik_followup5', label: 'Naruchnik — Follow-up ден 5',
    vars: ['name', 'email', 'page_url'],
    defaultSubject: '🌱 Най-честата грешка при поливането на домати',
    defaultBodyHtml:
`<p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">Здравей, {{name}}!</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Знаеш ли коя е една от най-честите грешки при доматите? <strong>Нередовната влага</strong>.</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Доматите понасят зле резките смени: суша, после обилна поливка може да доведе до напукани плодове и върхово гниене.</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Мокрите листа през нощта улесняват гъбичните болести — мана и сиво гниене.</p>
<div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:14px 18px;margin:16px 0">
  <p style="font-size:13.5px;color:#713f12;font-weight:600;margin:0">💡 Съвет: Полявай в основата на растението, за предпочитане рано сутрин, и мулчирай. Така влагата е равномерна, а листата остават сухи.</p>
</div>
<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0">В раздел 3 на наръчника — „Поливане: златните правила“ — са събрани седемте правила за поливане. Ако все още не си го изтеглил — <a href="{{page_url}}" style="color:#16a34a;font-weight:700">вземи го тук</a>.</p>`,
  },
  {
    key: 'naruchnik_followup10', label: 'Naruchnik — Follow-up ден 10',
    vars: ['name', 'email', 'shop_url'],
    defaultSubject: '🍅 Как е реколтата?',
    defaultBodyHtml:
`<p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">Здравей, {{name}}!</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Минаха 10 дни откакто изтегли наръчника — как вървят нещата?</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Ако искаш да направиш следващата крачка, ето продуктите, които аз лично използвам при отглеждането на домати. Помни, че нито един продукт не замества основата — правилното поливане, pH на почвата и торенето по фази:</p>
<div style="display:grid;gap:12px;margin:20px 0">
  <div style="display:flex;gap:14px;align-items:flex-start;background:#f8fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px">
    <span style="font-size:26px">🌿</span>
    <div><p style="font-size:14px;font-weight:700;color:#111;margin:0 0 3px">Амалгерол</p><p style="font-size:12.5px;color:#6b7280;margin:0">Биостимулатор — подпомага растенията при стрес</p></div>
  </div>
  <div style="display:flex;gap:14px;align-items:flex-start;background:#f8fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px">
    <span style="font-size:26px">🌱</span>
    <div><p style="font-size:14px;font-weight:700;color:#111;margin:0 0 3px">Турбо Рут</p><p style="font-size:12.5px;color:#6b7280;margin:0">Подпомага вкореняването на разсада</p></div>
  </div>
  <div style="display:flex;gap:14px;align-items:flex-start;background:#f8fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px">
    <span style="font-size:26px">🛡️</span>
    <div><p style="font-size:14px;font-weight:700;color:#111;margin:0 0 3px">Калитех</p><p style="font-size:12.5px;color:#6b7280;margin:0">Калциев продукт — допълва, но не замества равномерното поливане при върховото гниене</p></div>
  </div>
</div>
<div style="text-align:center;margin:20px 0">
  <a href="{{shop_url}}" style="display:inline-block;background-color:#16a34a;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">🛒 Разгледай Продуктите</a>
</div>
<p style="font-size:12px;color:#9ca3af;text-align:center;margin:8px 0 0">Доставка с Еконт или Спиди</p>`,
  },
  {
    key: 'abandoned_order', label: 'Пратка чака — напомняне 1 (~24ч след изпращане)',
    vars: ['name', 'email', 'order_number', 'tracking_number', 'courier', 'total'],
    defaultSubject: '📦 Пратката ти по поръчка {{order_number}} те очаква',
    defaultBodyHtml:
`<p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">Здравей, {{name}}!</p>
<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px">Пратката ти по поръчка <strong>{{order_number}}</strong> е изпратена и <strong>те очаква за получаване</strong>. Моля, вземи я от куриера при първа възможност.</p>
<div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin:20px 0">
  <p style="font-size:11px;font-weight:800;color:#15803d;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">📦 Данни за пратката</p>
  <p style="font-size:14px;color:#166534;line-height:1.9;margin:0">Поръчка: <strong>{{order_number}}</strong><br>Куриер: <strong>{{courier}}</strong><br>Товарителница: <strong>{{tracking_number}}</strong><br>Обща сума: <strong>{{total}}</strong></p>
</div>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Ако куриерът не те е намерил или нещо те затруднява, просто отговори на това писмо — ще ти помогнем.</p>
<div style="text-align:center;margin:20px 0">
  <a href="mailto:support@dennyangelow.com" style="display:inline-block;background-color:#16a34a;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">Имам въпрос за пратката →</a>
</div>`,
  },
  {
    key: 'order_pickup_2', label: 'Пратка чака — напомняне 2 (~48ч след изпращане)',
    vars: ['name', 'email', 'order_number', 'tracking_number', 'courier', 'total'],
    defaultSubject: '⏰ Пратката по поръчка {{order_number}} още те очаква',
    defaultBodyHtml:
`<p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">Здравей, {{name}}!</p>
<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px">Напомняме ти, че пратката по поръчка <strong>{{order_number}}</strong> още не е получена. Моля, вземи я при първа възможност.</p>
<div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 20px;margin:20px 0">
  <p style="font-size:11px;font-weight:800;color:#15803d;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">📦 Данни за пратката</p>
  <p style="font-size:14px;color:#166534;line-height:1.9;margin:0">Поръчка: <strong>{{order_number}}</strong><br>Куриер: <strong>{{courier}}</strong><br>Товарителница: <strong>{{tracking_number}}</strong><br>Обща сума: <strong>{{total}}</strong></p>
</div>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Ако не можеш да я получиш на този адрес или в този офис, отговори на това писмо и ще намерим решение.</p>
<div style="text-align:center;margin:20px 0">
  <a href="mailto:support@dennyangelow.com" style="display:inline-block;background-color:#16a34a;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">Имам въпрос за пратката →</a>
</div>`,
  },
  {
    key: 'abandoned_cart', label: 'Изоставена количка',
    vars: ['name', 'email', 'shop_url', 'total'],
    defaultSubject: '🛒 Забрави нещо в количката си?',
    defaultBodyHtml:
`<p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">Здравей, {{name}}!</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Забеляза, че си оставил/а продукти в количката си на обща стойност <strong>{{total}}</strong>.</p>
<div style="text-align:center;margin:20px 0">
  <a href="{{shop_url}}" style="display:inline-block;background-color:#16a34a;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">Довърши поръчката →</a>
</div>`,
  },
]
