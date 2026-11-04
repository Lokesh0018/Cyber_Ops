// scrypt password hashing with node:crypto — no external dependency.
// Stored format: scrypt$<salt hex>$<hash hex>
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)
const KEY_LEN = 64

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, KEY_LEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const hash = await scrypt(password, Buffer.from(saltHex, 'hex'), KEY_LEN)
  const expected = Buffer.from(hashHex, 'hex')
  return hash.length === expected.length && timingSafeEqual(hash, expected)
}
