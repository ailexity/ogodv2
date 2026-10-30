import { createHash, randomBytes } from 'node:crypto'
import { db } from './db.js'

function hash(token) {
  return createHash('sha256').update(token).digest('hex')
}

/** Issues a fresh single-use token, replacing any earlier one for the same purpose. */
export function issueEmailToken(userId, purpose, ttlMinutes) {
  const token = randomBytes(32).toString('base64url')
  db.transaction(() => {
    db.prepare('DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?').run(userId, purpose)
    db.prepare(
      `INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at)
       VALUES (?, ?, ?, datetime('now', ?))`,
    ).run(userId, purpose, hash(token), `+${ttlMinutes} minutes`)
  })()
  return token
}

/** Burns the token and returns its user id, or null if it is unknown, used or expired. */
export function consumeEmailToken(token, purpose) {
  const row = db
    .prepare(
      `SELECT id, user_id, expires_at > datetime('now') AS live
         FROM email_tokens WHERE token_hash = ? AND purpose = ?`,
    )
    .get(hash(String(token ?? '')), purpose)
  if (!row) return null

  db.prepare('DELETE FROM email_tokens WHERE id = ?').run(row.id)
  return row.live ? row.user_id : null
}
