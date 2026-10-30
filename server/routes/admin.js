import path from 'node:path'
import { Router } from 'express'
import { db, UPLOADS_DIR, isLastEnabledAdmin } from '../db.js'
import { authenticate, publicUser, requireAdmin } from '../auth.js'
import { hashPassword, passwordProblem } from '../password.js'
import { parseAge } from '../validate.js'
import { mapApplication } from './guides.js'
import { BLOG_QUERY, mapBlog } from './blogs.js'
import { SETTING_DEFINITIONS, getSettings, updateSettings } from '../settings.js'

const router = Router()

router.use(authenticate, requireAdmin)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function loadUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id)
}

const APPLICATION_QUERY = `
  SELECT a.*, u.name AS applicant_name, u.email AS applicant_email
    FROM guide_applications a
    JOIN users u ON u.id = a.user_id
`

/** Doc §4 step 3: the admin review queue. */
router.get('/applications', (req, res) => {
  const status = req.query.status
  const rows =
    status && ['pending', 'approved', 'rejected'].includes(status)
      ? db.prepare(`${APPLICATION_QUERY} WHERE a.status = ? ORDER BY a.created_at ASC`).all(status)
      : db.prepare(`${APPLICATION_QUERY} ORDER BY a.created_at ASC`).all()

  res.json({ applications: rows.map(mapApplication) })
})

function decide(applicationId, decision, adminId, notes, certified) {
  const application = db
    .prepare('SELECT * FROM guide_applications WHERE id = ?')
    .get(applicationId)

  if (!application) return { error: 'Application not found', code: 404 }
  if (application.status !== 'pending') {
    return { error: 'This application has already been reviewed', code: 409 }
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE guide_applications
          SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = datetime('now')
        WHERE id = ?`,
    ).run(decision, notes, adminId, applicationId)

    if (application.kind === 'renewal') {
      // A renewal only extends the subscription by a year from whichever is
      // later, today or the current end; rejecting it leaves the guide as is.
      if (decision === 'approved') {
        db.prepare(
          `UPDATE users
              SET subscription_until = date(MAX(COALESCE(subscription_until, date('now')), date('now')), '+1 year')
            WHERE id = ?`,
        ).run(application.user_id)
      }
    } else if (decision === 'approved') {
      // Doc §4 step 6: approval flips the profile live and unlocks "Post a Trip".
      // An admin who applies keeps their admin role.
      db.prepare(
        `UPDATE users SET guide_status = 'verified', certified = ?,
                subscription_until = date('now', '+1 year'),
                role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'guide' END
          WHERE id = ?`,
      ).run(certified ? 1 : 0, application.user_id)
    } else {
      db.prepare("UPDATE users SET guide_status = 'rejected' WHERE id = ?").run(application.user_id)
    }
  })()

  return { userId: application.user_id }
}

/** Doc §4 steps 4–6: approve, optionally granting the "Certified" badge. */
router.post('/applications/:id/approve', (req, res) => {
  const result = decide(
    Number(req.params.id),
    'approved',
    req.user.id,
    String(req.body?.notes ?? '').trim() || null,
    Boolean(req.body?.certified),
  )
  if (result.error) return res.status(result.code).json({ error: result.error })

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.userId)
  res.json({ user: publicUser(user) })
})

/** Doc §4 step 5: rejection must carry a reason so the guide can fix and reapply. */
router.post('/applications/:id/reject', (req, res) => {
  const notes = String(req.body?.notes ?? '').trim()
  if (!notes) return res.status(400).json({ error: 'A rejection reason is required' })

  const result = decide(Number(req.params.id), 'rejected', req.user.id, notes, false)
  if (result.error) return res.status(result.code).json({ error: result.error })

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.userId)
  res.json({ user: publicUser(user) })
})

/** Doc §4 step 7: ongoing trust maintenance — suspend or reinstate a verified guide. */
router.post('/guides/:id/suspend', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id))
  if (!user) return res.status(404).json({ error: 'User not found' })
  if (user.guide_status !== 'verified') {
    return res.status(409).json({ error: 'Only a verified guide can be suspended' })
  }

  db.transaction(() => {
    db.prepare("UPDATE users SET guide_status = 'suspended' WHERE id = ?").run(user.id)
    // A suspended guide's open listings must stop taking bookings immediately.
    db.prepare(
      `UPDATE trips SET status = 'booking_closed', updated_at = datetime('now')
        WHERE guide_id = ? AND status IN ('published', 'booking_open')`,
    ).run(user.id)
  })()

  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) })
})

router.post('/guides/:id/reinstate', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id))
  if (!user) return res.status(404).json({ error: 'User not found' })
  if (user.guide_status !== 'suspended') {
    return res.status(409).json({ error: 'This guide is not suspended' })
  }

  db.prepare("UPDATE users SET guide_status = 'verified' WHERE id = ?").run(user.id)
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) })
})

/** Platform statistics for the admin dashboard. */
router.get('/stats', (_req, res) => {
  const count = (sql, ...params) => db.prepare(sql).get(...params).n

  const byStatus = (table, column) =>
    Object.fromEntries(
      db
        .prepare(`SELECT ${column} AS key, COUNT(*) AS n FROM ${table} GROUP BY ${column}`)
        .all()
        .map((row) => [row.key, row.n]),
    )

  const money = db
    .prepare(
      `SELECT COALESCE(SUM(total_paid), 0) AS gross,
              COALESCE(SUM(service_fee), 0) AS fees,
              COALESCE(SUM(travelers), 0)   AS seats
         FROM bookings WHERE status != 'cancelled'`,
    )
    .get()

  res.json({
    stats: {
      users: {
        total: count('SELECT COUNT(*) AS n FROM users'),
        travelers: count("SELECT COUNT(*) AS n FROM users WHERE role = 'traveler'"),
        guides: count("SELECT COUNT(*) AS n FROM users WHERE role = 'guide'"),
        admins: count("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"),
      },
      verification: {
        ...{ none: 0, pending: 0, verified: 0, rejected: 0, suspended: 0 },
        ...byStatus('users', 'guide_status'),
        awaitingReview: count("SELECT COUNT(*) AS n FROM guide_applications WHERE status = 'pending'"),
      },
      trips: {
        total: count('SELECT COUNT(*) AS n FROM trips'),
        ...byStatus('trips', 'status'),
      },
      bookings: {
        total: count('SELECT COUNT(*) AS n FROM bookings'),
        ...byStatus('bookings', 'status'),
        seatsSold: money.seats,
      },
      revenue: {
        gross: Math.round(money.gross * 100) / 100,
        platformFees: Math.round(money.fees * 100) / 100,
      },
    },
  })
})

/** Everyone on the platform, for the people-management screen. */
router.get('/users', (req, res) => {
  const { role, q } = req.query
  const clauses = []
  const params = []

  if (role && ['traveler', 'guide', 'admin'].includes(role)) {
    clauses.push('u.role = ?')
    params.push(role)
  }
  if (q) {
    clauses.push('(u.name LIKE ? OR u.email LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }

  const rows = db
    .prepare(
      `SELECT u.*,
              (SELECT COUNT(*) FROM trips t WHERE t.guide_id = u.id)    AS trip_count,
              (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id)  AS booking_count
         FROM users u
        ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
        ORDER BY u.created_at DESC, u.id DESC`,
    )
    .all(...params)

  res.json({
    users: rows.map((row) => ({
      ...publicUser(row),
      tripCount: row.trip_count,
      bookingCount: row.booking_count,
      createdAt: row.created_at,
    })),
  })
})

/** Admin can correct a person's profile details directly from the People screen. */
router.patch('/users/:id', (req, res) => {
  const target = loadUser(Number(req.params.id))
  if (!target) return res.status(404).json({ error: 'User not found' })

  const { name, email, phone, address, age, bio } = req.body ?? {}
  const trimmedName = String(name ?? '').trim()
  const normalisedEmail = String(email ?? '').trim().toLowerCase()

  if (!trimmedName) return res.status(400).json({ error: 'Name is required' })
  if (!EMAIL_PATTERN.test(normalisedEmail)) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }

  const { age: parsedAge, error: ageError } = parseAge(age)
  if (ageError) return res.status(400).json({ error: ageError })

  const emailOwner = db.prepare('SELECT id FROM users WHERE email = ?').get(normalisedEmail)
  if (emailOwner && emailOwner.id !== target.id) {
    return res.status(409).json({ error: 'Another account already uses this email' })
  }

  db.prepare(
    `UPDATE users SET name = ?, email = ?, phone = ?, address = ?, age = ?, bio = ? WHERE id = ?`,
  ).run(
    trimmedName,
    normalisedEmail,
    String(phone ?? '').trim() || null,
    String(address ?? '').trim() || null,
    parsedAge,
    String(bio ?? '').trim() || null,
    target.id,
  )

  res.json({ user: publicUser(loadUser(target.id)) })
})

/** Promote or demote a member directly, outside the guide-application flow. */
router.patch('/users/:id/role', (req, res) => {
  const target = loadUser(Number(req.params.id))
  if (!target) return res.status(404).json({ error: 'User not found' })

  const role = req.body?.role
  if (!['traveler', 'guide', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }
  if (target.role === 'admin' && role !== 'admin' && isLastEnabledAdmin(target.id)) {
    return res.status(409).json({ error: 'At least one admin must remain' })
  }

  db.transaction(() => {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target.id)
    // Posting rights follow guide_status, so it has to move with the role.
    if (role === 'guide' && target.guide_status !== 'suspended') {
      db.prepare("UPDATE users SET guide_status = 'verified' WHERE id = ?").run(target.id)
    } else if (role === 'traveler' && ['verified', 'suspended'].includes(target.guide_status)) {
      db.prepare("UPDATE users SET guide_status = 'none', certified = 0 WHERE id = ?").run(target.id)
      db.prepare(
        `UPDATE trips SET status = 'booking_closed', updated_at = datetime('now')
          WHERE guide_id = ? AND status IN ('published', 'booking_open')`,
      ).run(target.id)
    }
  })()
  res.json({ user: publicUser(loadUser(target.id)) })
})

/**
 * An admin reset hands the new password to the admin to relay; people can also
 * reset their own by email. Either way, every existing session is signed out.
 */
router.post('/users/:id/reset-password', (req, res) => {
  const target = loadUser(Number(req.params.id))
  if (!target) return res.status(404).json({ error: 'User not found' })

  const password = String(req.body?.password ?? '')
  const problem = passwordProblem(password)
  if (problem) return res.status(400).json({ error: problem })

  db.prepare(
    'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
  ).run(hashPassword(password), target.id)
  res.json({ ok: true })
})

/** For someone who can't receive the confirmation email — the admin vouches for the address. */
router.post('/users/:id/verify-email', (req, res) => {
  const target = loadUser(Number(req.params.id))
  if (!target) return res.status(404).json({ error: 'User not found' })

  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(target.id)
  res.json({ user: publicUser(loadUser(target.id)) })
})

router.post('/users/:id/disable', (req, res) => {
  const target = loadUser(Number(req.params.id))
  if (!target) return res.status(404).json({ error: 'User not found' })
  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot disable your own account' })
  }
  if (target.role === 'admin' && isLastEnabledAdmin(target.id)) {
    return res.status(409).json({ error: 'At least one admin must remain' })
  }

  db.prepare('UPDATE users SET disabled = 1 WHERE id = ?').run(target.id)
  res.json({ user: publicUser(loadUser(target.id)) })
})

router.post('/users/:id/enable', (req, res) => {
  const target = loadUser(Number(req.params.id))
  if (!target) return res.status(404).json({ error: 'User not found' })

  db.prepare('UPDATE users SET disabled = 0 WHERE id = ?').run(target.id)
  res.json({ user: publicUser(loadUser(target.id)) })
})

/** Permanent removal — cascades to their trips, bookings and applications. */
router.delete('/users/:id', (req, res) => {
  const target = loadUser(Number(req.params.id))
  if (!target) return res.status(404).json({ error: 'User not found' })
  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' })
  }
  if (target.role === 'admin' && isLastEnabledAdmin(target.id)) {
    return res.status(409).json({ error: 'At least one admin must remain' })
  }

  // Deleting a guide cascades to their trips, which would silently wipe other
  // travellers' bookings.
  const activeBookings = db
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings b JOIN trips t ON t.id = b.trip_id
        WHERE t.guide_id = ? AND b.user_id != ? AND b.status IN ('pending', 'confirmed')`,
    )
    .get(target.id, target.id).n
  if (activeBookings > 0) {
    return res.status(409).json({
      error: `This guide has ${activeBookings} active booking(s) from other travellers. Cancel their trips first.`,
    })
  }

  db.transaction(() => {
    // Older databases have no ON DELETE rule on reviewed_by, so clear it by hand.
    db.prepare('UPDATE guide_applications SET reviewed_by = NULL WHERE reviewed_by = ?').run(target.id)
    db.prepare('DELETE FROM users WHERE id = ?').run(target.id)
  })()
  res.json({ ok: true })
})

/** Every story, published or hidden, for the admin moderation screen. */
router.get('/blogs', (_req, res) => {
  const rows = db.prepare(`${BLOG_QUERY} ORDER BY b.created_at DESC`).all()
  res.json({ blogs: rows.map(mapBlog) })
})

router.post('/blogs/:id/hide', (req, res) => {
  const blog = db.prepare('SELECT * FROM blogs WHERE id = ?').get(Number(req.params.id))
  if (!blog) return res.status(404).json({ error: 'Story not found' })

  db.prepare("UPDATE blogs SET status = 'hidden' WHERE id = ?").run(blog.id)
  res.json({ blog: mapBlog(db.prepare(`${BLOG_QUERY} WHERE b.id = ?`).get(blog.id)) })
})

router.post('/blogs/:id/unhide', (req, res) => {
  const blog = db.prepare('SELECT * FROM blogs WHERE id = ?').get(Number(req.params.id))
  if (!blog) return res.status(404).json({ error: 'Story not found' })

  db.prepare("UPDATE blogs SET status = 'published' WHERE id = ?").run(blog.id)
  res.json({ blog: mapBlog(db.prepare(`${BLOG_QUERY} WHERE b.id = ?`).get(blog.id)) })
})

router.get('/settings', (_req, res) => {
  res.json({ settings: getSettings(), definitions: SETTING_DEFINITIONS })
})

router.patch('/settings', (req, res) => {
  const result = updateSettings(req.body?.settings)
  if (result.error) return res.status(400).json({ error: result.error })
  res.json({ settings: result.settings, definitions: SETTING_DEFINITIONS })
})

router.get('/guides', (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM users WHERE guide_status != 'none' ORDER BY name")
    .all()
  res.json({ guides: rows.map(publicUser) })
})

/**
 * Verification documents include government IDs, so they are never served
 * statically — only an authenticated admin can stream one.
 */
router.get('/documents/:filename', (req, res) => {
  const { filename } = req.params
  if (!/^[a-f0-9]{32}\.(jpg|png|webp|pdf)$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid document reference' })
  }

  res.sendFile(path.join(UPLOADS_DIR, filename), (error) => {
    if (error && !res.headersSent) res.status(404).json({ error: 'Document not found' })
  })
})

export default router
