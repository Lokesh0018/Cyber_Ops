// Minimal HMAC-signed bearer token (JWT-shaped: base64url(payload).base64url(signature)).
// Payload carries the student id and an expiry; the secret comes from AUTH_SECRET.
import { createHmac, timingSafeEqual } from 'node:crypto'

const SECRET = process.env.AUTH_SECRET ?? 'dev-only-change-me'
const TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

const b64 = (buf) => Buffer.from(buf).toString('base64url')
const sign = (data) => createHmac('sha256', SECRET).update(data).digest('base64url')

export function issueToken(subject, role = 'student') {
  const payload = b64(JSON.stringify({ sub: subject, role, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS }))
  return `${payload}.${sign(payload)}`
}

/** Claims ({ sub, role }) for a valid, unexpired token; null otherwise. */
export function readClaims(token) {
  const [payload, sig] = String(token ?? '').split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const { sub, role, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return exp > Math.floor(Date.now() / 1000) ? { sub, role: role ?? 'student' } : null
  } catch {
    return null
  }
}

/** Returns the student id for a valid, unexpired *student* token; null otherwise (admin tokens never act as a student). */
export function readToken(token) {
  const c = readClaims(token)
  return c && c.role === 'student' ? c.sub : null
}

/** Express middleware: requires an admin bearer token. */
export function requireAdmin(req, res, next) {
  const c = readClaims(req.headers.authorization?.replace(/^Bearer\s+/i, ''))
  if (!c || c.role !== 'admin') return res.status(401).json({ message: 'Admin sign-in required.' })
  next()
}

/** Express middleware: requires `Authorization: Bearer <token>` and sets req.studentId. */
export function requireAuth(req, res, next) {
  const id = readToken(req.headers.authorization?.replace(/^Bearer\s+/i, ''))
  if (!id) return res.status(401).json({ message: 'Please log in.' })
  req.studentId = id
  next()
}
