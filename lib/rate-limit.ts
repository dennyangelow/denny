// lib/rate-limit.ts — in-memory rate limiter с lockout

interface RateLimitEntry {
  count: number
  resetAt: number
  locked?: boolean
  lockedUntil?: number
}

const store = new Map<string, RateLimitEntry>()

setInterval(() => {
  const now = Date.now()
  store.forEach((entry, key) => {
    if (entry.resetAt < now && (!entry.lockedUntil || entry.lockedUntil < now)) {
      store.delete(key)
    }
  })
}, 5 * 60 * 1000)

interface RateLimitOptions {
  limit: number
  window: number        // секунди
  lockoutLimit?: number // брой опити → lockout
  lockoutWindow?: number // lockout за (секунди)
}

export function rateLimit(
  key: string,
  options: RateLimitOptions
): { success: boolean; remaining: number; resetIn: number; locked?: boolean } {
  const now = Date.now()
  const windowMs = options.window * 1000
  const entry = store.get(key)

  // Проверка за lockout
  if (entry?.locked && entry.lockedUntil && entry.lockedUntil > now) {
    return {
      success: false,
      remaining: 0,
      resetIn: Math.ceil((entry.lockedUntil - now) / 1000),
      locked: true,
    }
  }

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: options.limit - 1, resetIn: options.window }
  }

  // Lockout при много опити
  if (options.lockoutLimit && entry.count >= options.lockoutLimit) {
    const lockoutMs = (options.lockoutWindow || 900) * 1000
    entry.locked = true
    entry.lockedUntil = now + lockoutMs
    return {
      success: false,
      remaining: 0,
      resetIn: Math.ceil(lockoutMs / 1000),
      locked: true,
    }
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

export function getIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || 'unknown'
}
