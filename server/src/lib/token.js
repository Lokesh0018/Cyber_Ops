// Minimal HMAC-signed bearer token (JWT-shaped: base64url(payload).base64url(signature)).
// Payload carries the student id and an expiry; the secret comes from AUTH_SECRET.
import { createHmac, timingSafeEqual } from 'node:crypto'

const SECRET = process.env.AUTH_SECRET ?? 'dev-only-change-me'
const TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

const b64 = (buf) => Buffer.from(buf).toString('base64url')
const sign = (data) => createHmac('sha256', SECRET).update(data).digest('base64url')

export function issueToken(studentId) {
  const payload = b64(JSON.stringify({ sub: studentId, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS }))
  return `${payload}.${sign(payload)}`
}

/** Returns the student id for a valid, unexpired token; null otherwise. */
export function readToken(token) {
  const [payload, sig] = String(token ?? '').split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return exp > Math.floor(Date.now() / 1000) ? sub : null
  } catch {
    return null
  }
}

/** Express middleware: requires `Authorization: Bearer <token>` and sets req.studentId. */
export function requireAuth(req, res, next) {
  const id = readToken(req.headers.authorization?.replace(/^Bearer\s+/i, ''))
  if (!id) return res.status(401).json({ message: 'Please log in.' })
  req.studentId = id
  next()
}
