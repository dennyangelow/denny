// app/api/category-links/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { id, created_at, ...updateData } = body

    // Изчистване: ако slug е празен или тире — не го пращаме (оставяме NULL)
    if (!updateData.slug || updateData.slug.trim() === '' || updateData.slug.trim() === '-') {
      delete updateData.slug
    }

    const { data, error } = await supabaseAdmin
      .from('category_links')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    revalidatePath('/')
    return NextResponse.json({ link: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabaseAdmin
      .from('category_links')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    revalidatePath('/')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
