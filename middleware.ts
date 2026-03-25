// middleware.ts — защита на /admin

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith('/admin')) return NextResponse.next()
  if (pathname.startsWith('/admin/login')) return NextResponse.next()

  const token  = req.cookies.get('admin_token')?.value
  const secret = process.env.ADMIN_SECRET

  // No secret configured — open access
  if (!secret) return NextResponse.next()

  // Valid token
  if (token === secret) return NextResponse.next()

  // Redirect to login
  const loginUrl = new URL('/admin/login', req.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*'],
}
