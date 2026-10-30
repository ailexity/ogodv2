import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { BOOKING_STATUS } from '../../data/categories.js'
import { RatingBadge, TripCover, formatMoney, getInitials } from '../TripDetail.jsx'
import { CheckIcon, ChevronLeftIcon, CloseIcon, HeartIcon, MessageIcon, VerifiedIcon } from '../icons.jsx'
import PriceSummary, { useQuote } from './PriceSummary.jsx'
import { formatDays, navigate } from './route.js'
import { cancelBookingWithConfirm } from '../cancelBooking.js'
import {
  beforeTripStarts,
  canBookNow,
  deadlineCountdown,
  formatDate,
  formatDateRange,
  tripCountdown,
} from '../../data/dates.js'
import { useNow } from '../../hooks/useNow.js'

export default function WebTripPage({ tripId, user, onMessageGuide, onSignIn }) {
  const [saved, setSaved] = useState(false)
  const [trip, setTrip] = useState(null)
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState('')

  const [reloadKey, setReloadKey] = useState(0)
  const now = useNow()

  useEffect(() => {
    api
      .getTrip(tripId)
      .then(({ trip: row }) => setTrip(row))
      .catch((err) => setError(err.message))
  }, [tripId, reloadKey])

  useEffect(() => {
    if (!user) return
    api
      .myBookings()
      .then(({ bookings }) =>
        setBooking(bookings.find((b) => b.trip.id === tripId && b.status !== 'cancelled') ?? null),
      )
      .catch(() => setBooking(null))
  }, [tripId, user, reloadKey])

  useEffect(() => {
    if (!user) return setSaved(false)
    api
      .wishlist()
      .then(({ trips }) => setSaved(trips.some((t) => t.id === tripId)))
      .catch(() => {})
  }, [tripId, user])

  async function toggleSave() {
    if (!user) return onSignIn('login')
    const next = !saved
    setSaved(next)
    try {
      if (next) await api.saveTrip(tripId)
      else await api.unsaveTrip(tripId)
    } catch {
      setSaved(!next)
    }
  }

  if (error) {
    return (
      <div className="web-container web-section web-empty">
        <p>{error}</p>
        <a href="#/" className="web-btn-ghost">
          Back to all trips
        </a>
      </div>
    )
  }
  if (!trip) return <div className="web-container web-section web-faint">Loading trip…</div>

  const stats = [
    trip.durationDays && { label: 'Duration', value: formatDays(trip.durationDays) },
    { label: 'Group size', value: `${trip.minGroupSize}–${trip.maxGroupSize} people` },
    trip.difficulty && {
      label: 'Difficulty',
      value: trip.difficulty[0].toUpperCase() + trip.difficulty.slice(1),
    },
    trip.startDate && { label: 'Dates', value: formatDateRange(trip.startDate, trip.endDate) },
  ].filter(Boolean)

  return (
    <div className="web-container web-section">
      <a href="#/" className="web-back">
        <ChevronLeftIcon /> All trips
      </a>

      <header className="web-trip-head">
        <p className="web-card-place">{trip.destination}</p>
        <h1>{trip.title}</h1>
        <div className="web-trip-tags">
          <button
            type="button"
            className={`web-save${saved ? ' web-save-on' : ''}`}
            onClick={toggleSave}
            aria-pressed={saved}
          >
            <HeartIcon filled={saved} />
            {saved ? 'Saved' : 'Save'}
          </button>
          {trip.startDate && <span className="web-countdown">{tripCountdown(trip, now)}</span>}
          <RatingBadge rating={trip.rating} />
          {trip.reviewCount > 0 && <span className="web-faint">{trip.reviewCount} reviews</span>}
          <span className="chip chip-static">{trip.category}</span>

        </div>
      </header>

      <TripCover trip={trip} className="web-trip-cover" alt={trip.title} loading="eager" />

      <div className="web-trip-layout">
        <div className="web-trip-content">
          <div className="web-stats">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="web-stat-label">{stat.label}</p>
                <p className="web-stat-value">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="web-guide">
            <span className="web-avatar web-avatar-lg">{getInitials(trip.guide.name)}</span>
            <div>
              <p className="web-guide-name">
                Hosted by {trip.guide.name}
                {trip.guide.verified && <VerifiedIcon />}
              </p>
              <p className="web-faint">
                {trip.guide.verified ? 'Verified guide' : 'Guide'}
                {trip.guide.certified && ' · Certified'}
              </p>
              {trip.guide.bio && <p className="web-guide-bio">{trip.guide.bio}</p>}
              {trip.guide.verified && trip.guide.id !== user?.id && (
                <button type="button" className="web-btn-ghost web-guide-message" onClick={() => onMessageGuide(trip)}>
                  <MessageIcon />
                  Message {trip.guide.name.split(' ')[0]}
                </button>
              )}
            </div>
          </div>

          {trip.description && (
            <section className="web-block">
              <h2>About this trip</h2>
              <p className="web-prose">{trip.description}</p>
            </section>
          )}

          {trip.highlights?.length > 0 && (
            <section className="web-block">
              <h2>Highlights</h2>
              <ul className="web-checklist">
                {trip.highlights.map((item) => (
                  <li key={item}>
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {trip.itinerary?.length > 0 && (
            <section className="web-block">
              <h2>Itinerary</h2>
              <ol className="web-itinerary">
                {trip.itinerary.map((day) => (
                  <li key={day.day}>
                    <span className="web-itinerary-day">Day {day.day}</span>
                    <div>
                      <h3>{day.title}</h3>
                      {day.description && <p>{day.description}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(trip.included?.length > 0 || trip.excluded?.length > 0) && (
            <section className="web-block web-two-col">
              {trip.included?.length > 0 && (
                <div>
                  <h2>What’s included</h2>
                  <ul className="web-checklist">
                    {trip.included.map((item) => (
                      <li key={item}>
                        <CheckIcon />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {trip.excluded?.length > 0 && (
                <div>
                  <h2>Not included</h2>
                  <ul className="web-checklist web-checklist-muted">
                    {trip.excluded.map((item) => (
                      <li key={item}>
                        <CloseIcon />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {(trip.meetingPoint || trip.languages?.length > 0) && (
            <section className="web-block web-two-col">
              {trip.meetingPoint && (
                <div>
                  <h2>Meeting point</h2>
                  <p className="web-prose">{trip.meetingPoint}</p>
                </div>
              )}
              {trip.languages?.length > 0 && (
                <div>
                  <h2>Languages</h2>
                  <p className="web-prose">{trip.languages.join(', ')}</p>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="web-trip-aside">
          <BookingCard
            trip={trip}
            user={user}
            booking={booking}
            now={now}
            onCancelled={() => setReloadKey((key) => key + 1)}
          />
        </aside>
      </div>
    </div>
  )
}

function BookingCard({ trip, user, booking, now, onCancelled }) {
  const [cancelError, setCancelError] = useState('')
  const seatsLeft = trip.seatsLeft ?? trip.maxGroupSize
  const [travelers, setTravelers] = useState(1)
  const { quote, error } = useQuote(trip.id, travelers)

  const isOwnTrip = user && trip.guide.id === user.id
  const open = canBookNow(trip, now)
  const blocked = isOwnTrip
    ? 'This is your own trip.'
    : booking
      ? null
      : seatsLeft === 0
        ? 'This trip is fully booked.'
        : !open
          ? trip.status === 'published'
            ? 'Bookings for this trip aren’t open yet.'
            : 'Bookings for this trip have closed.'
          : null

  return (
    <div className="web-book-card">
      <p className="web-book-price">
        <strong>{trip.pricePerPerson ? formatMoney(trip.pricePerPerson, trip.currency) : 'Free'}</strong>
        <span> per person</span>
      </p>
      {trip.bookingDeadline && open && (
        <p className="web-faint">
          {deadlineCountdown(trip, now)} · last day {formatDate(trip.bookingDeadline)}
        </p>
      )}

      {booking ? (
        <div className="web-book-done">
          <span className={`status-pill status-tone-${BOOKING_STATUS[booking.status].tone}`}>
            {BOOKING_STATUS[booking.status].label}
          </span>
          <p>
            You’ve booked this trip for {booking.travelers}{' '}
            {booking.travelers === 1 ? 'traveller' : 'travellers'}.
          </p>
          <a href="#/my-trips" className="web-btn web-btn-block">
            View my trips
          </a>
          {beforeTripStarts(trip, now) && (
            <button
              type="button"
              className="web-link web-danger-link"
              onClick={() =>
                cancelBookingWithConfirm(booking, trip.title)
                  .then((updated) => updated && onCancelled())
                  .catch((err) => setCancelError(err.message))
              }
            >
              {booking.status === 'pending' ? 'Cancel request' : 'Cancel booking'}
            </button>
          )}
          {cancelError && <p className="form-error">{cancelError}</p>}
        </div>
      ) : blocked ? (
        <p className="web-book-note">{blocked}</p>
      ) : (
        <>
          <div className="web-stepper-row">
            <span>Travellers</span>
            <div className="web-stepper">
              <button
                type="button"
                onClick={() => setTravelers((n) => Math.max(1, n - 1))}
                disabled={travelers <= 1}
                aria-label="Fewer travellers"
              >
                −
              </button>
              <span aria-live="polite">{travelers}</span>
              <button
                type="button"
                onClick={() => setTravelers((n) => Math.min(seatsLeft, n + 1))}
                disabled={travelers >= seatsLeft}
                aria-label="More travellers"
              >
                +
              </button>
            </div>
          </div>
          <p className="web-faint">
            {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left
          </p>

          <PriceSummary trip={trip} travelers={travelers} quote={quote} error={error} />

          <button
            type="button"
            className="web-btn web-btn-block web-btn-lg"
            onClick={() => navigate(`/trips/${trip.id}/book?n=${travelers}`)}
          >
            Request to book
          </button>
          <p className="web-faint web-center">
            You pay the guide directly. They confirm your seats once they’ve checked the payment.
          </p>
        </>
      )}
    </div>
  )
}
