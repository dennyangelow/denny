// app/api/affiliate-products/[id]/route.ts
// ✅ PATCH  — обновява продукт + revalidatePath('/') за начална страница
// ✅ DELETE — изтрива продукт + revalidatePath('/') за начална страница

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()

    // Не позволяваме да се презапише id-то
    const { id: _id, ...updates } = body

    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data)  return NextResponse.json({ error: 'Не е намерено' }, { status: 404 })

    // ✅ Промяна на продукт → началната страница се обновява автоматично
    revalidatePath('/')

    return NextResponse.json({ product: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabaseAdmin
      .from('affiliate_products')
      .delete()
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ✅ Изтриване → началната страница се обновява автоматично
    revalidatePath('/')

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}
