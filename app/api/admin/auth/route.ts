// app/api/admin/auth/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()
    const secret = process.env.ADMIN_SECRET

    // 1. Проверка дали изобщо е настроена парола (защита за продукция)
    if (!secret) {
      console.warn('⚠️ ADMIN_SECRET не е конфигуриран! Входът е отворен.')
      return createAuthResponse({ ok: true, mode: 'unsecured' }, 'open-access')
    }

    // 2. Проверка на паролата
    if (password !== secret) {
      // Добавяме изкуствено забавяне от 1 секунда при грешна парола
      // Това прави "Brute Force" атаките много по-бавни и трудни
      await new Promise(resolve => setTimeout(resolve, 1000))
      return NextResponse.json({ error: 'Грешна парола' }, { status: 401 })
    }

    // 3. Успешен вход
    return createAuthResponse({ ok: true }, secret)

  } catch (error) {
    return NextResponse.json({ error: 'Невалидна заявка' }, { status: 400 })
  }
}

// Помощна функция за създаване на отговор с бисквитка
function createAuthResponse(data: object, tokenValue: string) {
  const res = NextResponse.json(data)
  
  res.cookies.set('admin_token', tokenValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Само през HTTPS в реална среда
    sameSite: 'strict', // По-сигурно от 'lax' за административни панели
    maxAge: 60 * 60 * 24 * 7, // 7 дни валидност
    path: '/',
  })
  
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true, message: 'Излязохте успешно' })
  // Изтриваме бисквитката чрез поставяне на изтекла дата
  res.cookies.set('admin_token', '', { path: '/', maxAge: 0 })
  return res
}