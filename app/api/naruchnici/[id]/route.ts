// app/api/naruchnici/[id]/route.ts — v2
// ✅ PATCH  — обновява наръчник + revalidatePath за начална страница и конкретния slug
// ✅ DELETE — изтрива наръчник + revalidatePath за начална страница и конкретния slug

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()

    // Не позволяваме да се презапише id-то
    const { id: _id, ...updates } = body

    const { data, error } = await supabaseAdmin
      .from('naruchnici')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data)  return NextResponse.json({ error: 'Не е намерено' }, { status: 404 })

    // ✅ Промяна → началната страница + конкретния наръчник се обновяват
    revalidatePath('/')
    if (data.slug) {
      revalidatePath(`/naruchnik/${data.slug}`)
    }

    return NextResponse.json({ naruchnik: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Вземаме slug преди изтриване за revalidatePath
    const { data: existing } = await supabaseAdmin
      .from('naruchnici')
      .select('slug')
      .eq('id', params.id)
      .single()

    const { error } = await supabaseAdmin
      .from('naruchnici')
      .delete()
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ✅ Изтриване → кешът се изчиства
    revalidatePath('/')
    if (existing?.slug) {
      revalidatePath(`/naruchnik/${existing.slug}`)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}
