import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { GENDER_OPTIONS } from '../data/categories.js'
import { formatMoney } from './TripDetail.jsx'
import { CloseIcon } from './icons.jsx'
import { formatDateRange } from '../data/dates.js'

function emptyTraveler() {
  return { name: '', age: '', gender: '' }
}

/**
 * Doc §6 step 5 / §8.3. The lead traveler is the single point of contact for
 * the booking — companions are recorded by name, age and gender only.
 */
export default function BookTrip({ trip, user, onClose, onBooked }) {
  const seatsLeft = trip.seatsLeft ?? trip.maxGroupSize
  const [party, setParty] = useState(() => [
    {
      name: user.name ?? '',
      age: user.age ?? '',
      gender: '',
      phone: user.phone ?? '',
      email: user.email ?? '',
    },
  ])
  const [notes, setNotes] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const count = party.length

  // The server owns the maths, so the summary always asks it for the total.
  useEffect(() => {
    let cancelled = false
    setQuoteError('')
    api
      .quoteBooking(trip.id, count)
      .then(({ quote: result }) => !cancelled && setQuote(result))
      .catch((err) => {
        if (cancelled) return
        setQuote(null)
        setQuoteError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [trip.id, count])

  function updateTraveler(index, field, value) {
    setParty((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
    setError('')
  }

  function addTraveler() {
    if (count >= seatsLeft) {
      setError(`Only ${seatsLeft} ${seatsLeft === 1 ? 'seat is' : 'seats are'} left on this trip`)
      return
    }
    setParty((prev) => [...prev, emptyTraveler()])
    setError('')
  }

  function removeTraveler(index) {
    setParty((prev) => prev.filter((_, i) => i !== index))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const lead = party[0]
    if (!lead.name.trim()) return setError('Enter the lead traveller’s name')
    if (!lead.phone?.trim()) return setError('A contact phone number is required')
    if (!lead.email?.trim()) return setError('A contact email address is required')
    for (const [i, person] of party.entries()) {
      if (!person.name.trim()) return setError(`Enter a name for traveller ${i + 1}`)
    }

    setSubmitting(true)
    try {
      const { booking, conversationId } = await api.createBooking({ tripId: trip.id, notes, party })
      onBooked(booking, conversationId)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="edit-overlay">
      <header className="edit-header">
        <button type="button" className="edit-icon-btn" onClick={onClose} aria-label="Cancel">
          <CloseIcon />
        </button>
        <h2 className="edit-header-title">Book trip</h2>
        <span className="edit-header-spacer" />
      </header>

      <div className="edit-body">
        <div className="book-summary">
          <h3 className="book-trip-title">{trip.title}</h3>
          <p className="book-trip-meta">
            {trip.destination}
            {trip.durationDays ? ` · ${trip.durationDays} days` : ''}
          </p>
          {trip.startDate && (
            <p className="book-trip-meta">{formatDateRange(trip.startDate, trip.endDate)}</p>
          )}
          <p className="book-trip-meta">
            {formatMoney(trip.pricePerPerson, trip.currency)} per person ·{' '}
            {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left
          </p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="party-head">
              <h3 className="form-section-title">Travellers</h3>
              <div className="stepper">
                <button
                  type="button"
                  className="ghost-btn stepper-btn"
                  onClick={() => removeTraveler(count - 1)}
                  disabled={count <= 1}
                  aria-label="Remove a traveller"
                >
                  −
                </button>
                <span className="stepper-value" aria-live="polite">
                  {count}
                </span>
                <button
                  type="button"
                  className="ghost-btn stepper-btn"
                  onClick={addTraveler}
                  disabled={count >= seatsLeft}
                  aria-label="Add a traveller"
                >
                  +
                </button>
              </div>
            </div>

            {party.map((person, index) => (
              <div key={index} className="party-card">
                <div className="party-card-head">
                  <span className="party-card-title">
                    {index === 0 ? 'Lead traveller' : `Traveller ${index + 1}`}
                  </span>
                  {index === 0 ? (
                    <span className="party-tag">Main contact</span>
                  ) : (
                    <button
                      type="button"
                      className="party-remove"
                      onClick={() => removeTraveler(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <label className="field">
                  <span className="field-label">Full name</span>
                  <input
                    type="text"
                    value={person.name}
                    onChange={(e) => updateTraveler(index, 'name', e.target.value)}
                    placeholder="As printed on their ID"
                    required
                  />
                </label>

                <div className="field-row">
                  <label className="field">
                    <span className="field-label">Age</span>
                    <input
                      type="number"
                      value={person.age}
                      onChange={(e) => updateTraveler(index, 'age', e.target.value)}
                      min="0"
                      max="120"
                    />
                  </label>

                  <label className="field">
                    <span className="field-label">Gender</span>
                    <select
                      value={person.gender}
                      onChange={(e) => updateTraveler(index, 'gender', e.target.value)}
                    >
                      <option value="">Select</option>
                      {GENDER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {index === 0 && (
                  <>
                    <label className="field">
                      <span className="field-label">Phone number</span>
                      <input
                        type="tel"
                        value={person.phone ?? ''}
                        onChange={(e) => updateTraveler(index, 'phone', e.target.value)}
                        autoComplete="tel"
                        required
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">Email address</span>
                      <input
                        type="email"
                        value={person.email ?? ''}
                        onChange={(e) => updateTraveler(index, 'email', e.target.value)}
                        autoComplete="email"
                        required
                      />
                      <span className="field-hint">
                        Your guide contacts the whole group through you.
                      </span>
                    </label>
                  </>
                )}
              </div>
            ))}
          </div>

          <label className="field">
            <span className="field-label">Anything the guide should know?</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Dietary needs, accessibility, arrival time…"
            />
          </label>

          <div className="form-section">
            <h3 className="form-section-title">Price breakdown</h3>
            {quote ? (
              <div className="price-rows">
                <div className="price-row">
                  <span>
                    {formatMoney(trip.pricePerPerson, trip.currency)} × {count}
                  </span>
                  <span>{formatMoney(quote.base, quote.currency)}</span>
                </div>
                <div className="price-row">
                  <span>Service fee</span>
                  <span>{formatMoney(quote.serviceFee, quote.currency)}</span>
                </div>
                <div className="price-row">
                  <span>Taxes</span>
                  <span>{formatMoney(quote.tax, quote.currency)}</span>
                </div>
                <div className="price-row price-total">
                  <span>Total</span>
                  <span>{formatMoney(quote.total, quote.currency)}</span>
                </div>
              </div>
            ) : quoteError ? (
              <p className="form-error">Couldn&apos;t load the price: {quoteError}</p>
            ) : (
              <p className="field-hint">Calculating…</p>
            )}
            <p className="field-hint">
              Your guide will message you with payment details. Pay them directly and send a
              screenshot in the chat — they confirm your seats once they&apos;ve checked it.
            </p>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button className="submit" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send booking request'}
          </button>
        </form>
      </div>
    </div>
  )
}
