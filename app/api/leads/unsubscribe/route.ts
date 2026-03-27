import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = body.email?.toLowerCase().trim()

    if (!email) {
      return NextResponse.json({ error: 'Имейлът е задължителен' }, { status: 400 })
    }

    // 1. Проверка дали този имейл изобщо съществува в базата
    const { data: lead, error: findError } = await supabaseAdmin
      .from('leads')
      .select('id, subscribed')
      .eq('email', email)
      .single()

    if (findError || !lead) {
      // Връщаме успех, дори ако имейлът не съществува (от съображения за сигурност),
      // за да не разберат ботовете кои имейли са в базата ти.
      return NextResponse.json({ success: true, message: 'Process completed' })
    }

    // 2. Обновяване с добавяне на дата на отписване
    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update({ 
        subscribed: false,
        unsubscribed_at: new Date().toISOString() // Добре е да имаш такава колона за статистика
      })
      .eq('email', email)

    if (updateError) throw updateError

    return NextResponse.json({ 
      success: true, 
      message: 'Успешно се отписахте от нашия бюлетин.' 
    })

  } catch (error: any) {
    console.error('Unsubscribe error:', error.message)
    return NextResponse.json({ error: 'Възникна грешка, моля опитайте по-късно.' }, { status: 500 })
  }
}