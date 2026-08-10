import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { db, DATA_DIR } from './db.js'

const TOKEN_TTL = '7d'

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

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, SECRET, {
    expiresIn: TOKEN_TTL,
  })
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
    canPostTrips: row.guide_status === 'verified',
    disabled: Boolean(row.disabled),
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
      req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) ?? undefined
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
  next()
}
