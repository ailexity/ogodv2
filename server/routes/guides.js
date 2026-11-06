import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import { db, UPLOADS_DIR } from '../db.js'
import { authenticate, publicUser } from '../auth.js'
import { getSettings } from '../settings.js'
import { rateLimit } from '../rate-limit.js'

const router = Router()

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const EXTENSION = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
}

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    // The client-supplied name is discarded entirely — a random name plus an
    // extension derived from the vetted mimetype cannot escape the upload dir.
    filename: (_req, file, cb) =>
      cb(null, randomBytes(16).toString('hex') + EXTENSION[file.mimetype]),
  }),
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      const error = new Error('Documents must be a JPG, PNG, WEBP or PDF file')
      error.expose = true
      cb(error)
      return
    }
    cb(null, true)
  },
})

function mapApplication(row) {
  if (!row) return null
  return {
    id: row.id,
    status: row.status,
    kind: row.kind,
    yearsExperience: row.years_experience,
    languages: JSON.parse(row.languages ?? '[]'),
    areas: JSON.parse(row.areas ?? '[]'),
    licenseNumber: row.license_number,
    licenseRegion: row.license_region,
    licenseExpires: row.license_expires,
    sampleItinerary: row.sample_itinerary,
    documents: {
      idDocument: row.id_document,
      selfie: row.selfie,
      licenseDocument: row.license_document,
      addressProof: row.address_proof,
      feeReceipt: row.fee_receipt,
    },
    reviewNotes: row.review_notes,
    reviewedAt: row.reviewed_at,
    submittedAt: row.created_at,
    applicant: row.applicant_name
      ? { id: row.user_id, name: row.applicant_name, email: row.applicant_email }
      : undefined,
  }
}

function asList(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []
}

const renewLimit = rateLimit({ windowMinutes: 60, max: 5, key: (req) => String(req.user.id) })
const detailsLimit = rateLimit({ windowMinutes: 60, max: 20, key: (req) => String(req.user.id) })

/**
 * The essentials a guide gives before their first trip, and how they correct
 * them later. There is no review: saving these is what lets them post.
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

/** What the yearly guide subscription costs and where to pay it. */
router.get('/subscription', (_req, res) => {
  const { guide_subscription_fee: fee, platform_upi: upi } = getSettings()
  res.json({ subscription: { fee, currency: 'INR', upi: upi || null } })
})

function canRenew(req, res, next) {
  if (!req.user.guide_since) {
    return res.status(409).json({ error: 'Add your guide details first' })
  }
  const pending = db
    .prepare("SELECT 1 FROM guide_applications WHERE user_id = ? AND kind = 'renewal' AND status = 'pending'")
    .get(req.user.id)
  if (pending) return res.status(409).json({ error: 'Your renewal is already being reviewed' })
  next()
}

/** A yearly renewal: just the payment receipt, reviewed in the admin queue. */
router.post('/renew', authenticate, renewLimit, canRenew, upload.single('feeReceipt'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload the receipt for your subscription payment' })

  const id = db
    .prepare(
      `INSERT INTO guide_applications (user_id, kind, languages, areas, fee_receipt)
       VALUES (?, 'renewal', ?, '[]', ?)`,
    )
    .run(req.user.id, req.user.languages ?? '[]', req.file.filename).lastInsertRowid

  const row = db.prepare('SELECT * FROM guide_applications WHERE id = ?').get(id)
  res.status(201).json({ renewal: mapApplication(row) })
})

/** The guide's own latest renewal, so their profile can say where it stands. */
router.get('/application', authenticate, (req, res) => {
  const renewal = db
    .prepare("SELECT * FROM guide_applications WHERE user_id = ? AND kind = 'renewal' ORDER BY id DESC LIMIT 1")
    .get(req.user.id)

  res.json({ renewal: mapApplication(renewal), guideStatus: req.user.guide_status })
})

export { mapApplication }
export default router
