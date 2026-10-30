import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { GENDER_OPTIONS } from '../../data/categories.js'
import { TripCover, formatMoney } from '../TripDetail.jsx'
import { CheckIcon, ChevronLeftIcon } from '../icons.jsx'
import PriceSummary, { useQuote } from './PriceSummary.jsx'
import { formatDays } from './route.js'
import { formatDateRange } from '../../data/dates.js'

function companion() {
  return { name: '', age: '', gender: '' }
}

/** Doc §6 step 5 / §8.3 on the website: the lead traveller is the booking's one contact. */
export default function WebCheckout({ tripId, initialTravelers, user, onSignIn, onOpenChat }) {
  const [trip, setTrip] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [party, setParty] = useState(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [booking, setBooking] = useState(null)
  const [conversationId, setConversationId] = useState(null)

  useEffect(() => {
    api
      .getTrip(tripId)
      .then(({ trip: row }) => setTrip(row))
      .catch((err) => setLoadError(err.message))
  }, [tripId])

  const seatsLeft = trip ? (trip.seatsLeft ?? trip.maxGroupSize) : 1
  const count = party?.length ?? Math.max(1, Math.min(initialTravelers, seatsLeft))
  const { quote, error: quoteError } = useQuote(tripId, count)

  // Fill the lead from the account once both the trip and the user are known.
  useEffect(() => {
    if (!trip || !user || party) return
    const size = Math.max(1, Math.min(initialTravelers, seatsLeft))
    setParty([
      { name: user.name ?? '', age: user.age ?? '', gender: '', phone: user.phone ?? '', email: user.email ?? '' },
      ...Array.from({ length: size - 1 }, companion),
    ])
  }, [trip, user, party, initialTravelers, seatsLeft])

  if (loadError) {
    return (
      <div className="web-container web-section web-empty">
        <p>{loadError}</p>
        <a href="#/" className="web-btn-ghost">
          Back to all trips
        </a>
      </div>
    )
  }
  if (!trip) return <div className="web-container web-section web-faint">Loading…</div>
  if (booking) {
    return (
      <Confirmation
        trip={trip}
        booking={booking}
        onOpenChat={conversationId ? () => onOpenChat(conversationId) : null}
      />
    )
  }

  function update(index, field, value) {
    setParty((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const lead = party[0]
    if (!lead.name.trim()) return setError('Enter the lead traveller’s name')
    if (!String(lead.phone ?? '').trim()) return setError('A contact phone number is required')
    if (!String(lead.email ?? '').trim()) return setError('A contact email address is required')
    const unnamed = party.findIndex((p) => !p.name.trim())
    if (unnamed !== -1) return setError(`Enter a name for traveller ${unnamed + 1}`)

    setSubmitting(true)
    try {
      const result = await api.createBooking({ tripId: trip.id, notes, party })
      setBooking(result.booking)
      setConversationId(result.conversationId)
      window.scrollTo(0, 0)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="web-container web-section">
      <a href={`#/trips/${trip.id}`} className="web-back">
        <ChevronLeftIcon /> Back to trip
      </a>
      <h1 className="web-page-title">Request to book</h1>

      <div className="web-checkout">
        <div>
          {!user ? (
            <div className="web-panel web-signin-panel">
              <h2>Sign in to book</h2>
              <p className="web-faint">
                You need an OGod account so your guide can reach you and you can manage the booking.
                It takes a minute, and you’ll come straight back here.
              </p>
              <div className="web-signin-actions">
                <button type="button" className="web-btn web-btn-lg" onClick={() => onSignIn('register')}>
                  Create account
                </button>
                <button type="button" className="web-btn-ghost web-btn-lg" onClick={() => onSignIn('login')}>
                  I already have an account
                </button>
              </div>
            </div>
          ) : party ? (
            <form className="form web-checkout-form" onSubmit={handleSubmit}>
              {party.map((person, index) => (
                <fieldset key={index} className="web-panel">
                  <div className="web-panel-head">
                    <legend>{index === 0 ? 'Lead traveller' : `Traveller ${index + 1}`}</legend>
                    {index === 0 ? (
                      <span className="web-faint">Main contact for the guide</span>
                    ) : (
                      <button
                        type="button"
                        className="web-link"
                        onClick={() => setParty((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="web-field-grid">
                    <label className="field web-span-2">
                      <span className="field-label">Full name</span>
                      <input value={person.name} onChange={(e) => update(index, 'name', e.target.value)} required />
                    </label>
                    <label className="field">
                      <span className="field-label">Age</span>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={person.age}
                        onChange={(e) => update(index, 'age', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label">Gender</span>
                      <select value={person.gender} onChange={(e) => update(index, 'gender', e.target.value)}>
                        <option value="">Select</option>
                        {GENDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {index === 0 && (
                      <>
                        <label className="field">
                          <span className="field-label">Phone</span>
                          <input
                            type="tel"
                            value={person.phone}
                            onChange={(e) => update(index, 'phone', e.target.value)}
                            required
                          />
                        </label>
                        <label className="field">
                          <span className="field-label">Email</span>
                          <input
                            type="email"
                            value={person.email}
                            onChange={(e) => update(index, 'email', e.target.value)}
                            required
                          />
                        </label>
                      </>
                    )}
                  </div>
                </fieldset>
              ))}

              <button
                type="button"
                className="web-btn-ghost"
                disabled={count >= seatsLeft}
                onClick={() => setParty((prev) => [...prev, companion()])}
              >
                {count >= seatsLeft ? 'No more seats on this trip' : '+ Add a traveller'}
              </button>

              <label className="field">
                <span className="field-label">Note for the guide (optional)</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Dietary needs, arrival time, questions…"
                />
              </label>

              {error && <p className="form-error">{error}</p>}

              <button className="web-btn web-btn-lg" type="submit" disabled={submitting || !quote}>
                {submitting
                  ? 'Booking…'
                  : `Send request${quote ? ` · ${formatMoney(quote.total, quote.currency)}` : ''}`}
              </button>
            </form>
          ) : null}
        </div>

        <aside className="web-panel web-summary">
          <TripCover trip={trip} className="web-summary-img" alt="" />
          <h2>{trip.title}</h2>
          <p className="web-faint">
            {[
              trip.destination,
              trip.durationDays && formatDays(trip.durationDays),
              formatDateRange(trip.startDate, trip.endDate),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <PriceSummary trip={trip} travelers={count} quote={quote} error={quoteError} />
          <p className="web-faint">
            Your seats are held while you pay the guide and they check the payment. Your ticket
            arrives in Messages once they confirm.
          </p>
        </aside>
      </div>
    </div>
  )
}

function Confirmation({ trip, booking, onOpenChat }) {
  return (
    <div className="web-container web-section">
      <div className="web-panel web-confirm">
        <span className="web-confirm-icon">
          <CheckIcon />
        </span>
        <h1>Request sent</h1>
        <p>
          {trip.guide.name} has messaged you with payment details. Pay{' '}
          {formatMoney(booking.totalPaid, trip.currency)}, then send a screenshot of the payment in
          the chat. Your seats are held, and your ticket arrives once the guide confirms.
        </p>
        <div className="web-signin-actions">
          {onOpenChat && (
            <button type="button" className="web-btn web-btn-lg" onClick={onOpenChat}>
              Open chat with {trip.guide.name.split(' ')[0]}
            </button>
          )}
          <a href="#/my-trips" className="web-btn-ghost web-btn-lg">
            View my trips
          </a>
          <a href="#/" className="web-btn-ghost web-btn-lg">
            Explore more trips
          </a>
        </div>
      </div>
    </div>
  )
}
