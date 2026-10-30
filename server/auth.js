import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { db, DATA_DIR } from './db.js'

// "Remember me" keeps a session for 30 days; otherwise it lasts a day.
const TOKEN_TTL = { remember: '30d', session: '1d' }

function loadSecret() {
  if (process.env.OGOD_JWT_SECRET) return process.env.OGOD_JWT_SECRET

  // Dev fallback: persist a generated secret so restarting the server does not
  // invalidate every token that is already in a browser.
  const secretFile = path.join(DATA_DIR, '.jwt-secret')
  if (!existsSync(secretFile)) {
    writeFileSync(secretFile, randomBytes(48).toString('hex'), { mode: 0o600 })
  }
  return readFileSync(secretFile, 'utf8').trim()
}

const SECRET = loadSecret()

export function signToken(user, { remember = false } = {}) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, ver: user.token_version ?? 0 },
    SECRET,
    { expiresIn: remember ? TOKEN_TTL.remember : TOKEN_TTL.session },
  )
}

/** A token minted before the user's last password change no longer counts. */
function isCurrent(payload, row) {
  return (payload.ver ?? 0) === (row.token_version ?? 0)
}

/** A guide's yearly platform subscription still covers today. */
export function subscriptionActive(row) {
  return Boolean(row?.subscription_until) && row.subscription_until >= new Date().toISOString().slice(0, 10)
}

export function publicUser(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    age: row.age,
    phone: row.phone,
    address: row.address,
    bio: row.bio,
    interests: JSON.parse(row.interests ?? '[]'),
    languages: JSON.parse(row.languages ?? '[]'),
    guideStatus: row.guide_status,
    certified: Boolean(row.certified),
    canPostTrips: row.guide_status === 'verified' && subscriptionActive(row),
    subscriptionUntil: row.subscription_until,
    payoutUpi: row.payout_upi,
    payoutBank: row.payout_bank,
    disabled: Boolean(row.disabled),
    emailVerified: Boolean(row.email_verified),
    hasPassword: Boolean(row.password_hash),
    googleLinked: Boolean(row.google_id),
  }
}

export function authenticate(req, res, next) {
  const header = req.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Sign in to continue' })

  let payload
  try {
    payload = jwt.verify(token, SECRET)
  } catch {
    return res.status(401).json({ error: 'Session expired, please sign in again' })
  }

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub)
  if (!row) return res.status(401).json({ error: 'Account no longer exists' })
  if (!isCurrent(payload, row)) {
    return res.status(401).json({ error: 'Your password was changed, please sign in again' })
  }
  if (row.disabled) return res.status(403).json({ error: 'This account has been disabled' })

  req.user = row
  next()
}

export function optionalAuth(req, _res, next) {
  const header = req.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET)
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub)
      if (row && isCurrent(payload, row) && !row.disabled) req.user = row
    } catch {
      // An invalid token on a public route is treated as a signed-out visitor.
    }
  }
  next()
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

/** Doc §4: a guide cannot post trips until the verification review has approved them. */
export function requireVerifiedGuide(req, res, next) {
  if (req.user.guide_status !== 'verified') {
    return res.status(403).json({
      error: 'Only verified guides can post trips',
      guideStatus: req.user.guide_status,
    })
  }
  if (!subscriptionActive(req.user)) {
    return res.status(403).json({
      error: 'Your yearly guide subscription has expired. Renew it from your profile to keep posting trips.',
      code: 'subscription_expired',
    })
  }
  next()
}
