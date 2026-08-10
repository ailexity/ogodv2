import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `scrypt:${salt}:${derived}`
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split(':')
  if (scheme !== 'scrypt' || !salt || !hash) return false

  const expected = Buffer.from(hash, 'hex')
  const derived = scryptSync(password, salt, KEY_LENGTH)
  return expected.length === derived.length && timingSafeEqual(expected, derived)
}
