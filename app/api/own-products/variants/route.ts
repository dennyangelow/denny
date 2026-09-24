// app/api/own-products/variants/route.ts
// ✅ ПОПРАВКА: POST вече ревалидира и продуктовата страница (/products/[slug]),
//    не само '/'. Преди: добавяне на нов вариант (нов размер/опаковка) на
//    продукт не пробиваше 60-секундния ISR кеш на самата продуктова страница —
//    същият проблем, поправен по-рано за PATCH/DELETE на самия продукт
//    (виж own-products/[id]/route.ts), сега поправен и тук за варианти.
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  // ?admin=1  →  връща ВСИЧКИ варианти (за admin панела)
  // без параметър  →  само активните (за публичната страница)
  const isAdmin = req.nextUrl.searchParams.get('admin') === '1'

  let query = supabaseAdmin
    .from('product_variants')
    .select('*')
    .order('sort_order')

  if (!isAdmin) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variants: data || [] })
}

// ✅ Помощна ф-я — намира slug-а на продукта, който притежава варианта,
// за да можем да ревалидираме точно неговата страница (не само '/').
async function revalidateOwningProduct(productId: string | undefined | null) {
  if (!productId) return
  const { data } = await supabaseAdmin
    .from('products')
    .select('slug')
    .eq('id', productId)
    .single()
  if (data?.slug) revalidatePath(`/products/${data.slug}`)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Авто-изчисляваме price_per_liter
  if (body.price && body.size_liters) {
    body.price_per_liter = parseFloat((body.price / body.size_liters).toFixed(4))
  }

  // Никога не пращаме id при insert
  const { id, ...insertData } = body

  const { data, error } = await supabaseAdmin
    .from('product_variants')
    .insert(insertData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  await revalidateOwningProduct(data?.product_id)
  return NextResponse.json({ variant: data }, { status: 201 })
}
