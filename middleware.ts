// middleware.ts — защита на /admin с rate limiting и security headers

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-edge rate limiter за login опити
const loginAttempts = new Map<string, { count: number; until: number }>()

function securityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Прилагаме security headers на всички отговори
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'

  if (!pathname.startsWith('/admin')) {
    return securityHeaders(NextResponse.next())
  }

  // Login страницата е публична
  if (pathname.startsWith('/admin/login')) {
    return securityHeaders(NextResponse.next())
  }

  const token  = req.cookies.get('admin_token')?.value
  const secret = process.env.ADMIN_SECRET

  // No secret configured — open (само dev)
  if (!secret) return securityHeaders(NextResponse.next())

  // Проверка за lockout
  const attempt = loginAttempts.get(ip)
  if (attempt && attempt.count >= 10 && attempt.until > Date.now()) {
    return new NextResponse('Too many requests', { status: 429 })
  }

  // Валиден токен
  if (token === secret) {
    // Изчистваме attempt при успех
    loginAttempts.delete(ip)
    return securityHeaders(NextResponse.next())
  }

  // Записваме неуспешен опит
  if (attempt) {
    attempt.count++
    if (attempt.count >= 10) {
      attempt.until = Date.now() + 15 * 60 * 1000 // 15 мин lockout
    }
  } else {
    loginAttempts.set(ip, { count: 1, until: 0 })
  }

  // Redirect към login
  const loginUrl = new URL('/admin/login', req.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
}
