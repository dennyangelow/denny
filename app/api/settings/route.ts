import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export async function GET() {
  const { data, error } = await supabaseAdmin.from('settings').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const map: Record<string, string> = {}
  data?.forEach(r => { map[r.key] = r.value })
  return NextResponse.json({ settings: map })
}

export async function POST(req: NextRequest) {
  const { updates } = await req.json()
  const rows = Object.entries(updates).map(([key, value]) => ({
    key, value: String(value), updated_at: new Date().toISOString(),
  }))

  const { error } = await supabaseAdmin
    .from('settings').upsert(rows, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ИЗЧИСТВАНЕ НА КЕША:
  // Това казва на Next.js да обнови засегнатите страници веднага.
  // ✅ ФИКС: /products/[slug] (Atlas Terra продуктите) липсваше тук, въпреки че
  //    urgency_bar_products (SettingsTab.tsx) е документирана изрично като
  //    "Показва се САМО на /products/* страниците". Без този ред, продуктовите
  //    страници разчитаха единствено на 60-секундния ISR revalidate таймер
  //    (виж page.tsx `export const revalidate = 60`) — което означава, че
  //    различни продукти можеха да "хванат" новата стойност в различни моменти
  //    и временно да показват различен urgency текст едновременно (точно това
  //    се наблюдаваше на живо между Atlas Terra/NITRO и AMINO).
  //
  // ✅ НОВ ФИКС: revalidatePath('/blog') преди чистеше САМО точния път
  //    '/blog' (списъка) — НЕ и '/blog/[slug]' (всяка статия + всеки
  //    категориен hub), защото им липсваше 'layout' режимът, който
  //    '/produkt', '/naruchnik' и '/products' вече ползваха отдолу. Затова
  //    футърът (соц. линкове, телефон, био текст — всичко от settings) се
  //    обновяваше веднага само на /blog, а на конкретна статия оставаше
  //    стар до края на 300-секундния ISR прозорец на app/blog/[slug]/page.tsx
  //    — точно несъответствието, наблюдавано на живо между /blog и
  //    /blog/shema-torene-domati-po-fazi.
  revalidatePath('/')
  revalidatePath('/produkti')
  revalidatePath('/blog', 'layout')
  revalidatePath('/produkt', 'layout')
  revalidatePath('/naruchnik', 'layout')
  revalidatePath('/products', 'layout')

  return NextResponse.json({ success: true })
}
