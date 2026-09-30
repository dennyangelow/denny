// lib/admin-session.ts — v1
// Подписан сесиен токен за admin cookie. Ползва САМО Web Crypto (crypto.subtle),
// затова работи и в Edge (middleware.ts), и в Node (app/api/admin/auth/route.ts).
//
// Преди: cookie-то `admin_token` съдържаше самата ADMIN_SECRET парола —
// изтекло cookie = изтекла парола. Сега: `v1.<изтичане>.<hmac>` — не
// разкрива паролата, изтича след TTL, а смяна на ADMIN_SECRET обезсилва
// всички сесии наведнъж.

const enc = new TextEncoder()

export const ADMIN_COOKIE    = 'admin_token'
export const SESSION_TTL_SEC = 60 * 60 * 24 * 7 // 7 дни

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Сравнение с константно време (двата низа са hex с една и съща дължина). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Сравнява въведената парола със secret без timing разлики. */
export async function passwordMatches(input: string, secret: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    hmacHex(input,  'admin-pw-compare'),
    hmacHex(secret, 'admin-pw-compare'),
  ])
  return safeEqual(a, b)
}

export async function createSessionToken(secret: string, ttlSec = SESSION_TTL_SEC): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSec
  const sig = await hmacHex(`v1.${exp}`, secret)
  return `v1.${exp}.${sig}`
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return false
  const exp = Number(parts[1])
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false
  const expected = await hmacHex(`v1.${parts[1]}`, secret)
  return safeEqual(expected, parts[2])
}
