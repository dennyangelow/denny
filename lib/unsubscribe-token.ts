// lib/unsubscribe-token.ts — v2
// ✅ v2 (сигурност): отделна тайна за unsubscribe линковете.
//   • Преди: подписваше се с ADMIN_SECRET → смяна на админ паролата прекъсваше ВСИЧКИ unsubscribe
//     линкове в вече изпратените имейли (а отписването трябва да работи).
//   • Сега: UNSUBSCRIBE_SECRET (нова тайна) подписва новите линкове; проверката приема още
//     UNSUBSCRIBE_SECRET_LEGACY (старата стойност на ADMIN_SECRET, за вече изпратените имейли)
//     и ADMIN_SECRET (за прехода). Когато няма нито една тайна в production, функциите хвърлят грешка
//     вместо тихо да ползват предвидима резервна стойност.
//
//   КАК ДА ГО ВКЛЮЧИШ (ред!): 1) в .env.local и във Vercel: UNSUBSCRIBE_SECRET=<нов дълъг произволен низ>
//   и UNSUBSCRIBE_SECRET_LEGACY=<ТЕКУЩАТА стойност на ADMIN_SECRET>;  2) качи този файл;
//   3) чак тогава смени ADMIN_SECRET. След 3–6 месеца махни UNSUBSCRIBE_SECRET_LEGACY.
//
// (v1 по-долу)
// ✅ НОВ файл. Подписан токен за публичните unsubscribe линкове.
//
// Преди: /unsubscribe?email=X праща direct POST към /api/leads/unsubscribe
// само с email — никаква проверка, че заявката идва от собственика на
// имейла. Всеки, който знае/познае нечий email, може да го отпише с линк
// от рода на dennyangelow.com/unsubscribe?email=жертва@example.com.
//
// Сега всеки unsubscribe линк носи и &token=..., изчислен от email-а с
// HMAC (Web Crypto, работи и в Node, и в Edge). /api/leads/unsubscribe
// вече го изисква — без валиден token искането се отхвърля.
//
// ⚠️ Ползва ADMIN_SECRET като HMAC ключ само за удобство (вече е тайна,
// налична в средата) — не е свързано с admin логина, различен HMAC domain
// separation string ("unsub") гарантира, че token-ът не може да се ползва
// за нищо друго дори ако някой се опита да го комбинира с admin auth кода.

const enc = new TextEncoder()

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Тайната, с която се ПОДПИСВАТ новите линкове.
function signingSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.ADMIN_SECRET
  if (s) return s
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[unsubscribe-token] липсва UNSUBSCRIBE_SECRET (и ADMIN_SECRET) в production')
  }
  return 'dev-unsubscribe-fallback-secret'   // само за локална разработка
}

// Тайните, срещу които се ПРОВЕРЯВАТ линковете (нова + стара + прехода).
function verifySecrets(): string[] {
  const list = [process.env.UNSUBSCRIBE_SECRET, process.env.UNSUBSCRIBE_SECRET_LEGACY, process.env.ADMIN_SECRET]
    .filter((x): x is string => !!x)
  if (list.length === 0 && process.env.NODE_ENV !== 'production') list.push('dev-unsubscribe-fallback-secret')
  return Array.from(new Set(list))
}

function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function createUnsubscribeToken(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase()
  return hmacHex(`unsub.${normalized}`, signingSecret())
}

export async function verifyUnsubscribeToken(email: string, token: string | undefined | null): Promise<boolean> {
  if (!token) return false
  const normalized = email.trim().toLowerCase()
  let ok = false
  for (const secret of verifySecrets()) {           // без ранно излизане — еднакво време
    const expected = await hmacHex(`unsub.${normalized}`, secret)
    if (equalHex(expected, token)) ok = true
  }
  return ok
}

/** Готов линк за имейл темплейти/broadcast — вика createUnsubscribeToken вътрешно. */
export async function buildUnsubscribeUrl(siteUrl: string, email: string): Promise<string> {
  const token = await createUnsubscribeToken(email)
  return `${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`
}
