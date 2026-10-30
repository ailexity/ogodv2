import { RatingBadge, TripCover, formatPrice } from '../TripDetail.jsx'
import { VerifiedIcon } from '../icons.jsx'
import { formatDays } from './route.js'
import { formatDateRange } from '../../data/dates.js'

export default function WebTripCard({ trip }) {
  const open = trip.bookable

  return (
    <a href={`#/trips/${trip.id}`} className="web-card">
      <div className="web-card-media">
        <TripCover trip={trip} className="web-card-img" alt={trip.title} />
        <RatingBadge rating={trip.rating} badge />
      </div>
      <div className="web-card-body">
        <p className="web-card-place">{trip.destination}</p>
        <h3 className="web-card-title">{trip.title}</h3>
        <p className="web-card-meta">
          {[trip.durationDays && formatDays(trip.durationDays), trip.category].filter(Boolean).join(' · ')}
        </p>
        {trip.startDate && (
          <p className="web-card-dates">{formatDateRange(trip.startDate, trip.endDate)}</p>
        )}
        <p className="web-card-guide">
          {trip.guide.name}
          {trip.guide.verified && <VerifiedIcon />}
        </p>
        <div className="web-card-foot">
          <span className="web-card-price">{formatPrice(trip)}</span>
          <span className={`web-card-seats${!open || trip.seatsLeft === 0 ? ' muted' : ''}`}>
            {trip.seatsLeft === 0
              ? 'Fully booked'
              : !open
                ? trip.status === 'published'
                  ? 'Opening soon'
                  : 'Bookings closed'
                : `${trip.seatsLeft} seats left`}
          </span>
        </div>
      </div>
    </a>
  )
}
