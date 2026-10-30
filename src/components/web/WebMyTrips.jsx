import { useCallback, useEffect, useState } from 'react'
import { api, downloadTicket } from '../../api/client.js'
import { cancelBookingWithConfirm } from '../cancelBooking.js'
import { beforeTripStarts, formatDateRange, timeAgo, tripCountdown } from '../../data/dates.js'
import { useNow } from '../../hooks/useNow.js'
import { BOOKING_STATUS } from '../../data/categories.js'
import { TripCover, formatMoney } from '../TripDetail.jsx'
import WebTripCard from './WebTripCard.jsx'

const GROUPS = [
  { title: 'Upcoming', statuses: ['pending', 'confirmed'] },
  { title: 'Attended', statuses: ['completed'] },
  { title: 'Cancelled', statuses: ['cancelled'] },
]

export default function WebMyTrips() {
  const [bookings, setBookings] = useState(null)
  const [error, setError] = useState('')

  const [saved, setSaved] = useState([])

  const load = useCallback(() => {
    api
      .myBookings()
      .then(({ bookings: rows }) => setBookings(rows))
      .catch((err) => setError(err.message))
    api
      .wishlist()
      .then(({ trips }) => setSaved(trips))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="web-container web-section">
      <h1 className="web-page-title">My trips</h1>
      {error && <p className="form-error">{error}</p>}
      {!bookings && !error && <p className="web-faint">Loading your trips…</p>}

      {bookings?.length === 0 && (
        <div className="web-empty">
          <p>You haven’t booked a trip yet.</p>
          <a href="#/" className="web-btn">
            Explore trips
          </a>
        </div>
      )}

      {bookings &&
        GROUPS.map(({ title, statuses }) => {
          const rows = bookings.filter((b) => statuses.includes(b.status))
          if (rows.length === 0) return null
          return (
            <section key={title} className="web-block">
              <h2>
                {title} <span className="web-faint">{rows.length}</span>
              </h2>
              <div className="web-booking-list">
                {rows.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} onChanged={load} />
                ))}
              </div>
            </section>
          )
        })}

      <section className="web-block">
        <h2>
          Saved <span className="web-faint">{saved.length}</span>
        </h2>
        {saved.length === 0 ? (
          <p className="web-faint">Tap Save on any trip page to keep it here for later.</p>
        ) : (
          <div className="web-grid">
            {saved.map((trip) => (
              <WebTripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const PAYMENT_HINT = {
  unpaid: 'Pay the guide using the details in Messages, then send them a screenshot.',
  proof_sent: 'Payment screenshot sent — the guide is checking it.',
}

function BookingRow({ booking, onChanged }) {
  const { trip } = booking
  const status = BOOKING_STATUS[booking.status]
  const [error, setError] = useState('')
  const now = useNow()
  const hasTicket = booking.status === 'confirmed' || booking.status === 'completed'
  const live = booking.status === 'pending' || booking.status === 'confirmed'
  const canCancel = live && beforeTripStarts(trip, now)
  return (
    <div className="web-booking">
      <TripCover trip={trip} className="web-booking-img" alt="" />
      <div className="web-booking-info">
        <p className="web-card-place">{trip.destination}</p>
        <h3>
          <a href={`#/trips/${trip.id}`}>{trip.title}</a>
        </h3>
        {booking.status === 'pending' && PAYMENT_HINT[booking.paymentStatus] && (
          <p className="web-booking-note">{PAYMENT_HINT[booking.paymentStatus]}</p>
        )}
        {error && <p className="form-error">{error}</p>}
        <p className="web-faint">
          {[
            formatDateRange(trip.startDate, trip.endDate),
            live && tripCountdown(trip, now),
            `${booking.travelers} ${booking.travelers === 1 ? 'traveller' : 'travellers'}`,
            `Booked ${timeAgo(booking.bookedAt, now)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {booking.guideNote && <p className="web-booking-note">Guide: {booking.guideNote}</p>}
      </div>
      <div className="web-booking-side">
        <span className={`status-pill status-tone-${status.tone}`}>{status.label}</span>
        <strong>{formatMoney(booking.totalPaid, trip.currency)}</strong>
        {hasTicket && (
          <button
            type="button"
            className="web-btn-ghost"
            onClick={() => downloadTicket(booking.id).catch((err) => setError(err.message))}
          >
            Download ticket
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            className="web-link web-danger-link"
            onClick={() =>
              cancelBookingWithConfirm(booking, trip.title)
                .then((updated) => updated && onChanged())
                .catch((err) => setError(err.message))
            }
          >
            {booking.status === 'pending' ? 'Cancel request' : 'Cancel booking'}
          </button>
        )}
      </div>
    </div>
  )
}
