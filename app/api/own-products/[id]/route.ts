// app/api/category-links/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    
    // 1. Изолираме полетата, които НЕ трябва да се променят
    // Това предотвратява грешки, ако фронтендът изпрати и ID-то
    const { id, created_at, ...updateData } = body

    const { data, error } = await supabaseAdmin
      .from('category_links')
      .update(updateData) // Обновяваме само позволените данни
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Supabase Error (Category):', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ link: data })
  } catch (error: any) {
    console.error('Server Error (Category):', error.message)
    return NextResponse.json({ error: 'Възникна сървърна грешка' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Проверка дали ID-то е валидно
    if (!params.id) {
      return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('category_links')
      .delete()
      .eq('id', params.id)

    if (error) throw error
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete Error (Category):', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Добавяме GET метод, за да можеш да тестваш адреса директно в браузъра
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabaseAdmin
      .from('category_links')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) throw error
    return NextResponse.json({ link: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
}