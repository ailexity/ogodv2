import { Router } from 'express'
import { db } from '../db.js'
import { authenticate, publicUser } from '../auth.js'
import { getSettings } from '../settings.js'
import { rateLimit } from '../rate-limit.js'

const router = Router()

function asList(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []
}

const detailsLimit = rateLimit({ windowMinutes: 60, max: 20, key: (req) => String(req.user.id) })

/**
 * The essentials a guide gives before their first trip, and how they correct
 * them later. There is no review and no fee: saving these is what lets them post.
 */
router.put('/details', authenticate, detailsLimit, (req, res) => {
  if (req.user.guide_status === 'suspended') {
    return res.status(403).json({ error: 'Your guide account is suspended, contact support' })
  }
  if (!req.user.guide_since && !getSettings().guide_applications_open) {
    return res.status(403).json({ error: 'New guides can’t sign up at the moment' })
  }

  const phone = String(req.body?.phone ?? '').trim()
  const languages = asList(req.body?.languages)
  const areas = asList(req.body?.areas)
  const bio = String(req.body?.bio ?? '').trim()
  const rawYears = req.body?.yearsExperience
  const years = rawYears === '' || rawYears == null ? null : Number(rawYears)

  const problem =
    phone.replace(/\D/g, '').length < 7
      ? 'Enter a phone number travellers can reach you on'
      : languages.length === 0
        ? 'List at least one language you speak'
        : areas.length === 0
          ? 'List at least one area you run trips in'
          : years !== null && !(Number.isInteger(years) && years >= 0 && years <= 70)
            ? 'Enter your years of experience as a whole number'
            : bio.length > 1000
              ? 'Keep your bio under 1000 characters'
              : null
  if (problem) return res.status(400).json({ error: problem })

  db.prepare(
    `UPDATE users
        SET phone = ?, languages = ?, guide_areas = ?, guide_experience = ?, bio = ?,
            guide_since = COALESCE(guide_since, datetime('now')),
            role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'guide' END
      WHERE id = ?`,
  ).run(phone, JSON.stringify(languages), JSON.stringify(areas), years, bio || null, req.user.id)

  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) })
})

export default router
