import { Router } from 'express'
import { db } from '../db.js'
import { authenticate } from '../auth.js'
import { TRIP_QUERY, mapTrip } from './trips.js'
import { getSettings } from '../settings.js'

const router = Router()

const GENDERS = ['female', 'male', 'other', 'prefer_not_to_say']

function round2(value) {
  return Math.round(value * 100) / 100
}

/**
 * Doc §8.3: base price, service fee and taxes. Always computed here — never
 * taken from the client — using the rates the admin has configured.
 */
function priceBooking(pricePerPerson, travelers) {
  const { service_fee_rate: feeRate, tax_rate: taxRate } = getSettings()
  const base = round2(pricePerPerson * travelers)
  const serviceFee = round2(base * feeRate)
  const tax = round2((base + serviceFee) * taxRate)
  return { base, serviceFee, tax, total: round2(base + serviceFee + tax) }
}

function loadTravelers(bookingId) {
  return db
    .prepare(
      `SELECT is_lead, name, age, gender, phone, email
         FROM booking_travelers WHERE booking_id = ? ORDER BY is_lead DESC, id`,
    )
    .all(bookingId)
    .map((row) => ({
      lead: Boolean(row.is_lead),
      name: row.name,
      age: row.age,
      gender: row.gender,
      phone: row.phone,
      email: row.email,
    }))
}

function mapBooking(row, travelers) {
  return {
    id: row.booking_id,
    status: row.booking_status,
    travelers: row.travelers,
    totalPaid: row.total_paid,
    serviceFee: row.service_fee,
    tax: row.tax,
    notes: row.notes,
    guideNote: row.guide_note,
    bookedAt: row.booked_at,
    completedAt: row.completed_at,
    bookedBy: row.booker_name
      ? { id: row.booker_id, name: row.booker_name, email: row.booker_email }
      : undefined,
    party: travelers,
    trip: mapTrip(row),
  }
}

const BOOKING_SELECT = `
  SELECT b.id AS booking_id, b.status AS booking_status, b.travelers, b.total_paid,
         b.service_fee, b.tax, b.notes, b.guide_note, b.booked_at, b.completed_at,
         bu.id AS booker_id, bu.name AS booker_name, bu.email AS booker_email,
         sub.*
    FROM bookings b
    JOIN users bu ON bu.id = b.user_id
    JOIN (${TRIP_QUERY}) sub ON sub.id = b.trip_id
`

/**
 * Doc §6: the traveler's own trips — the ones they booked and attended, which
 * is a different list from the listings a guide publishes.
 */
router.get('/mine', authenticate, (req, res) => {
  const rows = db
    .prepare(`${BOOKING_SELECT} WHERE b.user_id = ? ORDER BY COALESCE(b.completed_at, b.booked_at) DESC`)
    .all(req.user.id)

  res.json({ bookings: rows.map((row) => mapBooking(row, loadTravelers(row.booking_id))) })
})

/**
 * Doc §5 step 5: the guide's roster for one of their own trips — who applied,
 * who is confirmed, and how the party is made up.
 */
router.get('/trip/:tripId', authenticate, (req, res) => {
  const trip = db.prepare('SELECT id, guide_id FROM trips WHERE id = ?').get(Number(req.params.tripId))
  if (!trip) return res.status(404).json({ error: 'Trip not found' })
  if (trip.guide_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'This is not your trip' })
  }

  const rows = db
    .prepare(`${BOOKING_SELECT} WHERE b.trip_id = ? ORDER BY b.booked_at ASC`)
    .all(trip.id)

  res.json({ bookings: rows.map((row) => mapBooking(row, loadTravelers(row.booking_id))) })
})

/** Every booking still awaiting this guide's approval, across all their trips. */
router.get('/requests', authenticate, (req, res) => {
  const rows = db
    .prepare(
      `${BOOKING_SELECT}
        WHERE b.status = 'pending' AND sub.guide_id = ?
        ORDER BY b.booked_at ASC`,
    )
    .all(req.user.id)

  res.json({ bookings: rows.map((row) => mapBooking(row, loadTravelers(row.booking_id))) })
})

/** Guards an approve/decline: the booking must exist and be on the caller's trip. */
function loadForGuide(bookingId, user) {
  const row = db
    .prepare(
      `SELECT b.*, t.guide_id, t.max_group_size
         FROM bookings b JOIN trips t ON t.id = b.trip_id
        WHERE b.id = ?`,
    )
    .get(bookingId)

  if (!row) return { error: 'Booking not found', code: 404 }
  if (row.guide_id !== user.id && user.role !== 'admin') {
    return { error: 'This is not your trip', code: 403 }
  }
  return { row }
}

function respondWithBooking(res, bookingId, status) {
  const row = db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(bookingId)
  res.status(status).json({ booking: mapBooking(row, loadTravelers(bookingId)) })
}

/** Doc §5 step 5 / §6 step 6: the guide approves a pending booking request. */
router.post('/:id/approve', authenticate, (req, res) => {
  const { row, error, code } = loadForGuide(Number(req.params.id), req.user)
  if (error) return res.status(code).json({ error })

  if (row.status !== 'pending') {
    return res.status(409).json({ error: `This booking is already ${row.status}` })
  }

  db.prepare(
    "UPDATE bookings SET status = 'confirmed', guide_note = ? WHERE id = ?",
  ).run(String(req.body?.note ?? '').trim() || null, row.id)

  respondWithBooking(res, row.id, 200)
})

/** Declining frees the seats back into the trip's capacity. */
router.post('/:id/decline', authenticate, (req, res) => {
  const { row, error, code } = loadForGuide(Number(req.params.id), req.user)
  if (error) return res.status(code).json({ error })

  if (!['pending', 'confirmed'].includes(row.status)) {
    return res.status(409).json({ error: `This booking is already ${row.status}` })
  }

  const note = String(req.body?.note ?? '').trim()
  if (!note) return res.status(400).json({ error: 'Give the traveller a reason' })

  db.prepare("UPDATE bookings SET status = 'cancelled', guide_note = ? WHERE id = ?").run(note, row.id)

  respondWithBooking(res, row.id, 200)
})

/** Live price breakdown so the form never shows a total the server won't charge. */
router.get('/quote', authenticate, (req, res) => {
  const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(Number(req.query.trip))
  if (!trip) return res.status(404).json({ error: 'Trip not found' })

  const travelers = Number(req.query.travelers)
  if (!Number.isInteger(travelers) || travelers < 1) {
    return res.status(400).json({ error: 'Choose at least one traveler' })
  }

  res.json({ quote: { ...priceBooking(trip.price_per_person, travelers), currency: trip.currency } })
})

/** Doc §6 step 5 / §8.3: place a booking for one or more travelers. */
router.post('/', authenticate, (req, res) => {
  if (!getSettings().bookings_enabled) {
    return res.status(403).json({ error: 'Bookings are temporarily paused, please try again later' })
  }

  const trip = db.prepare(`${TRIP_QUERY} WHERE t.id = ?`).get(Number(req.body?.tripId))
  if (!trip) return res.status(404).json({ error: 'Trip not found' })

  if (trip.guide_id === req.user.id) {
    return res.status(409).json({ error: 'You cannot book your own trip' })
  }
  if (trip.status !== 'booking_open') {
    return res.status(409).json({ error: 'This trip is not open for bookings' })
  }

  const existing = db
    .prepare("SELECT id FROM bookings WHERE trip_id = ? AND user_id = ? AND status != 'cancelled'")
    .get(trip.id, req.user.id)
  if (existing) return res.status(409).json({ error: 'You have already booked this trip' })

  const party = Array.isArray(req.body?.party) ? req.body.party : []
  const travelers = party.length

  if (travelers < 1) return res.status(400).json({ error: 'Add at least one traveler' })

  const seatsLeft = Math.max(0, trip.max_group_size - (trip.booked_seats ?? 0))
  if (travelers > seatsLeft) {
    return res.status(409).json({
      error:
        seatsLeft === 0
          ? 'This trip is fully booked'
          : `Only ${seatsLeft} ${seatsLeft === 1 ? 'seat is' : 'seats are'} left on this trip`,
    })
  }

  const cleaned = []
  for (const [index, person] of party.entries()) {
    const name = String(person?.name ?? '').trim()
    if (!name) return res.status(400).json({ error: `Enter a name for traveler ${index + 1}` })

    const age = person?.age === '' || person?.age == null ? null : Number(person.age)
    if (age !== null && (!Number.isFinite(age) || age < 0 || age > 120)) {
      return res.status(400).json({ error: `Enter a valid age for ${name}` })
    }

    const gender = String(person?.gender ?? '').trim() || null
    if (gender && !GENDERS.includes(gender)) {
      return res.status(400).json({ error: `Select a valid gender for ${name}` })
    }

    // Only the lead traveler is asked for contact details (doc §8.3 — one
    // point of contact per booking).
    const lead = index === 0
    const phone = lead ? String(person?.phone ?? '').trim() : null
    const email = lead ? String(person?.email ?? '').trim().toLowerCase() : null

    if (lead && !phone) return res.status(400).json({ error: 'A contact phone number is required' })
    if (lead && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '')) {
      return res.status(400).json({ error: 'Enter a valid contact email address' })
    }

    cleaned.push({ lead, name, age, gender, phone, email })
  }

  const price = priceBooking(trip.price_per_person, travelers)
  // Doc §6 step 6: Instant Book confirms straight away, otherwise the guide approves.
  const status = trip.instant_book ? 'confirmed' : 'pending'

  const bookingId = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO bookings (trip_id, user_id, travelers, status, total_paid, service_fee, tax, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trip.id,
        req.user.id,
        travelers,
        status,
        price.total,
        price.serviceFee,
        price.tax,
        String(req.body?.notes ?? '').trim() || null,
      )

    const insertTraveler = db.prepare(
      `INSERT INTO booking_travelers (booking_id, is_lead, name, age, gender, phone, email)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const person of cleaned) {
      insertTraveler.run(
        result.lastInsertRowid,
        person.lead ? 1 : 0,
        person.name,
        person.age,
        person.gender,
        person.phone,
        person.email,
      )
    }

    return result.lastInsertRowid
  })()

  const row = db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(bookingId)
  res.status(201).json({ booking: mapBooking(row, loadTravelers(bookingId)), quote: price })
})

export default router
