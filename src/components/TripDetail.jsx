import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { TRIP_STATUS, categoryImage } from '../data/categories.js'
import { ChevronLeftIcon, MessageIcon, StarIcon, VerifiedIcon } from './icons.jsx'
import {
  beforeTripStarts,
  canBookNow,
  deadlineCountdown,
  formatDate,
  formatDateRange,
  tripCountdown,
} from '../data/dates.js'
import { useNow } from '../hooks/useNow.js'

/** A trip's cover photo, falling back to its category's photo when it has none or it fails to load. */
export function TripCover({ trip, className, alt = '', loading = 'lazy' }) {
  const fallback = categoryImage(trip.category)
  const preferred = trip.coverImage || fallback
  const [src, setSrc] = useState(preferred)

  useEffect(() => setSrc(preferred), [preferred])

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => {
        if (src !== fallback) setSrc(fallback)
      }}
    />
  )
}

export function TripThumbImage({ trip }) {
  return <TripCover trip={trip} className="trip-thumb-img" alt={trip.title} />
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

// The cover can stretch to 1.5× its height when pulled, and no further.
const MAX_STRETCH_RATIO = 0.5
const SPRING_BACK_MS = 380
const SPRING_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/** Rubber band: follows the gesture at first, then slows and stops at `max`. */
function rubberBand(distance, max) {
  return max * (1 - 1 / ((distance * 0.55) / max + 1))
}

/**
 * Stretchy cover photo.
 * - At the top, pulling down (touch) or scrolling up (wheel / trackpad) makes
 *   the photo's frame taller, so the trip details move down with it and the
 *   photo zooms to fill the frame. The stretch is capped and springs back on
 *   release. Handled here because most browsers don't bounce past the top.
 * - Scrolling down the page zooms the photo gently as it slides away, with a
 *   little parallax (skipped for "reduce motion").
 */
function useHeroZoom(bodyRef, heroRef) {
  useEffect(() => {
    const body = bodyRef.current
    const hero = heroRef.current
    if (!body || !hero) return undefined
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let baseHeight = 0
    let distance = 0
    let touchStartY = null
    let wheelTimer = 0
    let settleTimer = 0
    let frame = 0

    function setStretch(stretch, animate) {
      clearTimeout(settleTimer)
      if (stretch > 0 && !baseHeight) baseHeight = hero.offsetHeight
      if (!baseHeight) return
      hero.style.transition = animate && !reduceMotion ? `height ${SPRING_BACK_MS}ms ${SPRING_EASE}` : 'none'
      hero.style.height = `${(baseHeight + stretch).toFixed(1)}px`
      if (stretch === 0) {
        // Back at rest: hand the size back to the stylesheet's aspect ratio.
        settleTimer = setTimeout(
          () => {
            hero.style.height = ''
            hero.style.transition = ''
            baseHeight = 0
          },
          animate && !reduceMotion ? SPRING_BACK_MS : 0,
        )
      }
    }

    function pullTo(rawDistance) {
      distance = Math.max(0, rawDistance)
      const max = (baseHeight || hero.offsetHeight) * MAX_STRETCH_RATIO
      setStretch(rubberBand(distance, max), false)
    }

    function release() {
      if (distance === 0 && !baseHeight) return
      distance = 0
      setStretch(0, true)
    }

    function renderScroll() {
      frame = 0
      const image = hero.querySelector('img')
      if (!image) return
      const y = body.scrollTop
      const height = hero.offsetHeight || 1
      if (y > 0 && !reduceMotion) {
        const travel = Math.min(y, height)
        image.style.transform = `translateY(${(travel * 0.4).toFixed(1)}px) scale(${(1 + (travel / height) * 0.3).toFixed(4)})`
      } else {
        image.style.transform = ''
      }
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(renderScroll)
    }

    function onTouchStart(e) {
      touchStartY = body.scrollTop <= 0 ? e.touches[0].clientY : null
    }
    function onTouchMove(e) {
      if (touchStartY === null) return
      const moved = e.touches[0].clientY - touchStartY
      if (moved > 0 && body.scrollTop <= 0) {
        // Stop the browser's own overscroll; the stretch replaces it.
        if (e.cancelable) e.preventDefault()
        pullTo(moved)
      } else if (distance > 0) {
        release()
        touchStartY = null
      }
    }
    function onTouchEnd() {
      touchStartY = null
      release()
    }
    function onWheel(e) {
      if (body.scrollTop > 0 || e.deltaY >= 0) return
      pullTo(distance + -e.deltaY * 0.5)
      clearTimeout(wheelTimer)
      wheelTimer = setTimeout(release, 160)
    }

    body.addEventListener('scroll', onScroll, { passive: true })
    body.addEventListener('touchstart', onTouchStart, { passive: true })
    body.addEventListener('touchmove', onTouchMove, { passive: false })
    body.addEventListener('touchend', onTouchEnd, { passive: true })
    body.addEventListener('touchcancel', onTouchEnd, { passive: true })
    body.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      body.removeEventListener('scroll', onScroll)
      body.removeEventListener('touchstart', onTouchStart)
      body.removeEventListener('touchmove', onTouchMove)
      body.removeEventListener('touchend', onTouchEnd)
      body.removeEventListener('touchcancel', onTouchEnd)
      body.removeEventListener('wheel', onWheel)
      clearTimeout(wheelTimer)
      clearTimeout(settleTimer)
      cancelAnimationFrame(frame)
    }
  }, [bodyRef, heroRef])
}

export default function TripDetail({
  trip: summary,
  user,
  booking,
  onClose,
  onApply,
  onMessageGuide,
  onCancelBooking,
  showStatus,
}) {
  const now = useNow()
  const bodyRef = useRef(null)
  const heroRef = useRef(null)
  useHeroZoom(bodyRef, heroRef)
  const [trip, setTrip] = useState(summary)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getTrip(summary.id)
      .then(({ trip: full }) => setTrip(full))
      .catch((err) => setError(err.message))
  }, [summary.id])

  const stats = [
    trip.startDate && { label: 'Dates', value: formatDateRange(trip.startDate, trip.endDate) },
    trip.durationDays && {
      label: 'Duration',
      value: `${trip.durationDays} ${trip.durationDays === 1 ? 'day' : 'days'}`,
    },
    { label: 'Group size', value: `${trip.minGroupSize}–${trip.maxGroupSize}` },
    { label: 'Price', value: formatPrice(trip) },
    trip.difficulty && {
      label: 'Difficulty',
      value: trip.difficulty[0].toUpperCase() + trip.difficulty.slice(1),
    },
  ].filter(Boolean)

  return (
    <div className={`edit-overlay${onApply ? ' has-apply-bar' : ''}`}>
      <header className="edit-header">
        <button type="button" className="edit-icon-btn" onClick={onClose} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <h2 className="edit-header-title">Trip details</h2>
        <span className="edit-header-spacer" />
      </header>

      <div className="edit-body trip-detail-body" ref={bodyRef}>
        <div className="trip-detail-hero" ref={heroRef}>
          <TripThumbImage trip={trip} />
          <RatingBadge rating={trip.rating} badge />
        </div>

        <h1 className="trip-detail-title">{trip.title}</h1>
        <p className="trip-detail-location">{trip.destination}</p>
        {trip.startDate && <p className="trip-countdown">{tripCountdown(trip, now)}</p>}

        <div className="trip-detail-tags">
          <span className="chip chip-static">{trip.category}</span>
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
          {onMessageGuide && trip.guide.id !== user?.id && trip.guide.verified && (
            <button
              type="button"
              className="ghost-btn trip-detail-message"
              onClick={() => onMessageGuide(trip)}
            >
              <MessageIcon />
              Message guide
            </button>
          )}
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
          <p className="field-hint deadline-note">
            {deadlineCountdown(trip, now)} · last day {formatDate(trip.bookingDeadline)}
          </p>
        )}
      </div>

      <ApplyBar
        trip={trip}
        user={user}
        booking={booking}
        now={now}
        onApply={onApply}
        onCancelBooking={onCancelBooking}
      />
    </div>
  )
}

/**
 * Floating action bar that mirrors the bottom nav's pill styling and sits in
 * the same place, since the detail overlay covers the nav itself.
 */
function ApplyBar({ trip, user, booking, now, onApply, onCancelBooking }) {
  if (!onApply) return null

  const isOwnTrip = Boolean(user) && trip.guide?.id === user.id
  const soldOut = trip.seatsLeft === 0
  // Checked against the clock, so the button turns off when the deadline passes.
  const open = canBookNow(trip, now)

  // Signed-out visitors are sent to sign in when they tap it.
  let label = user ? 'Apply' : 'Book'
  let disabled = false
  let action = () => onApply(trip)
  let danger = false
  let note = `${trip.seatsLeft ?? trip.maxGroupSize} ${trip.seatsLeft === 1 ? 'seat' : 'seats'} left`

  if (isOwnTrip) {
    label = 'Your trip'
    disabled = true
    note = `${trip.bookedSeats ?? 0} of ${trip.maxGroupSize} booked`
  } else if (booking) {
    const travellers = `${booking.travelers} ${booking.travelers === 1 ? 'traveller' : 'travellers'}`
    note = `${booking.status === 'pending' ? 'Requested' : 'Booked'} · ${travellers}`
    if (onCancelBooking && beforeTripStarts(trip, now)) {
      // The bar is narrow; the note beside it already says requested or booked.
      label = 'Cancel'
      action = () => onCancelBooking(booking)
      danger = true
    } else {
      label = booking.status === 'pending' ? 'Requested' : 'Booked'
      disabled = true
    }
  } else if (soldOut) {
    label = 'Fully booked'
    disabled = true
    note = 'No seats left'
  } else if (!open) {
    label = trip.status === 'published' ? 'Opening soon' : 'Bookings closed'
    disabled = true
    note = trip.status === 'booking_open' ? 'Past the booking deadline' : TRIP_STATUS[trip.status]?.label ?? ''
  }

  return (
    <div className="apply-bar">
      <div className="apply-price">
        <span className="apply-amount">{formatMoney(trip.pricePerPerson, trip.currency)}</span>
        <span className="apply-note">{note}</span>
      </div>
      <button
        type="button"
        className={`apply-btn${danger ? ' apply-btn-danger' : ''}`}
        onClick={action}
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
