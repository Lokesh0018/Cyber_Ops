// Tiny in-memory fixed-window rate limiter (per server process; no extra dependency).
//   rateLimit({ windowMs, max, key, message })  ->  Express middleware
// `key(req)` picks what is counted (an email, a student, an IP...). Over the limit: 429 with a Retry-After header.
// Keys are kept in a Map and swept when their window ends, so memory stays bounded.
export function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Too many attempts. Please wait a bit and try again.' }) {
  const hits = new Map() // key -> { n, reset }
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k)
  }, Math.max(windowMs, 30_000)).unref()

  return (req, res, next) => {
    const k = key(req)
    const now = Date.now()
    let h = hits.get(k)
    if (!h || h.reset <= now) { h = { n: 0, reset: now + windowMs }; hits.set(k, h) }
    h.n++
    if (h.n > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)))
      return res.status(429).json({ message })
    }
    next()
  }
}
