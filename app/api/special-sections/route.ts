import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

/**
 * Инициализация на Supabase Admin клиент.
 * Използва се Service Role Key, за да се заобиколят RLS политиките при административни действия.
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, key)
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    
    const { data, error } = await supabase
      .from('special_sections')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ sections: data || [] })
  } catch (error: any) {
    console.error('[SPECIAL_SECTIONS_GET]:', error.message)
    return NextResponse.json(
      { error: 'Грешка при извличане на секциите' }, 
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = getSupabaseAdmin()

    // 1. Нормализиране на булетите (превръщане на текст в масив)
    let bullets = body.bullets
    if (typeof bullets === 'string') {
      bullets = bullets
        .split('\n')
        .map((s: string) => s.trim())
        .filter(Boolean)
    }

    // 2. Подготовка на данните за запис
    const insertData = {
      title: body.title,
      subtitle: body.subtitle,
      content: body.content,
      image_url: body.image_url,
      bg_color: body.bg_color || '#ffffff',
      text_color: body.text_color || '#000000',
      sort_order: body.sort_order || 0,
      bullets: bullets || [],
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('special_sections')
      .insert([insertData])
      .select()
      .single()

    if (error) throw error

    /**
     * 3. ИНВАЛИДИРАНЕ НА КЕША (Критично)
     * Понеже специалните секции обикновено са част от началната страница,
     * трябва да кажем на Next.js да опресни кеша за '/', за да се види промяната веднага.
     */
    revalidatePath('/')

    return NextResponse.json({ 
      success: true, 
      section: data 
    })

  } catch (error: any) {
    console.error('[SPECIAL_SECTIONS_POST]:', error.message)
    return NextResponse.json(
      { error: error.message || 'Грешка при създаване на секция' }, 
      { status: 500 }
    )
  }
}