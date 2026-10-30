import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { BOOKING_STATUS, GENDER_OPTIONS } from '../data/categories.js'
import { formatMoney, getInitials } from './TripDetail.jsx'
import { CheckIcon, CloseIcon, MessageIcon } from './icons.jsx'

const GENDER_LABEL = Object.fromEntries(GENDER_OPTIONS.map((o) => [o.value, o.label]))

/** Doc §5 step 5: the guide's roster — who applied, who is confirmed. */
export default function TripApplicants({ trip, onClose, onChanged, onMessage }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [declining, setDeclining] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { bookings: rows } = await api.tripBookings(trip.id)
      setBookings(rows)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [trip.id])

  useEffect(() => {
    load()
  }, [load])

  async function approve(booking) {
    const amount = formatMoney(booking.totalPaid, booking.trip.currency)
    if (!window.confirm(`Approve this booking? Only do this once ${amount} has reached your account.`)) return
    setBusyId(booking.id)
    setError('')
    try {
      await api.approveBooking(booking.id, '', true)
      await load()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function decline(booking, note) {
    setBusyId(booking.id)
    setError('')
    try {
      await api.declineBooking(booking.id, note)
      setDeclining(null)
      await load()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const requests = bookings.filter((b) => b.status === 'pending')
  const confirmed = bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed')
  const cancelled = bookings.filter((b) => b.status === 'cancelled')
  const seatsTaken = confirmed.reduce((sum, b) => sum + b.travelers, 0)

  return (
    <div className="edit-overlay">
      <header className="edit-header">
        <button type="button" className="edit-icon-btn" onClick={onClose} aria-label="Back">
          <CloseIcon />
        </button>
        <h2 className="edit-header-title">Applicants</h2>
        <span className="edit-header-spacer" />
      </header>

      <div className="edit-body">
        <div className="book-summary">
          <h3 className="book-trip-title">{trip.title}</h3>
          <p className="book-trip-meta">
            {seatsTaken} of {trip.maxGroupSize} seats confirmed
            {requests.length > 0 && ` · ${requests.length} awaiting your approval`}
          </p>
        </div>

        {error && <p className="form-error">{error}</p>}
        {loading && <p className="console-empty">Loading applicants…</p>}

        {!loading && bookings.length === 0 && (
          <div className="empty-state">
            <p>No one has applied yet.</p>
            <p className="field-hint">
              Applications appear here as soon as a traveller books this trip.
            </p>
          </div>
        )}

        {!loading && (
          <>
            <ApplicantGroup
              title="Awaiting approval"
              bookings={requests}
              busyId={busyId}
              onApprove={approve}
              onDecline={setDeclining}
              onMessage={onMessage}
            />
            <ApplicantGroup
              title="Confirmed"
              bookings={confirmed}
              busyId={busyId}
              onDecline={setDeclining}
              onMessage={onMessage}
            />
            <ApplicantGroup
              title="Cancelled"
              bookings={cancelled}
              busyId={busyId}
              onMessage={onMessage}
            />
          </>
        )}
      </div>

      {declining && (
        <DeclineSheet
          booking={declining}
          busy={busyId === declining.id}
          onClose={() => setDeclining(null)}
          onConfirm={(note) => decline(declining, note)}
        />
      )}
    </div>
  )
}

function ApplicantGroup({ title, bookings, busyId, onApprove, onDecline, onMessage }) {
  if (bookings.length === 0) return null

  return (
    <section className="applicant-group">
      <h3 className="form-section-title">
        {title} <span className="section-count">{bookings.length}</span>
      </h3>
      {bookings.map((booking) => (
        <ApplicantCard
          key={booking.id}
          booking={booking}
          busy={busyId === booking.id}
          onApprove={onApprove}
          onDecline={onDecline}
          onMessage={onMessage}
        />
      ))}
    </section>
  )
}

export function ApplicantCard({ booking, busy, onApprove, onDecline, onMessage }) {
  const lead = booking.party.find((p) => p.lead) ?? booking.party[0]
  const companions = booking.party.filter((p) => !p.lead)
  const status = BOOKING_STATUS[booking.status]

  return (
    <article className="applicant-card">
      <header className="applicant-head">
        <span className="profile-avatar applicant-avatar">{getInitials(lead?.name)}</span>
        <div className="applicant-identity">
          <p className="applicant-name">{lead?.name}</p>
          <p className="applicant-meta">
            {booking.travelers} {booking.travelers === 1 ? 'traveller' : 'travellers'} ·{' '}
            {formatMoney(booking.totalPaid, booking.trip.currency)}
          </p>
        </div>
        <span className={`status-pill status-tone-${status.tone}`}>{status.label}</span>
      </header>

      {booking.status === 'pending' && (
        <p className={`payment-note payment-${booking.paymentStatus}`}>
          {booking.paymentStatus === 'proof_sent'
            ? 'Payment screenshot received in messages — check your account before approving.'
            : 'Waiting for the traveller’s payment.'}
        </p>
      )}

      <dl className="applicant-facts">
        {lead?.phone && (
          <div>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${lead.phone}`}>{lead.phone}</a>
            </dd>
          </div>
        )}
        {lead?.email && (
          <div>
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${lead.email}`}>{lead.email}</a>
            </dd>
          </div>
        )}
        <div>
          <dt>Applied</dt>
          <dd>{booking.bookedAt?.slice(0, 10)}</dd>
        </div>
      </dl>

      <div className="applicant-party">
        <span className="field-label">Who&apos;s coming</span>
        <ul>
          {booking.party.map((person, i) => (
            <li key={i}>
              <span className="party-person-name">{person.name}</span>
              <span className="party-person-meta">
                {[
                  person.lead ? 'Lead' : null,
                  person.age ? `${person.age}` : null,
                  person.gender ? GENDER_LABEL[person.gender] ?? person.gender : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ul>
        {companions.length > 0 && (
          <p className="field-hint">
            Contact details are held for the lead traveller only.
          </p>
        )}
      </div>

      {booking.notes && (
        <div className="applicant-note">
          <span className="field-label">Traveller&apos;s note</span>
          <p>{booking.notes}</p>
        </div>
      )}

      {booking.guideNote && (
        <div className="applicant-note">
          <span className="field-label">Your note</span>
          <p>{booking.guideNote}</p>
        </div>
      )}

      {onMessage && booking.bookedBy && (
        <button
          type="button"
          className="ghost-btn applicant-message"
          onClick={() => onMessage(booking)}
        >
          <MessageIcon />
          Message {booking.bookedBy.name.split(' ')[0]}
        </button>
      )}

      {(onApprove || onDecline) && (
        <div className="decision-row applicant-actions">
          {onDecline && (
            <button
              type="button"
              className="ghost-btn danger"
              disabled={busy}
              onClick={() => onDecline(booking)}
            >
              {booking.status === 'confirmed' ? 'Remove' : 'Decline'}
            </button>
          )}
          {onApprove && (
            <button
              type="button"
              className="submit"
              disabled={busy}
              onClick={() => onApprove(booking)}
            >
              <CheckIcon />
              {busy ? 'Saving…' : 'Payment verified · Approve'}
            </button>
          )}
        </div>
      )}
    </article>
  )
}

function DeclineSheet({ booking, busy, onClose, onConfirm }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  function submit() {
    if (!note.trim()) {
      setError('Give the traveller a reason so they know what happened')
      return
    }
    onConfirm(note.trim())
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="sheet-title">
          {booking.status === 'confirmed' ? 'Remove from trip' : 'Decline application'}
        </h3>
        <div className="sheet-body">
          <p className="field-hint">
            {booking.travelers === 1
              ? 'Their seat goes back into your remaining capacity.'
              : `Their ${booking.travelers} seats go back into your remaining capacity.`}
          </p>
          <label className="field">
            <span className="field-label">Reason</span>
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setError('')
              }}
              rows={3}
              placeholder="Shared with the traveller"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="decision-row">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Keep
            </button>
            <button type="button" className="ghost-btn danger" disabled={busy} onClick={submit}>
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
