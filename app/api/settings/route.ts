import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache' // 1. Добави този импорт

export async function GET() {
  const { data, error } = await supabaseAdmin.from('settings').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const map: Record<string, string> = {}
  data?.forEach(r => { map[r.key] = r.value })
  return NextResponse.json({ settings: map })
}

export async function POST(req: NextRequest) {
  const { updates } = await req.json()
  const rows = Object.entries(updates).map(([key, value]) => ({
    key, value: String(value), updated_at: new Date().toISOString(),
  }))
  
  const { error } = await supabaseAdmin
    .from('settings').upsert(rows, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2. ИЗЧИСТВАНЕ НА КЕША: 
  // Това казва на Next.js да обнови началната страница веднага
  revalidatePath('/') 

  return NextResponse.json({ success: true })
}