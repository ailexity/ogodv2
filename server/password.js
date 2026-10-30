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

export const PASSWORD_MIN_LENGTH = 8

/** Returns an error message for a password that does not meet the policy, or null. */
export function passwordProblem(password) {
  const value = String(password ?? '')
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
  }
  if (value.length > 128) return 'Password must be at most 128 characters'
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return 'Password must include at least one letter and one number'
  }
  return null
}
