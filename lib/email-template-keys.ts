// lib/email-template-keys.ts — v2
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
  <a href="{{pdf_url}}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:16px 32px;text-decoration:none;font-weight:900;font-size:16px">📥 Изтегли Наръчника (PDF)</a>
</div>
<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0">Ако бутонът не се отвори — <a href="{{pdf_url}}" style="color:#16a34a;font-weight:700">кликни тук</a>. Ако имаш въпроси или искаш съвет за твоята реколта — отговори директно на този имейл.</p>`,
  },
  {
    key: 'naruchnik_followup2', label: 'Naruchnik — Follow-up ден 2',
    vars: ['name', 'email', 'pdf_url', 'page_url'],
    defaultSubject: '📌 Прочете ли Глава 2 от наръчника?',
    defaultBodyHtml:
`<p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">Здравей, {{name}}!</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Надявам се вече си разгледал наръчника! Искам да те насоча към <strong>Глава 2 — Торенето</strong>. Там ще намериш точния график, по месеци, кое и кога да приложиш за максимален добив.</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 20px">Повечето хора пропускат тази стъпка и после се чудят защо доматите им не растат добре. 😅</p>
<div style="text-align:center;margin:20px 0">
  <a href="{{pdf_url}}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">📖 Отвори Наръчника</a>
</div>
<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0">Имаш въпрос за торовете? Отговори директно на този имейл — четем всяко писмо.</p>`,
  },
  {
    key: 'naruchnik_followup5', label: 'Naruchnik — Follow-up ден 5',
    vars: ['name', 'email', 'page_url'],
    defaultSubject: '🌱 Тази грешка убива 80% от доматите...',
    defaultBodyHtml:
`<p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">Здравей, {{name}}!</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Знаеш ли коя е <strong>грешката №1</strong>, която правят повечето градинари с домати?</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px"><strong>Поливат твърде много</strong> — и то в грешното време на деня.</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Доматите обичат умерена влага, но мразят „мокри крака". Поливането вечер оставя листата влажни цяла нощ — идеална среда за <em>фитофтора</em> и <em>сиво гниене</em>.</p>
<div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:14px 18px;margin:16px 0">
  <p style="font-size:13.5px;color:#713f12;font-weight:600;margin:0">💡 Съвет: Полявай сутрин, в основата на растението. Листата трябва да са сухи преди залез.</p>
</div>
<p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0">В наръчника има цял раздел за напояването с точни количества и честота по сезон. Ако все още не си го изтеглил — <a href="{{page_url}}" style="color:#16a34a;font-weight:700">вземи го тук</a>.</p>`,
  },
  {
    key: 'naruchnik_followup10', label: 'Naruchnik — Follow-up ден 10',
    vars: ['name', 'email', 'shop_url'],
    defaultSubject: '🍅 Как е реколтата? + специална оферта',
    defaultBodyHtml:
`<p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">Здравей, {{name}}!</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Минаха 10 дни откакто изтегли наръчника — как вървят нещата?</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Ако искаш да направиш следващата крачка и да получиш <strong>едри, здрави домати с минимален труд</strong>, разгледай продуктите, които аз лично използвам:</p>
<div style="display:grid;gap:12px;margin:20px 0">
  <div style="display:flex;gap:14px;align-items:flex-start;background:#f8fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px">
    <span style="font-size:26px">🌿</span>
    <div><p style="font-size:14px;font-weight:700;color:#111;margin:0 0 3px">Амалгерол</p><p style="font-size:12.5px;color:#6b7280;margin:0">100% природен биостимулатор — щит срещу стреса на растението</p></div>
  </div>
  <div style="display:flex;gap:14px;align-items:flex-start;background:#f8fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px">
    <span style="font-size:26px">🌱</span>
    <div><p style="font-size:14px;font-weight:700;color:#111;margin:0 0 3px">Турбо Рут</p><p style="font-size:12.5px;color:#6b7280;margin:0">Стимулира бързото вкореняване на разсада</p></div>
  </div>
  <div style="display:flex;gap:14px;align-items:flex-start;background:#f8fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px">
    <span style="font-size:26px">🛡️</span>
    <div><p style="font-size:14px;font-weight:700;color:#111;margin:0 0 3px">Калитех</p><p style="font-size:12.5px;color:#6b7280;margin:0">Калциев биостимулатор — предпазва от върхово гниене</p></div>
  </div>
</div>
<div style="text-align:center;margin:20px 0">
  <a href="{{shop_url}}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">🛒 Разгледай Продуктите</a>
</div>
<p style="font-size:12px;color:#9ca3af;text-align:center;margin:8px 0 0">Безплатна доставка при поръчка над 60 € | Еконт / Спиди</p>`,
  },
  {
    key: 'abandoned_order', label: 'Изоставена поръчка',
    vars: ['name', 'email', 'order_number'],
    defaultSubject: '⚠️ Поръчка {{order_number}} чака потвърждение',
    defaultBodyHtml:
`<p style="font-size:16px;font-weight:700;color:#111;margin:0 0 12px">Здравей, {{name}}!</p>
<p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 16px">Поръчката ти <strong>{{order_number}}</strong> е при нас, но все още чака обработка. Ако имаш въпроси или искаш да промениш нещо — пиши ни директно, отговаряме на всеки имейл.</p>
<div style="text-align:center;margin:20px 0">
  <a href="mailto:support@dennyangelow.com" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">Свържи се с нас →</a>
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
  <a href="{{shop_url}}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;border-radius:12px;padding:14px 28px;text-decoration:none;font-weight:800;font-size:15px">Довърши поръчката →</a>
</div>`,
  },
]
