// lib/unsubscribe-token.ts — v1
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

function unsubscribeSecret(): string {
  // Fallback само ако ADMIN_SECRET липсва (напр. локална dev среда без
  // зададена стойност) — все пак произвежда валиден, консистентен токен,
  // просто не е тайна в production ако забравиш ADMIN_SECRET там.
  return process.env.ADMIN_SECRET || 'dev-unsubscribe-fallback-secret'
}

export async function createUnsubscribeToken(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase()
  return hmacHex(`unsub.${normalized}`, unsubscribeSecret())
}

export async function verifyUnsubscribeToken(email: string, token: string | undefined | null): Promise<boolean> {
  if (!token) return false
  const expected = await createUnsubscribeToken(email)
  if (expected.length !== token.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  return diff === 0
}

/** Готов линк за имейл темплейти/broadcast — вика createUnsubscribeToken вътрешно. */
export async function buildUnsubscribeUrl(siteUrl: string, email: string): Promise<string> {
  const token = await createUnsubscribeToken(email)
  return `${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`
}
