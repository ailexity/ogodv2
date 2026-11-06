import { Router } from 'express'
import { db, isLastEnabledAdmin } from '../db.js'
import { authenticate, publicUser, requireAdmin } from '../auth.js'
import { hashPassword, passwordProblem } from '../password.js'
import { parseAge } from '../validate.js'
import { BLOG_QUERY, mapBlog } from './blogs.js'
import { SETTING_DEFINITIONS, getSettings, updateSettings } from '../settings.js'

const router = Router()

router.use(authenticate, requireAdmin)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function loadUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id)
}

/**
 * Doc §4 step 7: ongoing trust maintenance. With no review before someone posts,
 * this is what stops a bad actor, so it covers every guide and not just verified ones.
 */
router.post('/guides/:id/suspend', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id))
  if (!user) return res.status(404).json({ error: 'User not found' })
  if (user.guide_status === 'suspended') {
    return res.status(409).json({ error: 'This guide is already suspended' })
  }
  if (!user.guide_since && user.guide_status !== 'verified') {
    return res.status(409).json({ error: 'Only a guide can be suspended' })
  }

  db.transaction(() => {
    db.prepare("UPDATE users SET suspended_from = guide_status, guide_status = 'suspended' WHERE id = ?").run(
      user.id,
    )
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

  // Guides suspended before `suspended_from` existed could only have been verified.
  db.prepare(
    "UPDATE users SET guide_status = COALESCE(suspended_from, 'verified'), suspended_from = NULL WHERE id = ?",
  ).run(user.id)
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
      guides: {
        verified: count("SELECT COUNT(*) AS n FROM users WHERE guide_status = 'verified'"),
        suspended: count("SELECT COUNT(*) AS n FROM users WHERE guide_status = 'suspended'"),
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
    // Making someone a guide here is the admin vouching for them, so it carries
    // the Verified badge; they still give their guide details before posting.
    if (role === 'guide' && target.guide_status !== 'suspended') {
      db.prepare("UPDATE users SET guide_status = 'verified' WHERE id = ?").run(target.id)
    } else if (role === 'traveler' && (target.guide_since || ['verified', 'suspended'].includes(target.guide_status))) {
      // A suspension survives this. Anyone can become a guide again, so clearing
      // it here would be a way round it.
      db.prepare(
        `UPDATE users SET guide_since = NULL, certified = 0,
                guide_status = CASE WHEN guide_status = 'suspended' THEN 'suspended' ELSE 'none' END
          WHERE id = ?`,
      ).run(target.id)
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
    .prepare("SELECT * FROM users WHERE guide_since IS NOT NULL OR guide_status != 'none' ORDER BY name")
    .all()
  res.json({ guides: rows.map(publicUser) })
})

export default router
