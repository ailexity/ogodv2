import { Router } from 'express'
import { db } from '../db.js'
import { authenticate } from '../auth.js'
import { TRIP_QUERY, mapTrip } from './trips.js'

const router = Router()

router.use(authenticate)

/** The signed-in person's saved trips, most recently saved first. */
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `${TRIP_QUERY}
        JOIN wishlist w ON w.trip_id = t.id
       WHERE w.user_id = ? AND t.status != 'draft'
       ORDER BY w.created_at DESC, w.rowid DESC`,
    )
    .all(req.user.id)

  res.json({ trips: rows.map((row) => mapTrip(row)) })
})

router.post('/:tripId', (req, res) => {
  const trip = db.prepare('SELECT id, status FROM trips WHERE id = ?').get(Number(req.params.tripId))
  if (!trip || trip.status === 'draft') return res.status(404).json({ error: 'Trip not found' })

  db.prepare('INSERT OR IGNORE INTO wishlist (user_id, trip_id) VALUES (?, ?)').run(req.user.id, trip.id)
  res.status(201).json({ saved: true })
})

router.delete('/:tripId', (req, res) => {
  db.prepare('DELETE FROM wishlist WHERE user_id = ? AND trip_id = ?').run(
    req.user.id,
    Number(req.params.tripId),
  )
  res.json({ saved: false })
})

export default router
