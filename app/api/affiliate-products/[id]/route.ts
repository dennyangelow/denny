// app/api/affiliate-products/[id]/route.ts
// ✅ PATCH  — обновява конкретен продукт (admin only)
// ✅ DELETE — изтрива конкретен продукт (admin only)
// ✅ revalidatePath при промяна → началната страница + продуктовата страница се обновяват

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID е задължителен' }, { status: 400 })

    const body = await req.json()

    // Никога не позволяваме да се промени id-то
    const { id: _id, ...rest } = body

    // Изчистваме undefined стойности — Supabase не ги харесва
    const payload = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined)
    )

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Няма полета за обновяване' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[affiliate-products PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Обновяваме и началната страница и конкретната продуктова страница
    revalidatePath('/')
    revalidatePath('/produkti')
    if (data?.slug) revalidatePath(`/produkt/${data.slug}`)

    return NextResponse.json({ product: data })
  } catch (err: any) {
    console.error('[affiliate-products PATCH] catch:', err)
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID е задължителен' }, { status: 400 })

    // Вземаме slug преди изтриване (за revalidate)
    const { data: existing } = await supabaseAdmin
      .from('affiliate_products')
      .select('slug')
      .eq('id', id)
      .single()

    const { error } = await supabaseAdmin
      .from('affiliate_products')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[affiliate-products DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidatePath('/')
    revalidatePath('/produkti')
    if (existing?.slug) revalidatePath(`/produkt/${existing.slug}`)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[affiliate-products DELETE] catch:', err)
    return NextResponse.json({ error: err.message || 'Грешка' }, { status: 500 })
  }
}

// GET по ID (по желание — за директна заявка по id)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabaseAdmin
      .from('affiliate_products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json({ product: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
