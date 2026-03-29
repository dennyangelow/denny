// middleware.ts — v2 FINAL
// Обединява:
//   - security headers на всички отговори (от оригинала)
//   - rate limiting за login (от оригинала)
//   - защита на /admin/* UI с redirect (от оригинала)
//   - защита на мутиращи API routes с JSON 401 (НОВО)

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ── In-edge rate limiter за login опити ──────────────────────────────────────
const loginAttempts = new Map<string, { count: number; until: number }>()

// ── Security headers ─────────────────────────────────────────────────────────
function securityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

// ── API routes, достъпни публично (без auth) ──────────────────────────────────
function isPublicApiRequest(pathname: string, method: string): boolean {
  if (pathname === '/api/site-data')                                    return true
  if (pathname === '/api/naruchnici' && method === 'GET')               return true
  if (pathname === '/api/naruchnici/track')                             return true
  if (pathname === '/api/orders' && method === 'POST')                  return true
  if (pathname === '/api/leads' && method === 'POST')                   return true
  if (pathname === '/api/leads/unsubscribe')                            return true
  if (pathname === '/api/leads/sequence' && method === 'GET')           return true
  if (pathname.startsWith('/api/analytics/'))                           return true
  if (pathname === '/api/admin/auth')                                   return true
  return false
}

// ── API routes, които изискват admin auth ────────────────────────────────────
const PROTECTED_API_PREFIXES = [
  '/api/settings',
  '/api/own-products',
  '/api/affiliate-products',
  '/api/testimonials',
  '/api/naruchnici',
  '/api/faq',
  '/api/category-links',
  '/api/ginegar',
  '/api/upload',
  '/api/leads/broadcast',
  '/api/orders',
  '/api/analytics',
]

function isProtectedApi(pathname: string, method: string): boolean {
  if (isPublicApiRequest(pathname, method)) return false
  return PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))
}

// ── Проверка на admin token ──────────────────────────────────────────────────
function isValidToken(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return true // dev режим без secret
  const token = req.cookies.get('admin_token')?.value
  return token === secret
}

// ── Middleware ───────────────────────────────────────────────────────────────
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const method = req.method

  // 1. Всичко извън /admin и /api → само security headers
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
    return securityHeaders(NextResponse.next())
  }

  // 2. Защита на мутиращи API routes
  if (isProtectedApi(pathname, method)) {
    if (!isValidToken(req)) {
      return NextResponse.json(
        { error: 'Неоторизиран достъп' },
        { status: 401, headers: { 'WWW-Authenticate': 'Cookie' } }
      )
    }
    return securityHeaders(NextResponse.next())
  }

  // 3. Публични API routes — само headers
  if (pathname.startsWith('/api')) {
    return securityHeaders(NextResponse.next())
  }

  // 4. /admin/login — публична страница
  if (pathname.startsWith('/admin/login')) {
    return securityHeaders(NextResponse.next())
  }

  // 5. Останалите /admin/* — rate limiting + token проверка
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const attempt = loginAttempts.get(ip)

  if (attempt && attempt.count >= 10 && attempt.until > Date.now()) {
    return new NextResponse('Too many requests', { status: 429 })
  }

  if (isValidToken(req)) {
    loginAttempts.delete(ip)
    return securityHeaders(NextResponse.next())
  }

  if (attempt) {
    attempt.count++
    if (attempt.count >= 10) {
      attempt.until = Date.now() + 15 * 60 * 1000
    }
  } else {
    loginAttempts.set(ip, { count: 1, until: 0 })
  }

  const loginUrl = new URL('/admin/login', req.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
  ],
}
