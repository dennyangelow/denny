// middleware.ts — v12
// ✅ v11 → v12 (сигурност):
//    1. '/api/admin' е в PROTECTED_API_PREFIXES. Преди v12 маршрути като
//       /api/admin/naruchnici и /api/admin/naruchnici/[id]/seo НЕ съвпадаха с
//       никой префикс и минаваха през общото "if (pathname.startsWith('/api'))
//       → next()" без вход — т.е. всеки можеше да чете наръчниците и да
//       променя meta/FAQ/съдържание на живия сайт. /api/admin/auth остава
//       публичен (проверява се по-рано в isPublicApiRequest).
//    2. Липсващ ADMIN_SECRET вече НЕ отваря админа в production (fail-closed).
//       Локално (NODE_ENV !== 'production') остава отворено, както преди —
//       точно както вече прави app/api/admin/auth/route.ts.
// ✅ v10 → v11: добавени публични изключения за SES SNS webhook-а
//    (/api/webhooks/ses) и abandoned-cart tracking endpoint-а
//    (/api/carts/track) — нито двата не носят admin cookie.
//    /api/leads/sync вече не съществува като route, затова е премахнат
//    от PROTECTED_API_PREFIXES.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin-session'

const loginAttempts = new Map<string, { count: number; until: number }>()

function securityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

function isPublicApiRequest(pathname: string, method: string): boolean {
  if (pathname === '/api/site-data')                                              return true
  if (pathname === '/api/naruchnici' && method === 'GET')                         return true
  if (pathname === '/api/affiliate-products' && method === 'GET')                  return true
  if (pathname === '/api/orders' && method === 'POST')                             return true
  if (pathname.match(/^\/api\/orders\/[^/]+\/notify$/) && method === 'POST')       return true
  if (pathname === '/api/leads' && method === 'POST')                              return true
  // ✅ НОВО: публична форма за отзиви — винаги пише status='pending' на
  //    сървъра (виж route.ts), затова е безопасно публична. /api/reviews
  //    (admin CRUD) остава защитен — само тази под-пътека е изключение.
  if (pathname === '/api/reviews/submit' && method === 'POST')                     return true
  if (pathname === '/api/leads/unsubscribe')                                        return true
  if (pathname === '/api/leads/sequence' && method === 'GET')                      return true
  if (pathname.startsWith('/api/analytics/'))                                       return true
  // ✅ SES → SNS webhook: няма admin cookie, вика се от Amazon SNS директно.
  //    Собствената защита е вградена в самия route (SNS subscription flow).
  if (pathname === '/api/webhooks/ses' && method === 'POST')                       return true
  // ✅ Abandoned-cart tracking: вика се от клиента (CartSystem.tsx) докато
  //    пише в checkout формата, преди да има admin сесия — POST за draft
  //    запис, DELETE при успешна поръчка. И двата остават публични.
  if (pathname === '/api/carts/track')                                             return true
  if (pathname === '/api/admin/auth')                                               return true
  if (pathname === '/api/marketing' && method === 'GET')                           return true
  // ✅ Блог: GET е публичен (списък + единичен пост през ?slug=) — само
  //    POST/PATCH/DELETE минават под admin token-а (виж PROTECTED_API_PREFIXES).
  if (pathname === '/api/blog' && method === 'GET')                                return true
  // ✅ Категориите: GET публичен (чете ги и /blog, и admin панела) —
  //    POST/PATCH/DELETE минават под admin token-а.
  if (pathname === '/api/blog-categories' && method === 'GET')                     return true
  return false
}

const PROTECTED_API_PREFIXES = [
  '/api/settings',
  '/api/own-products',
  '/api/affiliate-products',
  '/api/testimonials',
  '/api/reviews',      // ← обединената reviews/testimonials система
  '/api/naruchnici',
  '/api/faq',
  '/api/category-links',
  '/api/ginegar',
  '/api/upload',
  '/api/leads/broadcast',
  '/api/leads',
  '/api/orders',
  '/api/marketing',
  '/api/earnings',     // ← финансов лог, само за admin
  '/api/email-stats',  // ← open/click/bounce статистики, само за admin
  '/api/blog',         // ← POST/PATCH/DELETE на блог постове, само за admin (GET е публичен, виж isPublicApiRequest)
  '/api/blog-categories', // ← POST/PATCH/DELETE на категории, само за admin (GET е публичен)
  '/api/admin',        // ← v12: всички /api/admin/* освен /api/admin/auth (то е публично по-горе)
]

function isProtectedApi(pathname: string, method: string): boolean {
  if (isPublicApiRequest(pathname, method)) return false
  return PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))
}

// ✅ ФИКС: преди сравняваше cookie-то директно с ADMIN_SECRET (самата
// парола, съхранена в cookie — изтекло cookie = изтекла парола, никакъв
// TTL, изтичане само чрез смяна на паролата). Сега проверява подписан
// сесиен токен (lib/admin-session.ts) — не разкрива паролата в cookie-то,
// изтича сам по себе си, и Edge-съвместим (crypto.subtle), затова
// middleware вече е async.
async function isValidToken(req: NextRequest): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET
  // v12: без secret → отворено САМО при локална разработка, никога в production
  if (!secret) return process.env.NODE_ENV !== 'production'
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  return verifySessionToken(token, secret)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const method = req.method

  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
    return securityHeaders(NextResponse.next())
  }

  if (isPublicApiRequest(pathname, method)) {
    return securityHeaders(NextResponse.next())
  }

  if (isProtectedApi(pathname, method)) {
    if (!(await isValidToken(req))) {
      return NextResponse.json(
        { error: 'Неоторизиран достъп' },
        { status: 401, headers: { 'WWW-Authenticate': 'Cookie' } }
      )
    }
    return securityHeaders(NextResponse.next())
  }

  if (pathname.startsWith('/api')) {
    return securityHeaders(NextResponse.next())
  }

  if (pathname.startsWith('/admin/login')) {
    return securityHeaders(NextResponse.next())
  }

  const ip      = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const attempt = loginAttempts.get(ip)

  if (attempt && attempt.count >= 10 && attempt.until > Date.now()) {
    return new NextResponse('Too many requests', { status: 429 })
  }

  if (await isValidToken(req)) {
    loginAttempts.delete(ip)
    return securityHeaders(NextResponse.next())
  }

  if (attempt) {
    attempt.count++
    if (attempt.count >= 10) attempt.until = Date.now() + 15 * 60 * 1000
  } else {
    loginAttempts.set(ip, { count: 1, until: 0 })
  }

  const loginUrl = new URL('/admin/login', req.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

// ОРИГИНАЛЕН matcher от v7 — само /admin и /api
export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
}
