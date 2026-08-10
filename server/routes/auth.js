import { Router } from 'express'
import { db } from '../db.js'
import { hashPassword, verifyPassword } from '../password.js'
import { authenticate, publicUser, signToken } from '../auth.js'

const router = Router()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normaliseEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

router.post('/register', (req, res) => {
  const { email, password, name, age, phone, address, interests, languages } = req.body ?? {}
  const id = normaliseEmail(email)

  if (!EMAIL_PATTERN.test(id)) return res.status(400).json({ error: 'Enter a valid email address' })
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }
  if (!String(name ?? '').trim()) return res.status(400).json({ error: 'Name is required' })

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(id)
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' })

  const result = db
    .prepare(
      `INSERT INTO users (email, password_hash, role, name, age, phone, address, interests, languages)
       VALUES (?, ?, 'traveler', ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      hashPassword(String(password)),
      String(name).trim(),
      age ? Number(age) : null,
      String(phone ?? '').trim() || null,
      String(address ?? '').trim() || null,
      JSON.stringify(Array.isArray(interests) ? interests : []),
      JSON.stringify(Array.isArray(languages) ? languages : []),
    )

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ token: signToken(row), user: publicUser(row) })
})

router.post('/login', (req, res) => {
  const id = normaliseEmail(req.body?.email)
  const password = String(req.body?.password ?? '')

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(id)
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }
  if (row.disabled) return res.status(403).json({ error: 'This account has been disabled' })

  res.json({ token: signToken(row), user: publicUser(row) })
})

router.post('/reset-password', (req, res) => {
  const id = normaliseEmail(req.body?.email)
  const password = String(req.body?.password ?? '')

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(id)
  if (!row) return res.status(404).json({ error: 'No account found with this email' })

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), row.id)
  res.json({ ok: true })
})

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

router.patch('/me', authenticate, (req, res) => {
  const { name, age, phone, address, interests, bio, languages } = req.body ?? {}

  if (!String(name ?? '').trim()) return res.status(400).json({ error: 'Name is required' })

  db.prepare(
    `UPDATE users
        SET name = ?, age = ?, phone = ?, address = ?, interests = ?, bio = ?, languages = ?
      WHERE id = ?`,
  ).run(
    String(name).trim(),
    age ? Number(age) : null,
    String(phone ?? '').trim() || null,
    String(address ?? '').trim() || null,
    JSON.stringify(Array.isArray(interests) ? interests : []),
    String(bio ?? '').trim() || null,
    JSON.stringify(Array.isArray(languages) ? languages : []),
    req.user.id,
  )

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  res.json({ user: publicUser(row) })
})

export default router
