// app/api/admin/whoami/route.ts — v1
// Връща IP-то, с което виждаш сайта в момента — САМО за показване в админ панела
// (карта "Това устройство", InternalDeviceCard.tsx). Маркирането на устройство НЕ зависи от IP.
// Достъп: само admin — middleware.ts v15 е fail-closed за всичко под /api, освен публичните.

import { NextRequest, NextResponse } from 'next/server'
import { getIP } from '@/lib/rate-limit'

export async function GET(req: NextRequest) {
  return NextResponse.json({ ip: getIP(req) }, { headers: { 'Cache-Control': 'no-store' } })
}
