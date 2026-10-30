import { randomBytes } from 'node:crypto'
import { unlink } from 'node:fs/promises'
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
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
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

const DOCUMENT_FIELDS = [
  { name: 'idDocument', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'licenseDocument', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
  { name: 'feeReceipt', maxCount: 1 },
]

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

function parseList(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
}

const applyLimit = rateLimit({ windowMinutes: 60, max: 5, key: (req) => String(req.user.id) })

/** Runs before the upload, so a request that will be refused never writes files. */
function canApply(req, res, next) {
  if (!getSettings().guide_applications_open) {
    return res.status(403).json({ error: 'Guide applications are closed at the moment' })
  }
  if (req.user.guide_status === 'verified') {
    return res.status(409).json({ error: 'You are already a verified guide' })
  }
  if (req.user.guide_status === 'pending') {
    return res.status(409).json({ error: 'Your application is already under review' })
  }
  if (req.user.guide_status === 'suspended') {
    return res.status(403).json({ error: 'Your guide account is suspended, contact support' })
  }
  next()
}

/** Doc §4 steps 1–2: apply to become a guide and submit verification documents. */
router.post('/apply', authenticate, applyLimit, canApply, upload.fields(DOCUMENT_FIELDS), (req, res) => {

  const { yearsExperience, licenseNumber, licenseRegion, licenseExpires, sampleItinerary } =
    req.body ?? {}
  const languages = parseList(req.body?.languages)
  const areas = parseList(req.body?.areas)
  const files = req.files ?? {}

  const problem = !files.idDocument?.[0]
    ? 'A government ID is required'
    : !files.selfie?.[0]
      ? 'A selfie is required for the liveness match'
      : !files.addressProof?.[0]
        ? 'Proof of address is required'
        : !files.feeReceipt?.[0]
          ? 'Upload the receipt for your yearly subscription payment'
        : languages.length === 0
          ? 'List at least one language you speak'
          : areas.length === 0
            ? 'List at least one area you operate in'
            : null
  if (problem) {
    // Nothing references these files yet, so don't leave them on disk.
    for (const file of Object.values(files).flat()) unlink(file.path).catch(() => {})
    return res.status(400).json({ error: problem })
  }

  const applicationId = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO guide_applications
           (user_id, years_experience, languages, areas, license_number, license_region,
            license_expires, sample_itinerary, id_document, selfie, license_document, address_proof,
            fee_receipt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        req.user.id,
        Number(yearsExperience) || 0,
        JSON.stringify(languages),
        JSON.stringify(areas),
        String(licenseNumber ?? '').trim() || null,
        String(licenseRegion ?? '').trim() || null,
        String(licenseExpires ?? '').trim() || null,
        String(sampleItinerary ?? '').trim() || null,
        files.idDocument[0].filename,
        files.selfie[0].filename,
        files.licenseDocument?.[0]?.filename ?? null,
        files.addressProof[0].filename,
        files.feeReceipt[0].filename,
      )

    db.prepare("UPDATE users SET guide_status = 'pending', languages = ? WHERE id = ?").run(
      JSON.stringify(languages),
      req.user.id,
    )

    return result.lastInsertRowid
  })()

  const application = db.prepare('SELECT * FROM guide_applications WHERE id = ?').get(applicationId)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)

  res.status(201).json({ application: mapApplication(application), user: publicUser(user) })
})

/** What the yearly guide subscription costs and where to pay it. */
router.get('/subscription', (_req, res) => {
  const { guide_subscription_fee: fee, platform_upi: upi } = getSettings()
  res.json({ subscription: { fee, currency: 'INR', upi: upi || null } })
})

function canRenew(req, res, next) {
  if (!['verified', 'suspended'].includes(req.user.guide_status)) {
    return res.status(409).json({ error: 'Only verified guides renew a subscription' })
  }
  const pending = db
    .prepare("SELECT 1 FROM guide_applications WHERE user_id = ? AND kind = 'renewal' AND status = 'pending'")
    .get(req.user.id)
  if (pending) return res.status(409).json({ error: 'Your renewal is already being reviewed' })
  next()
}

/** A yearly renewal: just the payment receipt, reviewed in the same admin queue. */
router.post('/renew', authenticate, applyLimit, canRenew, upload.single('feeReceipt'), (req, res) => {
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

/** Doc §4 step 5: the guide sees their own status, any rejection reason, and renewals. */
router.get('/application', authenticate, (req, res) => {
  const latest = (kind) =>
    db
      .prepare('SELECT * FROM guide_applications WHERE user_id = ? AND kind = ? ORDER BY id DESC LIMIT 1')
      .get(req.user.id, kind)

  res.json({
    application: mapApplication(latest('verification')),
    renewal: mapApplication(latest('renewal')),
    guideStatus: req.user.guide_status,
  })
})

export { mapApplication }
export default router
