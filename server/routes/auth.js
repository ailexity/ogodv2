import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { db } from '../db.js'
import { hashPassword, passwordProblem, verifyPassword } from '../password.js'
import { authenticate, publicUser, signToken } from '../auth.js'
import { consumeEmailToken, issueEmailToken } from '../email-tokens.js'
import { appUrl, sendPasswordResetEmail, sendVerificationEmail } from '../mailer.js'
import { emailKey, rateLimit } from '../rate-limit.js'
import { parseAge } from '../validate.js'

const router = Router()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VERIFY_TTL_MINUTES = 24 * 60
const RESET_TTL_MINUTES = 60

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ''
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null

const loginLimit = rateLimit({ windowMinutes: 15, max: 10, key: emailKey })
// Caps one client across many accounts, which the per-email limit alone doesn't.
const loginIpLimit = rateLimit({ windowMinutes: 15, max: 50 })
const registerLimit = rateLimit({ windowMinutes: 60, max: 10 })
const emailLimit = rateLimit({ windowMinutes: 60, max: 5, key: emailKey })
const tokenLimit = rateLimit({ windowMinutes: 15, max: 20 })
const googleLimit = rateLimit({ windowMinutes: 15, max: 30 })
const changePasswordLimit = rateLimit({ windowMinutes: 15, max: 10, key: (req) => String(req.user.id) })

function normaliseEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email)
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id)
}

function session(row, remember) {
  return { token: signToken(row, { remember: Boolean(remember) }), user: publicUser(row) }
}

async function sendVerification(req, row) {
  const token = issueEmailToken(row.id, 'verify_email', VERIFY_TTL_MINUTES)
  await sendVerificationEmail(row.email, row.name, `${appUrl(req)}/?verify=${token}`)
}

/** What the sign-in screens need to know before anyone is signed in. */
router.get('/config', (_req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null })
})

router.post('/register', registerLimit, async (req, res) => {
  const { email, password, name, age, phone, address, interests, languages } = req.body ?? {}
  const id = normaliseEmail(email)

  if (!EMAIL_PATTERN.test(id)) return res.status(400).json({ error: 'Enter a valid email address' })
  const problem = passwordProblem(password)
  if (problem) return res.status(400).json({ error: problem })
  if (!String(name ?? '').trim()) return res.status(400).json({ error: 'Name is required' })
  const parsedAge = parseAge(age)
  if (parsedAge.error) return res.status(400).json({ error: parsedAge.error })

  if (findByEmail(id)) {
    return res.status(409).json({ error: 'An account with this email already exists' })
  }

  const result = db
    .prepare(
      `INSERT INTO users (email, password_hash, role, name, age, phone, address, interests, languages)
       VALUES (?, ?, 'traveler', ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      hashPassword(String(password)),
      String(name).trim(),
      parsedAge.age,
      String(phone ?? '').trim() || null,
      String(address ?? '').trim() || null,
      JSON.stringify(Array.isArray(interests) ? interests : []),
      JSON.stringify(Array.isArray(languages) ? languages : []),
    )

  // The account exists either way; if the email fails, the user can resend it.
  let emailSent = true
  try {
    await sendVerification(req, findById(result.lastInsertRowid))
  } catch (error) {
    emailSent = false
    console.error('[ogod] Could not send verification email:', error)
  }

  res.status(201).json({ verificationRequired: true, email: id, emailSent })
})

router.post('/login', loginIpLimit, loginLimit, (req, res) => {
  const id = normaliseEmail(req.body?.email)
  const password = String(req.body?.password ?? '')

  const row = findByEmail(id)
  // One answer for every failure, so sign-in can't reveal which emails are registered.
  if (!row || !row.password_hash || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({
      error: 'Invalid email or password. If you signed up with Google, use "Continue with Google".',
    })
  }
  if (row.disabled) return res.status(403).json({ error: 'This account has been disabled' })
  if (!row.email_verified) {
    return res.status(403).json({
      error: 'Confirm your email address before signing in',
      code: 'email_unverified',
      email: row.email,
    })
  }

  res.json(session(row, req.body?.remember))
})

router.post('/verify-email', tokenLimit, (req, res) => {
  const userId = consumeEmailToken(req.body?.token, 'verify_email')
  const row = userId && findById(userId)
  if (!row) {
    return res.status(400).json({
      error: 'This confirmation link is invalid or has expired. Request a new one below.',
    })
  }

  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(row.id)
  const updated = findById(row.id)
  if (updated.disabled) return res.status(403).json({ error: 'This account has been disabled' })

  res.json(session(updated, false))
})

/** Always answers the same way, so it can't be used to discover which emails have accounts. */
router.post('/resend-verification', emailLimit, async (req, res) => {
  const row = findByEmail(normaliseEmail(req.body?.email))
  if (row && !row.email_verified && !row.disabled) {
    try {
      await sendVerification(req, row)
    } catch (error) {
      console.error('[ogod] Could not send verification email:', error)
      return res.status(502).json({ error: 'Could not send the email. Try again shortly.' })
    }
  }
  res.json({ ok: true })
})

/** Same uniform answer as resend: no hint whether the address is registered. */
router.post('/forgot-password', emailLimit, async (req, res) => {
  const row = findByEmail(normaliseEmail(req.body?.email))
  if (row && !row.disabled) {
    const token = issueEmailToken(row.id, 'reset_password', RESET_TTL_MINUTES)
    try {
      await sendPasswordResetEmail(row.email, row.name, `${appUrl(req)}/?reset=${token}`)
    } catch (error) {
      console.error('[ogod] Could not send password reset email:', error)
      return res.status(502).json({ error: 'Could not send the email. Try again shortly.' })
    }
  }
  res.json({ ok: true })
})

router.post('/reset-password', tokenLimit, (req, res) => {
  const password = String(req.body?.password ?? '')
  const problem = passwordProblem(password)
  if (problem) return res.status(400).json({ error: problem })

  const userId = consumeEmailToken(req.body?.token, 'reset_password')
  if (!userId || !findById(userId)) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' })
  }

  // Following the emailed link proves the address, and bumping the version signs
  // out every other session that was using the old password.
  db.prepare(
    `UPDATE users SET password_hash = ?, email_verified = 1, token_version = token_version + 1
      WHERE id = ?`,
  ).run(hashPassword(password), userId)

  res.json({ ok: true })
})

router.post('/google', googleLimit, async (req, res) => {
  if (!googleClient) {
    return res.status(503).json({ error: 'Google sign-in is not set up on this server' })
  }

  let profile
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: String(req.body?.credential ?? ''),
      audience: GOOGLE_CLIENT_ID,
    })
    profile = ticket.getPayload()
  } catch {
    return res.status(401).json({ error: 'Google sign-in failed, please try again' })
  }

  if (!profile?.email || !profile.email_verified) {
    return res.status(403).json({ error: 'Your Google account email is not verified' })
  }

  const email = normaliseEmail(profile.email)
  let row = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.sub)

  if (!row) {
    const existing = findByEmail(email)
    if (existing) {
      if (existing.google_id) {
        return res.status(409).json({ error: 'This email is linked to a different Google account' })
      }
      // An unverified account may have been registered by someone squatting on this
      // address. Google has proved who owns it, so drop that password and its sessions.
      const squatted = !existing.email_verified
      db.prepare(
        `UPDATE users
            SET google_id = ?, email_verified = 1,
                password_hash = CASE WHEN ? THEN '' ELSE password_hash END,
                token_version = token_version + CASE WHEN ? THEN 1 ELSE 0 END
          WHERE id = ?`,
      ).run(profile.sub, squatted ? 1 : 0, squatted ? 1 : 0, existing.id)
      row = findById(existing.id)
    } else {
      const name = String(profile.name ?? '').trim() || email.split('@')[0]
      const result = db
        .prepare(
          `INSERT INTO users (email, password_hash, role, name, google_id, email_verified)
           VALUES (?, '', 'traveler', ?, ?, 1)`,
        )
        .run(email, name, profile.sub)
      row = findById(result.lastInsertRowid)
    }
  }

  if (row.disabled) return res.status(403).json({ error: 'This account has been disabled' })
  res.json(session(row, req.body?.remember))
})

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

router.patch('/me', authenticate, (req, res) => {
  const { name, age, phone, address, interests, bio, languages } = req.body ?? {}

  if (!String(name ?? '').trim()) return res.status(400).json({ error: 'Name is required' })
  const parsedAge = parseAge(age)
  if (parsedAge.error) return res.status(400).json({ error: parsedAge.error })

  db.prepare(
    `UPDATE users
        SET name = ?, age = ?, phone = ?, address = ?, interests = ?, bio = ?, languages = ?
      WHERE id = ?`,
  ).run(
    String(name).trim(),
    parsedAge.age,
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

/** A guide's payment details, quoted to travellers in the automatic booking message. */
router.put('/me/payout', authenticate, (req, res) => {
  const upi = String(req.body?.upi ?? '').trim()
  const bank = String(req.body?.bank ?? '').trim()
  if (upi && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upi)) {
    return res.status(400).json({ error: 'Enter a valid UPI ID, like name@okaxis' })
  }
  if (bank.length > 300) return res.status(400).json({ error: 'Bank details are too long' })

  db.prepare('UPDATE users SET payout_upi = ?, payout_bank = ? WHERE id = ?').run(
    upi || null,
    bank || null,
    req.user.id,
  )
  res.json({ user: publicUser(findById(req.user.id)) })
})

/** Marks the first-run app tour as seen, so it plays once per account rather than per device. */
router.post('/me/tour', authenticate, (req, res) => {
  db.prepare(
    "UPDATE users SET tour_completed_at = COALESCE(tour_completed_at, datetime('now')) WHERE id = ?",
  ).run(req.user.id)
  res.json({ user: publicUser(findById(req.user.id)) })
})

/**
 * Change your own password. Every other session is signed out; this one gets
 * a fresh token so the person stays signed in here.
 */
router.post('/change-password', authenticate, changePasswordLimit, (req, res) => {
  const current = String(req.body?.currentPassword ?? '')
  const next = String(req.body?.newPassword ?? '')

  // Google-only accounts have no password yet, so there is nothing to confirm.
  if (req.user.password_hash && !verifyPassword(current, req.user.password_hash)) {
    return res.status(400).json({ error: 'Your current password is incorrect' })
  }
  const problem = passwordProblem(next)
  if (problem) return res.status(400).json({ error: problem })
  if (next === current) {
    return res.status(400).json({ error: 'Choose a password different from your current one' })
  }

  db.prepare(
    'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
  ).run(hashPassword(next), req.user.id)

  res.json(session(findById(req.user.id), req.body?.remember))
})

/** Signs out every device by invalidating all tokens issued so far. */
router.post('/logout-all', authenticate, (req, res) => {
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(req.user.id)
  res.json({ ok: true })
})

export default router
