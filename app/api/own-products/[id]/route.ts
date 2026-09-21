// app/api/own-products/[id]/route.ts
// ✅ ПОПРАВКА: PATCH вече ревалидира кеша на страницата на продукта.
//    Преди: след запис в admin панела /products/[slug] (revalidate = 60) показваше
//    старата версия до 60 сек. — новите снимки/alt текстове не се виждаха веднага.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('products').update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  if (data?.slug) revalidatePath(`/products/${data.slug}`)
  return NextResponse.json({ product: data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabaseAdmin.from('products').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
