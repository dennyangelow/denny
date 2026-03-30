// app/api/faq-categories/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { id } = params

    if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('faq_categories')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    revalidatePath('/')
    return NextResponse.json({ category: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Грешка' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) return NextResponse.json({ error: 'Липсва ID' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('faq_categories')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    revalidatePath('/')
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Грешка' }, { status: 500 })
  }
}
