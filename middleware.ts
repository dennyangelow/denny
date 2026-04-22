// middleware.ts — v7
// ПРОМЕНИ спрямо v6:
//   ✅ /api/affiliate-clicks POST добавен като публичен route
//      (извиква се от клиента при клик върху affiliate бутон — без auth)

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
  if (pathname === '/api/naruchnici/track')                                        return true
  if (pathname === '/api/affiliate-products' && method === 'GET')                  return true
  // ✅ Логване на affiliate кликове — публично (без auth)
  if (pathname === '/api/affiliate-clicks' && method === 'POST')                   return true
  if (pathname === '/api/orders' && method === 'POST')                             return true
  if (pathname.match(/^\/api\/orders\/[^/]+\/notify$/) && method === 'POST')       return true
  if (pathname === '/api/leads' && method === 'POST')                              return true
  if (pathname === '/api/leads/unsubscribe')                                        return true
  if (pathname === '/api/leads/sequence' && method === 'GET')                      return true
  if (pathname.startsWith('/api/analytics/'))                                       return true
  if (pathname === '/api/admin/auth')                                               return true
  if (pathname === '/api/marketing' && method === 'GET')                           return true
  return false
}

const PROTECTED_API_PREFIXES = [
  '/api/settings',
  '/api/own-products',
  '/api/affiliate-products',
  '/api/affiliate-clicks',   // GET (admin статистики) е защитен; POST е публичен (горе)
  '/api/testimonials',
  '/api/naruchnici',
  '/api/faq',
  '/api/category-links',
  '/api/ginegar',
  '/api/upload',
  '/api/leads/broadcast',
  '/api/leads/sync',
  '/api/leads',
  '/api/orders',
  '/api/marketing',
]

function isProtectedApi(pathname: string, method: string): boolean {
  if (isPublicApiRequest(pathname, method)) return false
  return PROTECTED_API_PREFIXES.some(p => pathname.startsWith(p))
}

function isValidToken(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return true
  const token = req.cookies.get('admin_token')?.value
  return token === secret
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const method = req.method

  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
    return securityHeaders(NextResponse.next())
  }

  if (isPublicApiRequest(pathname, method)) {
    return securityHeaders(NextResponse.next())
  }

  if (isProtectedApi(pathname, method)) {
    if (!isValidToken(req)) {
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

  if (isValidToken(req)) {
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

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
}
