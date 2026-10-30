import { Router } from 'express'
import { db } from '../db.js'
import { authenticate, optionalAuth, requireVerifiedGuide, subscriptionActive } from '../auth.js'

const router = Router()

/** Doc §7 trip lifecycle. Each key lists the statuses it may move to next. */
const TRANSITIONS = {
  draft: ['published', 'cancelled'],
  published: ['booking_open', 'draft', 'cancelled'],
  booking_open: ['booking_closed', 'cancelled'],
  booking_closed: ['confirmed', 'booking_open', 'cancelled'],
  confirmed: ['ongoing', 'cancelled'],
  ongoing: ['completed'],
  completed: ['archived'],
  archived: [],
  cancelled: [],
}

/** Statuses a traveler can discover in the browse/search feed. */
const DISCOVERABLE = ['published', 'booking_open', 'booking_closed']

const DIFFICULTIES = ['easy', 'moderate', 'challenging', 'strenuous']

export const TRIP_QUERY = `
  SELECT t.*, u.name AS guide_name, u.bio AS guide_bio,
         u.guide_status AS guide_status, u.certified AS guide_certified,
         (SELECT COALESCE(SUM(b.travelers), 0)
            FROM bookings b
           WHERE b.trip_id = t.id AND b.status IN ('pending', 'confirmed', 'completed')
         ) AS booked_seats,
         (SELECT COUNT(*)
            FROM bookings b2
           WHERE b2.trip_id = t.id AND b2.status = 'pending'
         ) AS pending_requests
    FROM trips t
    JOIN users u ON u.id = t.guide_id
`

/** Bookings close at the deadline, and in any case once the trip has started. */
export function bookingWindowOpen(row) {
  const today = new Date().toISOString().slice(0, 10)
  if (row.booking_deadline && today > row.booking_deadline) return false
  if (row.start_date && today >= row.start_date) return false
  return true
}

export function mapTrip(row, itinerary) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    category: row.category,
    description: row.description,
    status: row.status,
    coverImage: row.cover_image,
    durationDays: row.duration_days,
    meetingPoint: row.meeting_point,
    minGroupSize: row.min_group_size,
    maxGroupSize: row.max_group_size,
    pricePerPerson: row.price_per_person,
    currency: row.currency,
    difficulty: row.difficulty,
    languages: JSON.parse(row.languages ?? '[]'),
    included: JSON.parse(row.included ?? '[]'),
    excluded: JSON.parse(row.excluded ?? '[]'),
    highlights: JSON.parse(row.highlights ?? '[]'),
    startDate: row.start_date,
    endDate: row.end_date,
    bookingDeadline: row.booking_deadline,
    // What the Book button needs: open status, inside the booking window, seats left.
    bookable:
      row.status === 'booking_open' &&
      bookingWindowOpen(row) &&
      row.max_group_size - (row.booked_seats ?? 0) > 0,
    rating: row.rating,
    reviewCount: row.review_count,
    bookedSeats: row.booked_seats ?? 0,
    seatsLeft: Math.max(0, row.max_group_size - (row.booked_seats ?? 0)),
    pendingRequests: row.pending_requests ?? 0,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    guide: {
      id: row.guide_id,
      name: row.guide_name,
      bio: row.guide_bio,
      verified: row.guide_status === 'verified',
      certified: Boolean(row.guide_certified),
    },
    itinerary: itinerary ?? undefined,
  }
}

function loadItinerary(tripId) {
  return db
    .prepare(
      'SELECT day_number, title, description FROM trip_itinerary_days WHERE trip_id = ? ORDER BY day_number',
    )
    .all(tripId)
    .map((day) => ({ day: day.day_number, title: day.title, description: day.description }))
}

function asList(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []
}

function validateTripInput(body) {
  const title = String(body?.title ?? '').trim()
  const destination = String(body?.destination ?? '').trim()
  const category = String(body?.category ?? '').trim()
  const description = String(body?.description ?? '').trim()

  if (!title) return { error: 'Trip title is required' }
  if (!destination) return { error: 'Destination is required' }
  if (!category) return { error: 'Category is required' }
  if (!description) return { error: 'Description is required' }

  const minGroupSize = Number(body?.minGroupSize ?? 1)
  const maxGroupSize = Number(body?.maxGroupSize ?? 10)
  if (!Number.isFinite(minGroupSize) || minGroupSize < 1) {
    return { error: 'Minimum group size must be at least 1' }
  }
  if (!Number.isFinite(maxGroupSize) || maxGroupSize < minGroupSize) {
    return { error: 'Maximum group size must be greater than or equal to the minimum' }
  }

  const pricePerPerson = Number(body?.pricePerPerson ?? 0)
  if (!Number.isFinite(pricePerPerson) || pricePerPerson < 0) {
    return { error: 'Price must be a positive number' }
  }

  const difficulty = String(body?.difficulty ?? '').trim() || null
  if (difficulty && !DIFFICULTIES.includes(difficulty)) {
    return { error: 'Difficulty must be easy, moderate, challenging or strenuous' }
  }

  const startDate = String(body?.startDate ?? '').trim() || null
  const endDate = String(body?.endDate ?? '').trim() || null
  const bookingDeadline = String(body?.bookingDeadline ?? '').trim() || null
  if (startDate && endDate && endDate < startDate) {
    return { error: 'The end date cannot be before the start date' }
  }
  if (startDate && bookingDeadline && bookingDeadline > startDate) {
    return { error: 'The booking deadline cannot be after the start date' }
  }

  const itinerary = Array.isArray(body?.itinerary)
    ? body.itinerary
        .map((day) => ({
          title: String(day?.title ?? '').trim(),
          description: String(day?.description ?? '').trim(),
        }))
        .filter((day) => day.title)
    : []

  return {
    values: {
      title,
      destination,
      category,
      description,
      cover_image: String(body?.coverImage ?? '').trim() || null,
      duration_days: body?.durationDays ? Number(body.durationDays) : itinerary.length || null,
      meeting_point: String(body?.meetingPoint ?? '').trim() || null,
      min_group_size: minGroupSize,
      max_group_size: maxGroupSize,
      price_per_person: pricePerPerson,
      currency: String(body?.currency ?? 'USD').trim() || 'USD',
      difficulty,
      languages: JSON.stringify(asList(body?.languages)),
      included: JSON.stringify(asList(body?.included)),
      excluded: JSON.stringify(asList(body?.excluded)),
      highlights: JSON.stringify(asList(body?.highlights)),
      start_date: startDate,
      end_date: endDate,
      booking_deadline: bookingDeadline,
      // Instant Book is retired: every booking waits for payment and the guide's approval.
      instant_book: 0,
    },
    itinerary,
  }
}

/** A start date that is set (or being changed) must be after today. */
function startDateProblem(startDate, previousStart = null) {
  if (!startDate || startDate === previousStart) return null
  return startDate <= new Date().toISOString().slice(0, 10) ? 'The start date must be in the future' : null
}

function replaceItinerary(tripId, itinerary) {
  db.prepare('DELETE FROM trip_itinerary_days WHERE trip_id = ?').run(tripId)
  const insert = db.prepare(
    'INSERT INTO trip_itinerary_days (trip_id, day_number, title, description) VALUES (?, ?, ?, ?)',
  )
  itinerary.forEach((day, index) => insert.run(tripId, index + 1, day.title, day.description))
}

/** Doc §6 step 2: discovery feed with the traveler-facing search filters. */
router.get('/', optionalAuth, (req, res) => {
  const { q, category, difficulty, language, minPrice, maxPrice, minRating, groupSize, withinDays } =
    req.query

  // Trips that have already started are no longer worth showing in the feed.
  const clauses = [
    `t.status IN (${DISCOVERABLE.map(() => '?').join(', ')})`,
    "(t.start_date IS NULL OR t.start_date > date('now'))",
  ]
  const params = [...DISCOVERABLE]

  if (q) {
    clauses.push('(t.title LIKE ? OR t.destination LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  if (category) {
    clauses.push('t.category = ?')
    params.push(category)
  }
  if (difficulty) {
    clauses.push('t.difficulty = ?')
    params.push(difficulty)
  }
  if (language) {
    clauses.push('t.languages LIKE ?')
    params.push(`%"${language}"%`)
  }
  if (minPrice) {
    clauses.push('t.price_per_person >= ?')
    params.push(Number(minPrice))
  }
  if (maxPrice) {
    clauses.push('t.price_per_person <= ?')
    params.push(Number(maxPrice))
  }
  if (minRating) {
    clauses.push('t.rating >= ?')
    params.push(Number(minRating))
  }
  // "When": trips starting within the next N days.
  if (Number(withinDays) > 0) {
    clauses.push("t.start_date IS NOT NULL AND t.start_date <= date('now', ?)")
    params.push(`+${Math.floor(Number(withinDays))} days`)
  }
  if (groupSize) {
    clauses.push('t.min_group_size <= ? AND t.max_group_size >= ?')
    params.push(Number(groupSize), Number(groupSize))
  }

  const rows = db
    .prepare(`${TRIP_QUERY} WHERE ${clauses.join(' AND ')} ORDER BY t.rating DESC, t.id DESC`)
    .all(...params)

  res.json({ trips: rows.map((row) => mapTrip(row)) })
})

/** A guide's own listings, across every status including drafts. */
router.get('/mine', authenticate, (req, res) => {
  const rows = db
    .prepare(`${TRIP_QUERY} WHERE t.guide_id = ? ORDER BY t.updated_at DESC`)
    .all(req.user.id)

  res.json({ trips: rows.map((row) => mapTrip(row)) })
})

router.get('/:id', optionalAuth, (req, res) => {
  const row = db.prepare(`${TRIP_QUERY} WHERE t.id = ?`).get(Number(req.params.id))
  if (!row) return res.status(404).json({ error: 'Trip not found' })

  const isOwner = req.user?.id === row.guide_id
  const isAdmin = req.user?.role === 'admin'
  if (!DISCOVERABLE.includes(row.status) && !isOwner && !isAdmin) {
    return res.status(404).json({ error: 'Trip not found' })
  }

  res.json({ trip: mapTrip(row, loadItinerary(row.id)) })
})

/** Doc §5 step 1: only a verified guide can create a listing. */
router.post('/', authenticate, requireVerifiedGuide, (req, res) => {
  const parsed = validateTripInput(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })

  const pastStart = startDateProblem(parsed.values.start_date)
  if (pastStart) return res.status(400).json({ error: pastStart })

  const status = req.body?.status === 'published' ? 'published' : 'draft'
  const values = parsed.values

  const tripId = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO trips (guide_id, title, destination, category, description, status, cover_image,
                            duration_days, meeting_point, min_group_size, max_group_size,
                            price_per_person, currency, difficulty, languages, included, excluded,
                            highlights, start_date, end_date, booking_deadline, instant_book)
         VALUES (@guide_id, @title, @destination, @category, @description, @status, @cover_image,
                 @duration_days, @meeting_point, @min_group_size, @max_group_size,
                 @price_per_person, @currency, @difficulty, @languages, @included, @excluded,
                 @highlights, @start_date, @end_date, @booking_deadline, @instant_book)`,
      )
      .run({ ...values, guide_id: req.user.id, status })

    replaceItinerary(result.lastInsertRowid, parsed.itinerary)
    return result.lastInsertRowid
  })()

  const row = db.prepare(`${TRIP_QUERY} WHERE t.id = ?`).get(tripId)
  res.status(201).json({ trip: mapTrip(row, loadItinerary(tripId)) })
})

/** Doc §5 step 9: guides edit their own future trips. */
router.patch('/:id', authenticate, requireVerifiedGuide, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(Number(req.params.id))
  if (!trip) return res.status(404).json({ error: 'Trip not found' })
  if (trip.guide_id !== req.user.id) return res.status(403).json({ error: 'This is not your trip' })
  if (['ongoing', 'completed', 'archived', 'cancelled'].includes(trip.status)) {
    return res.status(409).json({ error: `A ${trip.status.replace('_', ' ')} trip can no longer be edited` })
  }

  const parsed = validateTripInput({ ...mapTrip(trip), ...req.body })
  if (parsed.error) return res.status(400).json({ error: parsed.error })
  const pastStart = startDateProblem(parsed.values.start_date, trip.start_date)
  if (pastStart) return res.status(400).json({ error: pastStart })

  const booked = db
    .prepare(
      `SELECT COALESCE(SUM(travelers), 0) AS n FROM bookings
        WHERE trip_id = ? AND status IN ('pending', 'confirmed', 'completed')`,
    )
    .get(trip.id).n
  if (parsed.values.max_group_size < booked) {
    return res.status(409).json({
      error: `${booked} seats are already booked, so the group size can't go below that`,
    })
  }

  db.transaction(() => {
    db.prepare(
      `UPDATE trips
          SET title = @title, destination = @destination, category = @category,
              description = @description, cover_image = @cover_image, duration_days = @duration_days,
              meeting_point = @meeting_point, min_group_size = @min_group_size,
              max_group_size = @max_group_size, price_per_person = @price_per_person,
              currency = @currency, difficulty = @difficulty, languages = @languages,
              included = @included, excluded = @excluded, highlights = @highlights,
              start_date = @start_date, end_date = @end_date, booking_deadline = @booking_deadline,
              instant_book = @instant_book, updated_at = datetime('now')
        WHERE id = @id`,
    ).run({ ...parsed.values, id: trip.id })

    if (Array.isArray(req.body?.itinerary)) replaceItinerary(trip.id, parsed.itinerary)
  })()

  const row = db.prepare(`${TRIP_QUERY} WHERE t.id = ?`).get(trip.id)
  res.json({ trip: mapTrip(row, loadItinerary(trip.id)) })
})

/** Doc §7: move a trip along the lifecycle. */
router.post('/:id/status', authenticate, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(Number(req.params.id))
  if (!trip) return res.status(404).json({ error: 'Trip not found' })
  if (trip.guide_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'This is not your trip' })
  }

  const next = String(req.body?.status ?? '')
  const allowed = TRANSITIONS[trip.status] ?? []
  if (!allowed.includes(next)) {
    return res.status(409).json({
      error: `A ${trip.status.replace('_', ' ')} trip cannot move to ${next.replace('_', ' ')}`,
      allowed,
    })
  }
  // Checked against the trip's guide, not the caller: a suspended guide's trips
  // must not go back on sale, and an admin may publish a verified guide's draft.
  if (['published', 'booking_open'].includes(next)) {
    const owner = db
      .prepare('SELECT guide_status, subscription_until FROM users WHERE id = ?')
      .get(trip.guide_id)
    if (owner?.guide_status !== 'verified') {
      return res.status(403).json({ error: 'Only verified guides can publish or open bookings' })
    }
    if (!subscriptionActive(owner)) {
      return res.status(403).json({ error: 'The guide’s yearly subscription has expired' })
    }
  }

  const reason = next === 'cancelled' ? String(req.body?.reason ?? '').trim() || null : null
  db.transaction(() => {
    db.prepare(
      "UPDATE trips SET status = ?, cancellation_reason = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(next, reason, trip.id)

    // Bookings follow the trip: cancelling releases everyone, and completing
    // turns confirmed seats into attended trips.
    if (next === 'cancelled') {
      db.prepare(
        `UPDATE bookings SET status = 'cancelled', cancelled_by = 'trip', guide_note = ?
          WHERE trip_id = ? AND status IN ('pending', 'confirmed')`,
      ).run(reason ? `Trip cancelled: ${reason}` : 'The trip was cancelled', trip.id)
    } else if (next === 'completed') {
      db.prepare(
        `UPDATE bookings SET status = 'completed', completed_at = datetime('now')
          WHERE trip_id = ? AND status = 'confirmed'`,
      ).run(trip.id)
      db.prepare(
        `UPDATE bookings SET status = 'cancelled', cancelled_by = 'trip',
                guide_note = 'The trip ended before this request was approved'
          WHERE trip_id = ? AND status = 'pending'`,
      ).run(trip.id)
    }
  })()

  const row = db.prepare(`${TRIP_QUERY} WHERE t.id = ?`).get(trip.id)
  res.json({ trip: mapTrip(row, loadItinerary(trip.id)) })
})

/** Doc §5 step 9: duplicate a past trip to relist it. */
router.post('/:id/duplicate', authenticate, requireVerifiedGuide, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(Number(req.params.id))
  if (!trip) return res.status(404).json({ error: 'Trip not found' })
  if (trip.guide_id !== req.user.id) return res.status(403).json({ error: 'This is not your trip' })

  const newId = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO trips (guide_id, title, destination, category, description, status, cover_image,
                            duration_days, meeting_point, min_group_size, max_group_size,
                            price_per_person, currency, difficulty, languages, included, excluded,
                            highlights, instant_book)
         SELECT guide_id, title || ' (copy)', destination, category, description, 'draft', cover_image,
                duration_days, meeting_point, min_group_size, max_group_size,
                price_per_person, currency, difficulty, languages, included, excluded,
                highlights, instant_book
           FROM trips WHERE id = ?`,
      )
      .run(trip.id)

    db.prepare(
      `INSERT INTO trip_itinerary_days (trip_id, day_number, title, description)
       SELECT ?, day_number, title, description FROM trip_itinerary_days WHERE trip_id = ?`,
    ).run(result.lastInsertRowid, trip.id)

    return result.lastInsertRowid
  })()

  const row = db.prepare(`${TRIP_QUERY} WHERE t.id = ?`).get(newId)
  res.status(201).json({ trip: mapTrip(row, loadItinerary(newId)) })
})

router.delete('/:id', authenticate, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(Number(req.params.id))
  if (!trip) return res.status(404).json({ error: 'Trip not found' })
  if (trip.guide_id !== req.user.id) return res.status(403).json({ error: 'This is not your trip' })
  if (trip.status !== 'draft') {
    return res.status(409).json({ error: 'Only a draft can be deleted — cancel the trip instead' })
  }

  db.prepare('DELETE FROM trips WHERE id = ?').run(trip.id)
  res.json({ ok: true })
})

export default router
