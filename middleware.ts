// middleware.ts — v15
// ✅ v14 → v15 (сигурност) — fail-closed по подразбиране:
//    Преди: защитата работеше със СПИСЪК от префикси (PROTECTED_API_PREFIXES)
//    — всеки нов или забравен route оставаше отворен. Така останаха публични
//    без вход: /api/customers/* (клиенти, телефони, бележки, call queue),
//    /api/promo-banners/*, /api/special-sections/* (промяна на живия сайт),
//    /api/econt/debug.
//    Сега: ВСЕКИ /api/* изисква admin вход, освен изрично изброените в
//    isPublicApiRequest(). Нов route е защитен автоматично; ако трябва да е
//    публичен, добавя се там ръчно.
//    Публични (явно): econt cities/offices (checkout), /api/cron/* (проверяват
//    собствен секрет в route-а — ПРОВЕРИ app/api/cron/discord-fallback/route.ts).
//    Махнат е остарелият публичен изключение за /api/leads/sequence (route няма).
// ✅ v13 → v14 (сигурност):
//    /api/automations/* (workflows списък/създаване/промяна/ИЗТРИВАНЕ) не
//    съвпадаше с нито един префикс и минаваше през общото "/api → next()"
//    без вход — всеки можеше да чете, променя и трие автоматизациите.
//    Сега '/api/automations' е защитен. Изключение: GET /api/automations/tick
//    (вика се от pg_cron, без admin cookie) — той се защитава сам с
//    CRON_SECRET в самия route.
// ✅ v12 → v13 (сигурност):
//    /api/analytics/* беше изцяло публичен (включително GET), така че всеки
//    можеше да чете посещенията, кликовете и топ страниците на сайта.
//    Сега само POST (записване на page view / affiliate клик / product event)
//    е публичен — идва от посетителите без admin cookie. GET (статистиките)
//    изисква admin вход и е добавен в PROTECTED_API_PREFIXES.
//    Админ панелът (useAdminData.ts, AnalyticsTab.tsx) вика GET със същия
//    origin, така че браузърът праща cookie-то автоматично.
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
  // ✅ v13: само POST (запис от посетители) е публичен; GET статистиките са за admin
  if (pathname.startsWith('/api/analytics/') && method === 'POST')                  return true
  // ✅ SES → SNS webhook: няма admin cookie, вика се от Amazon SNS директно.
  //    Собствената защита е вградена в самия route (SNS subscription flow).
  if (pathname === '/api/webhooks/ses' && method === 'POST')                       return true
  // ✅ Abandoned-cart tracking: вика се от клиента (CartSystem.tsx) докато
  //    пише в checkout формата, преди да има admin сесия — POST за draft
  //    запис, DELETE при успешна поръчка. И двата остават публични.
  if (pathname === '/api/carts/track')                                             return true
  if (pathname === '/api/admin/auth')                                               return true
  // ✅ v14: cron executor — няма admin cookie, проверява Bearer CRON_SECRET в route.ts
  if (pathname === '/api/automations/tick' && method === 'GET')                    return true
  // ✅ v15: checkout търсачките за градове/офиси на Еконт — вика ги публичната форма
  if (pathname === '/api/econt/cities' || pathname === '/api/econt/offices')        return true
  // ✅ v15: cron задачи — извиква ги планировчик без admin cookie; защитават се сами
  //    със секрет вътре в route-а (Bearer CRON_SECRET).
  if (pathname.startsWith('/api/cron/'))                                            return true
  if (pathname === '/api/marketing' && method === 'GET')                           return true
  // ✅ Блог: GET е публичен (списък + единичен пост през ?slug=) — само
  //    POST/PATCH/DELETE минават под admin token-а.
  if (pathname === '/api/blog' && method === 'GET')                                return true
  // ✅ Категориите: GET публичен (чете ги и /blog, и admin панела) —
  //    POST/PATCH/DELETE минават под admin token-а.
  if (pathname === '/api/blog-categories' && method === 'GET')                     return true
  return false
}

// ✅ v15: PROTECTED_API_PREFIXES е премахнат — всичко под /api е защитено, освен
//    публичните изключения по-горе (fail-closed).

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

  if (pathname.startsWith('/api')) {
    if (!(await isValidToken(req))) {
      return NextResponse.json(
        { error: 'Неоторизиран достъп' },
        { status: 401, headers: { 'WWW-Authenticate': 'Cookie' } }
      )
    }
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
