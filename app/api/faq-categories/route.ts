// app/api/faq-categories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('faq_categories')
      .select('*')
      .order('sort_order')

    if (error) {
      // Таблицата може да не съществува още — върни празен масив вместо 500
      console.warn('[faq-categories] GET error:', error.message)
      return NextResponse.json({ categories: [] })
    }

    return NextResponse.json({ categories: data || [] })
  } catch (err) {
    console.error('[faq-categories] Unexpected error:', err)
    return NextResponse.json({ categories: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.label?.trim()) {
      return NextResponse.json({ error: 'Името е задължително' }, { status: 400 })
    }

    if (!body.icon?.trim()) {
      return NextResponse.json({ error: 'Иконата е задължителна' }, { status: 400 })
    }

    // Auto-generate slug from label if not provided
    if (!body.slug?.trim()) {
      body.slug =
        body.label
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/gi, '') || `cat_${Date.now()}`
    }

    // Default sort_order to end of list
    if (body.sort_order == null) {
      const { count } = await supabaseAdmin
        .from('faq_categories')
        .select('*', { count: 'exact', head: true })
      body.sort_order = (count ?? 0) + 1
    }

    const { data, error } = await supabaseAdmin
      .from('faq_categories')
      .insert({ label: body.label, slug: body.slug, icon: body.icon, sort_order: body.sort_order })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    revalidatePath('/')
    return NextResponse.json({ category: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Грешка' }, { status: 500 })
  }
}
