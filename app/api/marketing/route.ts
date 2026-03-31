// app/api/marketing/route.ts
// ФИКС: По-добро error handling + автоматично създаване на запис ако не съществува

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

const DEFAULT_CONFIG = {
  upsell_enabled: true,
  cross_sell_enabled: true,
  post_purchase_enabled: true,
  progress_bar_enabled: true,
  progress_goal_amount: 60,
  progress_goal_label: 'Безплатна доставка',
  post_purchase_delay: 2,
  offers: [],
}

export async function GET() {
  try {
    // Опитваме да вземем реда
    const { data, error } = await supabaseAdmin
      .from('marketing_settings')
      .select('config')
      .eq('id', 1)
      .single()

    // Ако таблицата не съществува или няма ред — връщаме default
    if (error) {
      console.warn('marketing_settings fetch error:', error.message)
      return NextResponse.json(DEFAULT_CONFIG)
    }

    if (!data || !data.config) {
      return NextResponse.json(DEFAULT_CONFIG)
    }

    return NextResponse.json({ ...DEFAULT_CONFIG, ...data.config })
  } catch (err) {
    console.error('marketing GET error:', err)
    return NextResponse.json(DEFAULT_CONFIG)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Опитваме upsert — ако реда с id=1 не съществува, го създава
    const { error } = await supabaseAdmin
      .from('marketing_settings')
      .upsert(
        { id: 1, config: body, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )

    if (error) {
      console.error('marketing POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/')
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('marketing POST catch:', err)
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}
