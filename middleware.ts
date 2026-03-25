// middleware.ts — защита на /admin
// Поставете в root-а на проекта (до package.json)

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Само admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Провери admin token от cookie
  const token = req.cookies.get('admin_token')?.value
  const secret = process.env.ADMIN_SECRET

  // Ако няма секрет настроен — пусни (development режим)
  if (!secret) {
    console.warn('⚠ ADMIN_SECRET не е настроен! /admin е незащитена.')
    return NextResponse.next()
  }

  if (token === secret) {
    return NextResponse.next()
  }

  // Redirect към login
  const loginUrl = new URL('/admin/login', req.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*'],
}
