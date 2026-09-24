// app/api/own-products/variants/[id]/route.ts
// ✅ ПОПРАВКА: PATCH/DELETE вече ревалидират и продуктовата страница
//    (/products/[slug]), не само '/'. Преди: промяна на цена/наличност/статус
//    на вариант (без промяна на самия продукт) не пробиваше 60-секундния
//    ISR кеш на продуктовата страница — клиентите виждаха стара цена до 60с.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

// ✅ Помощна ф-я — намира slug-а на продукта, който притежава варианта.
async function revalidateOwningProduct(productId: string | undefined | null) {
  if (!productId) return
  const { data } = await supabaseAdmin
    .from('products')
    .select('slug')
    .eq('id', productId)
    .single()
  if (data?.slug) revalidatePath(`/products/${data.slug}`)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()

  // Авто-изчисляваме price_per_liter
  if (body.price && body.size_liters) {
    body.price_per_liter = parseFloat((body.price / body.size_liters).toFixed(4))
  }

  const { data, error } = await supabaseAdmin
    .from('product_variants')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  await revalidateOwningProduct(data?.product_id)
  return NextResponse.json({ variant: data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  // ✅ Взимаме product_id ПРЕДИ изтриване, иначе го губим завинаги
  const { data: existing } = await supabaseAdmin
    .from('product_variants')
    .select('product_id')
    .eq('id', params.id)
    .single()

  const { error } = await supabaseAdmin
    .from('product_variants')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  await revalidateOwningProduct(existing?.product_id)
  return NextResponse.json({ success: true })
}
