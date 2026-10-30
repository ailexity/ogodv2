import { randomBytes } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { Router } from 'express'
import multer from 'multer'
import { db, CHAT_MEDIA_DIR } from '../db.js'
import { authenticate } from '../auth.js'
import { rateLimit } from '../rate-limit.js'

const router = Router()

router.use(authenticate)

const MAX_BODY_LENGTH = 2000
const IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

const upload = multer({
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CHAT_MEDIA_DIR),
    filename: (_req, file, cb) => cb(null, randomBytes(16).toString('hex') + IMAGE_TYPES[file.mimetype]),
  }),
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_TYPES[file.mimetype]) {
      const error = new Error('Photos must be a JPG, PNG, WEBP or GIF file')
      error.expose = true
      cb(error)
      return
    }
    cb(null, true)
  },
})

const startLimit = rateLimit({ windowMinutes: 60, max: 30, key: (req) => String(req.user.id) })
const sendLimit = rateLimit({ windowMinutes: 1, max: 30, key: (req) => String(req.user.id) })

function discard(file) {
  if (file) unlink(file.path).catch(() => {})
}

/**
 * One thread per traveller–guide pair. `@me` is the caller, which decides
 * which side's last-read marker counts for the unread badge.
 */
const CONVERSATION_QUERY = `
  SELECT c.*,
         tr.name AS traveler_name, tr.guide_status AS traveler_guide_status,
         g.name AS guide_name, g.guide_status AS guide_status,
         t.title AS trip_title,
         bl.title AS blog_title,
         m.body AS last_body, m.image AS last_image, m.sender_id AS last_sender_id,
         m.created_at AS last_at,
         (SELECT COUNT(*) FROM messages u
           WHERE u.conversation_id = c.id AND u.sender_id != @me
             AND u.id > CASE WHEN c.traveler_id = @me THEN c.traveler_last_read ELSE c.guide_last_read END
         ) AS unread
    FROM conversations c
    JOIN users tr ON tr.id = c.traveler_id
    JOIN users g  ON g.id = c.guide_id
    LEFT JOIN trips t ON t.id = c.trip_id
    LEFT JOIN blogs bl ON bl.id = c.blog_id
    LEFT JOIN messages m ON m.id = (SELECT MAX(id) FROM messages WHERE conversation_id = c.id)
`

function mapConversation(row, me) {
  const iAmTraveler = row.traveler_id === me
  return {
    id: row.id,
    role: iAmTraveler ? 'traveler' : 'guide',
    // Chats can be with a guide or with a story's writer, so "guide" comes from
    // the other person's own status rather than which side of the thread they're on.
    other: iAmTraveler
      ? {
          id: row.guide_id,
          name: row.guide_name,
          isGuide: row.guide_status === 'verified',
          verified: row.guide_status === 'verified',
        }
      : {
          id: row.traveler_id,
          name: row.traveler_name,
          isGuide: row.traveler_guide_status === 'verified',
          verified: row.traveler_guide_status === 'verified',
        },
    trip: row.trip_id ? { id: row.trip_id, title: row.trip_title } : null,
    blog: row.blog_id ? { id: row.blog_id, title: row.blog_title } : null,
    lastMessage: row.last_at
      ? {
          body: row.last_body,
          hasImage: Boolean(row.last_image),
          fromMe: row.last_sender_id === me,
          createdAt: row.last_at,
        }
      : null,
    unread: row.unread,
    updatedAt: row.updated_at,
  }
}

/** The booking a request or ticket message is about, as it stands now. */
function loadBookingSummary(bookingId) {
  const row = db
    .prepare(
      `SELECT b.id, b.status, b.payment_status, b.cancelled_by, b.travelers, b.total_paid,
              t.title, t.currency, t.start_date
         FROM bookings b JOIN trips t ON t.id = b.trip_id
        WHERE b.id = ?`,
    )
    .get(bookingId)
  if (!row) return null
  return {
    id: row.id,
    status: row.status,
    paymentStatus: row.payment_status,
    cancelledBy: row.cancelled_by,
    travelers: row.travelers,
    total: row.total_paid,
    currency: row.currency,
    tripTitle: row.title,
    startDate: row.start_date,
  }
}

/** Finds the thread between two people (either way round) or opens one. */
export function ensureConversation(travelerId, guideId, tripId, blogId = null) {
  const existing = db
    .prepare(
      `SELECT * FROM conversations
        WHERE (traveler_id = ? AND guide_id = ?) OR (traveler_id = ? AND guide_id = ?)`,
    )
    .get(travelerId, guideId, guideId, travelerId)
  if (existing) {
    // Keep the thread pointing at the trip or story they are talking about now.
    if (tripId || blogId) {
      db.prepare('UPDATE conversations SET trip_id = ?, blog_id = ? WHERE id = ?').run(
        tripId ?? null,
        blogId ?? null,
        existing.id,
      )
    }
    return { conversation: existing, created: false }
  }
  const id = db
    .prepare('INSERT INTO conversations (traveler_id, guide_id, trip_id, blog_id) VALUES (?, ?, ?, ?)')
    .run(travelerId, guideId, tripId ?? null, blogId ?? null).lastInsertRowid
  return { conversation: db.prepare('SELECT * FROM conversations WHERE id = ?').get(id), created: true }
}

/**
 * Sends a message on the guide's behalf — the booking request reply, the
 * confirmation with its ticket, a decline. Returns the thread id.
 */
export function postSystemMessage({ travelerId, guideId, tripId, bookingId, kind, body, senderId = guideId }) {
  return db.transaction(() => {
    const { conversation } = ensureConversation(travelerId, guideId, tripId)
    const messageId = db
      .prepare('INSERT INTO messages (conversation_id, sender_id, body, kind, booking_id) VALUES (?, ?, ?, ?, ?)')
      .run(conversation.id, senderId, body, kind, bookingId ?? null).lastInsertRowid
    db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conversation.id)
    markRead(conversation, senderId, messageId)
    return conversation.id
  })()
}

function mapMessage(row, me) {
  return {
    id: row.id,
    kind: row.kind,
    booking: row.booking_id ? loadBookingSummary(row.booking_id) : null,
    body: row.body,
    image: row.image ? `/messages/media/${row.image}` : null,
    fromMe: row.sender_id === me,
    createdAt: row.created_at,
  }
}

function loadConversation(id, me) {
  return db
    .prepare(`${CONVERSATION_QUERY} WHERE c.id = @id AND (c.traveler_id = @me OR c.guide_id = @me)`)
    .get({ id, me })
}

/** Moves the caller's read marker forward (never back). */
function markRead(row, me, messageId) {
  const column = row.traveler_id === me ? 'traveler_last_read' : 'guide_last_read'
  db.prepare(`UPDATE conversations SET ${column} = MAX(${column}, ?) WHERE id = ?`).run(messageId, row.id)
}

/** The inbox: threads that have at least one message, most recent first. */
router.get('/', (req, res) => {
  const me = req.user.id
  const rows = db
    .prepare(
      `${CONVERSATION_QUERY}
        WHERE (c.traveler_id = @me OR c.guide_id = @me) AND m.id IS NOT NULL
        ORDER BY c.updated_at DESC, c.id DESC`,
    )
    .all({ me })

  res.json({ conversations: rows.map((row) => mapConversation(row, me)) })
})

/** Total unread across every thread, for the badge on the messages button. */
router.get('/unread', (req, res) => {
  const me = req.user.id
  const { n } = db
    .prepare(
      `SELECT COUNT(*) AS n
         FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE m.sender_id != @me
          AND ((c.traveler_id = @me AND m.id > c.traveler_last_read)
            OR (c.guide_id = @me AND m.id > c.guide_last_read))`,
    )
    .get({ me })

  res.json({ unread: n })
})

/** Chat photos are private, so only the two people in the thread can load one. */
router.get('/media/:filename', (req, res) => {
  const { filename } = req.params
  if (!/^[a-f0-9]{32}\.(jpg|png|webp|gif)$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid media reference' })
  }

  const allowed = db
    .prepare(
      `SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE m.image = ? AND (c.traveler_id = ? OR c.guide_id = ?)`,
    )
    .get(filename, req.user.id, req.user.id)
  if (!allowed) return res.status(404).json({ error: 'Photo not found' })

  // `root` keeps send's dot-folder check to the filename, so the server works
  // even when installed under a path like /home/me/.apps/ogod.
  res.sendFile(filename, { root: CHAT_MEDIA_DIR }, (error) => {
    if (error && !res.headersSent) res.status(404).json({ error: 'Photo not found' })
  })
})

/**
 * Opens (or reuses) the thread with someone. Travellers can write to any
 * verified guide; a guide can write to anyone who booked one of their trips.
 */
router.post('/', startLimit, (req, res) => {
  const me = req.user.id
  const otherId = Number(req.body?.userId)
  const tripId = req.body?.tripId ? Number(req.body.tripId) : null

  if (!otherId || otherId === me) return res.status(400).json({ error: 'Choose who to message' })

  const other = db.prepare('SELECT id, guide_status, disabled FROM users WHERE id = ?').get(otherId)
  if (!other || other.disabled) return res.status(404).json({ error: 'This person is not available' })

  const trip = tripId ? db.prepare('SELECT id, guide_id FROM trips WHERE id = ?').get(tripId) : null
  if (tripId && !trip) return res.status(404).json({ error: 'Trip not found' })
  const blogId = req.body?.blogId ? Number(req.body.blogId) : null
  const blog = blogId
    ? db.prepare("SELECT id, author_id FROM blogs WHERE id = ? AND status = 'published'").get(blogId)
    : null
  if (blogId && !blog) return res.status(404).json({ error: 'Story not found' })

  let travelerId
  let guideId
  if (trip && trip.guide_id === me) {
    const booked = db
      .prepare('SELECT 1 FROM bookings WHERE trip_id = ? AND user_id = ?')
      .get(trip.id, otherId)
    if (!booked) {
      return res.status(403).json({ error: 'You can only message travellers who booked this trip' })
    }
    travelerId = otherId
    guideId = me
  } else if (blog?.author_id === otherId || other.guide_status === 'verified') {
    // Anyone can write to a trip's guide or to the writer of a story.
    travelerId = me
    guideId = otherId
  } else {
    return res.status(403).json({ error: 'You can message trip guides and story writers' })
  }

  const { conversation, created } = ensureConversation(
    travelerId,
    guideId,
    trip?.id ?? null,
    blog?.id ?? null,
  )
  res
    .status(created ? 201 : 200)
    .json({ conversation: mapConversation(loadConversation(conversation.id, me), me) })
})

/**
 * A thread's messages. With `?after=<id>` only newer ones are returned, which
 * is how the chat screen polls for replies. Reading marks them as read.
 */
router.get('/:id', (req, res) => {
  const me = req.user.id
  const row = loadConversation(Number(req.params.id), me)
  if (!row) return res.status(404).json({ error: 'Conversation not found' })

  const after = Number(req.query.after) || 0
  const messages = after
    ? db
        .prepare('SELECT * FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id LIMIT 200')
        .all(row.id, after)
    : db
        .prepare(
          `SELECT * FROM (SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 200)
            ORDER BY id`,
        )
        .all(row.id)

  if (messages.length) markRead(row, me, messages[messages.length - 1].id)

  res.json({
    conversation: mapConversation(loadConversation(row.id, me), me),
    messages: messages.map((message) => mapMessage(message, me)),
  })
})

/** Checked before the upload, so outsiders can't write files into the chat folder. */
function requireParticipant(req, res, next) {
  const row = loadConversation(Number(req.params.id), req.user.id)
  if (!row) return res.status(404).json({ error: 'Conversation not found' })
  req.conversation = row
  next()
}

router.post('/:id', sendLimit, requireParticipant, upload.single('image'), (req, res) => {
  const me = req.user.id
  const row = req.conversation
  const body = String(req.body?.body ?? '').trim()

  if (!body && !req.file) return res.status(400).json({ error: 'Write a message or attach a photo' })
  if (body.length > MAX_BODY_LENGTH) {
    discard(req.file)
    return res.status(400).json({ error: `Messages can be at most ${MAX_BODY_LENGTH} characters` })
  }

  const messageId = db.transaction(() => {
    const id = db
      .prepare('INSERT INTO messages (conversation_id, sender_id, body, image) VALUES (?, ?, ?, ?)')
      .run(row.id, me, body, req.file?.filename ?? null).lastInsertRowid
    db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(row.id)
    markRead(row, me, id)
    // A photo from the traveller is most likely their payment screenshot, so
    // flag their unpaid requests with this guide for checking.
    if (req.file && row.traveler_id === me) {
      db.prepare(
        `UPDATE bookings SET payment_status = 'proof_sent'
          WHERE user_id = ? AND status = 'pending' AND payment_status = 'unpaid'
            AND trip_id IN (SELECT id FROM trips WHERE guide_id = ?)`,
      ).run(me, row.guide_id)
    }
    return id
  })()

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId)
  res.status(201).json({ message: mapMessage(message, me) })
})

export default router
