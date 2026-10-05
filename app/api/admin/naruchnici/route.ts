// app/api/admin/naruchnici/route.ts — v2
// GET — връща всички наръчници за Admin SEO таба
//
// ✅ v1 → v2: export const dynamic = 'force-dynamic' + Cache-Control: no-store.
//    Причина: v1 нямаше нищо динамично в тялото си, затова Next го
//    prerender-ваше при build и Vercel го сервираше от кеша (X-Vercel-Cache: HIT,
//    Access-Control-Allow-Origin: *) — т.е. админ табът можеше да показва
//    остарели данни след редакция, а отговорът беше достъпен за всички.
//    Автентикацията е в middleware.ts v12 ('/api/admin' е защитен префикс),
//    но този route вече не бива да се кешира и при грешка в конфигурацията.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' }

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('naruchnici')
      .select('*')
      .order('sort_order')

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
    return NextResponse.json(data || [], { headers: NO_STORE })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500, headers: NO_STORE })
  }
}
