import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { CATEGORY_ICON, TRIP_STATUS } from '../data/categories.js'
import { ChevronLeftIcon, MountainsIcon, StarIcon, VerifiedIcon } from './icons.jsx'

export function TripThumbImage({ trip }) {
  const Icon = CATEGORY_ICON[trip.category] ?? MountainsIcon
  if (!trip.coverImage) return <Icon />
  return <img className="trip-thumb-img" src={trip.coverImage} alt={trip.title} loading="lazy" />
}

export function RatingBadge({ rating, badge }) {
  const isNew = !rating || rating <= 0
  const className = `rating-pill${badge ? ' rating-pill-badge' : ''}${isNew ? ' rating-pill-new' : ''}`
  return (
    <span className={className}>
      {isNew ? (
        'New'
      ) : (
        <>
          <StarIcon />
          {rating.toFixed(1)}
        </>
      )}
    </span>
  )
}

export function StatusPill({ status }) {
  const config = TRIP_STATUS[status]
  if (!config) return null
  return <span className={`status-pill status-tone-${config.tone}`}>{config.label}</span>
}

export function formatMoney(amount, currency = 'USD') {
  const value = Number(amount ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return currency === 'USD' ? `$${value}` : `${currency} ${value}`
}

export function formatPrice(trip) {
  if (!trip.pricePerPerson) return 'Free'
  return `${formatMoney(trip.pricePerPerson, trip.currency)} per person`
}

export default function TripDetail({ trip: summary, user, booking, onClose, onApply, showStatus }) {
  const [trip, setTrip] = useState(summary)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getTrip(summary.id)
      .then(({ trip: full }) => setTrip(full))
      .catch((err) => setError(err.message))
  }, [summary.id])

  const stats = [
    trip.durationDays && { label: 'Duration', value: `${trip.durationDays} days` },
    { label: 'Group size', value: `${trip.minGroupSize}–${trip.maxGroupSize}` },
    { label: 'Price', value: formatPrice(trip) },
    trip.difficulty && { label: 'Difficulty', value: trip.difficulty },
  ].filter(Boolean)

  return (
    <div className={`edit-overlay${user && onApply ? ' has-apply-bar' : ''}`}>
      <header className="edit-header">
        <button type="button" className="edit-icon-btn" onClick={onClose} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <h2 className="edit-header-title">Trip details</h2>
        <span className="edit-header-spacer" />
      </header>

      <div className="edit-body">
        <div className="trip-detail-hero">
          <TripThumbImage trip={trip} />
          <RatingBadge rating={trip.rating} badge />
        </div>

        <h1 className="trip-detail-title">{trip.title}</h1>
        <p className="trip-detail-location">{trip.destination}</p>

        <div className="trip-detail-tags">
          <span className="chip chip-static">{trip.category}</span>
          {trip.instantBook && <span className="chip chip-static chip-accent">Instant Book</span>}
          {showStatus && <StatusPill status={trip.status} />}
        </div>

        {trip.status === 'cancelled' && trip.cancellationReason && (
          <p className="form-error">Cancelled: {trip.cancellationReason}</p>
        )}
        {error && <p className="form-error">{error}</p>}

        <div className="trip-detail-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="trip-detail-stat">
              <p className="trip-detail-stat-label">{stat.label}</p>
              <p className="trip-detail-stat-value">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="trip-detail-author">
          <span className="profile-avatar trip-detail-avatar">{getInitials(trip.guide.name)}</span>
          <div>
            <p className="trip-detail-author-name">
              {trip.guide.name}
              {trip.guide.verified && (
                <span className="verified-badge" title="Verified guide">
                  <VerifiedIcon />
                </span>
              )}
            </p>
            <p className="trip-detail-author-label">
              {trip.guide.verified ? 'Verified guide' : 'Guide'}
              {trip.guide.certified && ' · Certified'}
              {trip.reviewCount > 0 && ` · ${trip.reviewCount} reviews`}
            </p>
          </div>
        </div>

        {trip.guide.bio && <p className="guide-bio">{trip.guide.bio}</p>}

        {trip.description && (
          <div className="trip-detail-description">
            <span className="field-label">About this trip</span>
            <p>{trip.description}</p>
          </div>
        )}

        {trip.itinerary?.length > 0 && (
          <div className="trip-detail-description">
            <span className="field-label">Day-by-day itinerary</span>
            <ol className="itinerary-list">
              {trip.itinerary.map((day) => (
                <li key={day.day}>
                  <span className="itinerary-day-badge">Day {day.day}</span>
                  <div>
                    <p className="itinerary-title">{day.title}</p>
                    {day.description && <p className="itinerary-text">{day.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {trip.meetingPoint && (
          <div className="trip-detail-description">
            <span className="field-label">Meeting point</span>
            <p>{trip.meetingPoint}</p>
          </div>
        )}

        {trip.languages?.length > 0 && (
          <div className="trip-detail-description">
            <span className="field-label">Languages offered</span>
            <div className="chip-group">
              {trip.languages.map((language) => (
                <span key={language} className="chip chip-static">
                  {language}
                </span>
              ))}
            </div>
          </div>
        )}

        {trip.highlights?.length > 0 && (
          <div className="trip-detail-highlights">
            <span className="field-label">Highlights</span>
            <ul>
              {trip.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {trip.included?.length > 0 && (
          <div className="trip-detail-highlights">
            <span className="field-label">Included</span>
            <ul className="list-included">
              {trip.included.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {trip.excluded?.length > 0 && (
          <div className="trip-detail-highlights">
            <span className="field-label">Not included</span>
            <ul className="list-excluded">
              {trip.excluded.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {trip.bookingDeadline && (
          <p className="field-hint deadline-note">Bookings close on {trip.bookingDeadline}.</p>
        )}
      </div>

      <ApplyBar trip={trip} user={user} booking={booking} onApply={onApply} />
    </div>
  )
}

/**
 * Floating action bar that mirrors the bottom nav's pill styling and sits in
 * the same place, since the detail overlay covers the nav itself.
 */
function ApplyBar({ trip, user, booking, onApply }) {
  if (!user || !onApply) return null

  const isOwnTrip = trip.guide?.id === user.id
  const soldOut = trip.seatsLeft === 0
  const open = trip.status === 'booking_open'

  let label = 'Apply'
  let disabled = false
  let note = `${trip.seatsLeft ?? trip.maxGroupSize} ${trip.seatsLeft === 1 ? 'seat' : 'seats'} left`

  if (isOwnTrip) {
    label = 'Your trip'
    disabled = true
    note = `${trip.bookedSeats ?? 0} of ${trip.maxGroupSize} booked`
  } else if (booking) {
    label = booking.status === 'pending' ? 'Requested' : 'Booked'
    disabled = true
    note = `${booking.travelers} ${booking.travelers === 1 ? 'traveller' : 'travellers'}`
  } else if (!open) {
    label = 'Bookings closed'
    disabled = true
    note = TRIP_STATUS[trip.status]?.label ?? ''
  } else if (soldOut) {
    label = 'Fully booked'
    disabled = true
    note = 'No seats left'
  }

  return (
    <div className="apply-bar">
      <div className="apply-price">
        <span className="apply-amount">{formatMoney(trip.pricePerPerson, trip.currency)}</span>
        <span className="apply-note">{note}</span>
      </div>
      <button
        type="button"
        className="apply-btn"
        onClick={() => onApply(trip)}
        disabled={disabled}
      >
        {label}
      </button>
    </div>
  )
}

export function getInitials(name) {
  if (!name) return '?'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
