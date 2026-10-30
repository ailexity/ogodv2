/**
 * Fixed-window, in-memory rate limiter. Good enough for a single Node process;
 * a multi-instance deployment would need a shared store such as Redis.
 */
export function rateLimit({ windowMinutes, max, key = (req) => req.ip }) {
  const windowMs = windowMinutes * 60_000
  const hits = new Map()

  setInterval(() => {
    const now = Date.now()
    for (const [k, entry] of hits) if (entry.resetAt <= now) hits.delete(k)
  }, windowMs).unref()

  return (req, res, next) => {
    const now = Date.now()
    const k = key(req)
    let entry = hits.get(k)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
      hits.set(k, entry)
    }

    entry.count += 1
    if (entry.count > max) {
      const minutes = Math.ceil((entry.resetAt - now) / 60_000)
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      return res.status(429).json({
        error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      })
    }
    next()
  }
}

/** Limits per client and per target email, so one IP can't hammer many accounts or one account. */
export function emailKey(req) {
  return `${req.ip}|${String(req.body?.email ?? '').trim().toLowerCase()}`
}
