// lib/email-templates.ts

interface EmailParams {
  email: string
  name?: string
  slug?: string
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dennyangelow.com'

function greeting(name?: string) {
  return name ? `Здравей, ${name}!` : 'Здравей!'
}

function unsubLink(email: string) {
  return `${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}`
}

function footer(email: string) {
  return `
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0">
    <p style="font-size:12px;color:#9ca3af;text-align:center">
      Получаваш този имейл, защото се регистрира на dennyangelow.com.<br>
      <a href="${unsubLink(email)}" style="color:#9ca3af">Отпиши се тук</a>
    </p>
  `
}

function wrapper(content: string) {
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
      <div style="background:linear-gradient(135deg,#0f1f16,#1b4332);padding:28px 32px;text-align:center">
        <p style="font-size:28px;margin:0">🍅</p>
        <p style="color:rgba(255,255,255,.8);font-size:13px;margin:8px 0 0">Denny Angelow — Агро Консултант</p>
      </div>
      <div style="padding:28px 32px">
        ${content}
      </div>
      ${footer('')}
    </div>
  `
}

// ─── Welcome (Step 1) ───────────────────────────────────────────────
export function welcomeEmail({ email, name, slug = 'super-domati' }: EmailParams) {
  const downloadUrl = `${siteUrl}/naruchnik/${slug}?email=${encodeURIComponent(email)}${name ? `&name=${encodeURIComponent(name)}` : ''}`

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
              'Пълен календар за торене и третиране',
              'Кои продукти работят наистина',
              'Борба с болестите — органични методи',
              'Грешките, които убиват реколтата',
              'Тайните на двойния добив от един декар',
            ].map(i => `<li style="font-size:13.5px;color:#166534;font-weight:500">✓ ${i}</li>`).join('')}
          </ul>
        </div>

        <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:16px 0 0">
          Ако имаш въпроси или искаш съвет за твоята реколта — отговори директно на този имейл.
        </p>
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0">
      <p style="font-size:12px;color:#9ca3af;text-align:center;padding:16px 32px">
        Ако не желаеш да получаваш повече имейли: <a href="${unsubLink(email)}" style="color:#9ca3af">отпиши се тук</a>.
      </p>
    </div>
  `

  return { subject, html }
}

// ─── Follow-up Day 2 ────────────────────────────────────────────────
export function followUp2Email({ email, name, slug = 'super-domati' }: EmailParams) {
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
  `)

  return { subject, html }
}

// ─── Follow-up Day 5 ────────────────────────────────────────────────
export function followUp5Email({ email, name }: EmailParams) {
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
  `)

  return { subject, html }
}

// ─── Follow-up Day 10 ───────────────────────────────────────────────
export function followUp10Email({ email, name }: EmailParams) {
  const subject = '🍅 Как е реколтата? + специална оферта'
  const shopUrl = `${siteUrl}/#products`

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
        { emoji: '🌿', name: 'Atlas Terra Биостимулатор', desc: 'Укрепва корените, повишава имунитета' },
        { emoji: '🧪', name: 'Течен хумат + фулвати', desc: 'Подобрява усвояването на хранителни вещества' },
        { emoji: '🛡️', name: 'Органичен фунгицид', desc: 'Защита от фитофтора без химия' },
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
      Безплатна доставка при поръчка над 60 лв. | Еконт / Спиди
    </p>
  `)

  return { subject, html }
}
