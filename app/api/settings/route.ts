// app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // 1. Извличаме настройките
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('key, value')

    if (error) throw error

    // 2. Превръщаме масива в лесен за ползване обект
    const settingsMap: Record<string, string> = {}
    data?.forEach(row => {
      settingsMap[row.key] = row.value
    })

    // 3. Добавяме Cache-Control хедър
    // Настройките не се сменят всяка секунда, затова можем да кажем на браузъра 
    // да ги помни за кратко, за да не натоварваме базата данни
    return NextResponse.json(
      { settings: settingsMap },
      { 
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } 
      }
    )
  } catch (error: any) {
    console.error('Settings GET Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { updates } = body

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Невалидни данни' }, { status: 400 })
    }

    const now = new Date().toISOString()
    
    // Подготвяме редовете за запис
    const rows = Object.entries(updates).map(([key, value]) => ({
      key,
      value: value === null ? '' : String(value), // Защита против null стойности
      updated_at: now,
    }))

    if (rows.length === 0) {
      return NextResponse.json({ success: true, message: 'Няма данни за обновяване' })
    }

    // Използваме upsert за масово обновяване
    const { error } = await supabaseAdmin
      .from('settings')
      .upsert(rows, { onConflict: 'key' })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Settings POST Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}