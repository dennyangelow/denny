// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString() // Винаги обновяваме времето на промяна
    }

    // Добавяме само полетата, които са изпратени от фронтенда
    if (body.status)              updates.status = body.status
    if (body.payment_status)      updates.payment_status = body.payment_status
    if (body.tracking_number !== undefined) updates.tracking_number = body.tracking_number
    
    // Автоматично поставяне на дати при смяна на статуса
    if (body.status === 'shipped')   updates.shipped_at = new Date().toISOString()
    if (body.status === 'delivered') updates.delivered_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Supabase Error (Orders):', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, order: data })
  } catch (error: any) {
    console.error('Server Error (Orders):', error.message)
    return NextResponse.json({ error: 'Грешка при обновяване на поръчката' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)') // Вземаме поръчката заедно с продуктите в нея
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('Get Order Error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: 'Грешка при зареждане на поръчката' }, { status: 500 })
  }
}