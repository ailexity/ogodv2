import { useState } from 'react'
import { api } from '../api/client.js'
import { useBackLayer } from '../hooks/useBackLayer.js'
import { CloseIcon, ShieldIcon } from './icons.jsx'

/** On the profile: anyone can post a trip, and is the guide on the trips they post. */
export function PostTripCard({ user, onCreate }) {
  if (user.suspended) {
    return (
      <div className="status-card status-card-rejected">
        <div className="status-card-head">
          <ShieldIcon />
          <div>
            <h3 className="status-card-title">Trip posting suspended</h3>
            <p className="status-card-text">
              Your trips are closed to new bookings. Contact support to resolve this.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="status-card">
      <div className="status-card-head">
        <ShieldIcon />
        <div>
          <h3 className="status-card-title">Post your own trip</h3>
          <p className="status-card-text">
            It&apos;s free and needs no approval. You&apos;re the guide on trips you post, and a
            traveller on trips you join.
          </p>
        </div>
      </div>
      <button type="button" className="submit" onClick={onCreate}>
        Create a trip
      </button>
    </div>
  )
}

/** The UPI ID travellers pay this person on — quoted in the automatic message after each booking. */
export function PayoutDetails({ user, onClose, onSaved }) {
  const [upi, setUpi] = useState(user.payoutUpi ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useBackLayer(true, onClose)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!upi.trim()) return setError('Add your UPI ID')
    setSaving(true)
    setError('')
    try {
      const { user: updated } = await api.updatePayout({ upi: upi.trim() })
      onSaved(updated)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="edit-overlay">
      <header className="edit-header">
        <button type="button" className="edit-icon-btn" onClick={onClose} aria-label="Cancel">
          <CloseIcon />
        </button>
        <h2 className="edit-header-title">Payment details</h2>
        <span className="edit-header-spacer" />
      </header>
      <div className="edit-body">
        <form className="form" onSubmit={handleSubmit}>
          <p className="field-hint">
            Travellers on your trips see this in the automatic message after they book, pay you on
            it, and send you a screenshot. Approve a booking only once the money has reached you.
          </p>
          <label className="field">
            <span className="field-label">UPI ID</span>
            <input
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              placeholder="yourname@okaxis"
              autoCapitalize="none"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save payment details'}
          </button>
        </form>
      </div>
    </div>
  )
}
