// lib/rate-limit.ts — прост in-memory rate limiter

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Почиства стари записи всеки 5 минути
setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (entry.resetAt < now) store.delete(key)
  })
}, 5 * 60 * 1000)

interface RateLimitOptions {
  limit: number    // max брой заявки
  window: number   // в секунди
}

export function rateLimit(key: string, options: RateLimitOptions): { success: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const windowMs = options.window * 1000

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    // Нов прозорец
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: options.limit - 1, resetIn: options.window }
  }

  if (entry.count >= options.limit) {
    return {
      success: false,
      remaining: 0,
      resetIn: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  entry.count++
  return {
    success: true,
    remaining: options.limit - entry.count,
    resetIn: Math.ceil((entry.resetAt - now) / 1000),
  }
}

// Извлича IP от request
export function getIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || 'unknown'
}
