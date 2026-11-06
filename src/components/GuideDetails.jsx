import { useState } from 'react'
import { api } from '../api/client.js'
import { LANGUAGE_OPTIONS } from '../data/categories.js'
import { useBackLayer } from '../hooks/useBackLayer.js'
import { CloseIcon, ShieldIcon } from './icons.jsx'

/**
 * The essentials a guide gives before their first trip, and how they correct
 * them later. Nothing is reviewed or charged: saving these is what lets them post.
 * `requirePayout` is for someone about to post a paid trip.
 */
export default function GuideDetails({ user, requirePayout = false, onClose, onSaved }) {
  const [form, setForm] = useState({
    phone: user.phone ?? '',
    yearsExperience: user.guideExperience ?? '',
    areas: (user.guideAreas ?? []).join(', '),
    bio: user.bio ?? '',
    upi: user.payoutUpi ?? '',
    bank: user.payoutBank ?? '',
  })
  const [languages, setLanguages] = useState(user.languages ?? [])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  useBackLayer(true, onClose)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  function toggleLanguage(language) {
    setError('')
    setLanguages((prev) =>
      prev.includes(language) ? prev.filter((l) => l !== language) : [...prev, language],
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const areas = form.areas
      .split(',')
      .map((area) => area.trim())
      .filter(Boolean)
    const upi = form.upi.trim()
    const bank = form.bank.trim()

    if (!form.phone.trim()) return setError('Enter a phone number travellers can reach you on')
    if (languages.length === 0) return setError('Select at least one language you speak')
    if (areas.length === 0) return setError('List at least one area you run trips in')
    if (requirePayout && !upi && !bank) {
      return setError('Add a UPI ID or bank details, so travellers can pay you')
    }

    setSubmitting(true)
    try {
      await api.updatePayout({ upi, bank })
      const { user: updated } = await api.saveGuideDetails({
        phone: form.phone.trim(),
        yearsExperience: form.yearsExperience,
        languages,
        areas,
        bio: form.bio.trim(),
      })
      onSaved(updated)
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
        <h2 className="edit-header-title">Your guide details</h2>
        <button type="button" className="edit-save-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div className="edit-body">
        <div className="notice">
          <ShieldIcon />
          <p>
            Posting is free and there&apos;s no approval step — you can post trips as soon as this
            is saved. Travellers see your languages, areas, experience and bio on your trips, and
            your phone number on their ticket.
          </p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Phone number</span>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
              required
            />
          </label>

          <div className="field">
            <span className="field-label">Languages spoken</span>
            <div className="chip-group">
              {LANGUAGE_OPTIONS.map((language) => (
                <button
                  key={language}
                  type="button"
                  className={`chip${languages.includes(language) ? ' chip-active' : ''}`}
                  aria-pressed={languages.includes(language)}
                  onClick={() => toggleLanguage(language)}
                >
                  {language}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field-label">Areas you run trips in</span>
            <input
              type="text"
              name="areas"
              value={form.areas}
              onChange={handleChange}
              placeholder="e.g. Dharamshala, Manali, Shimla"
            />
            <span className="field-hint">Separate each area with a comma.</span>
          </label>

          <label className="field">
            <span className="field-label">
              Years of experience <span className="upload-optional">Optional</span>
            </span>
            <input
              type="number"
              name="yearsExperience"
              value={form.yearsExperience}
              onChange={handleChange}
              min="0"
              max="70"
              placeholder="e.g. 6"
            />
          </label>

          <label className="field">
            <span className="field-label">
              About you <span className="upload-optional">Optional</span>
            </span>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={3}
              placeholder="Shown to travellers on your trips"
            />
          </label>

          <div className="form-section">
            <h3 className="form-section-title">
              How travellers pay you
              {!requirePayout && <span className="upload-optional">Needed for paid trips</span>}
            </h3>
            <p className="field-hint">
              Travellers see these in the automatic message after they book, and pay you directly.
            </p>
            <label className="field">
              <span className="field-label">UPI ID</span>
              <input
                name="upi"
                value={form.upi}
                onChange={handleChange}
                placeholder="yourname@okaxis"
                autoCapitalize="none"
              />
            </label>
            <label className="field">
              <span className="field-label">Bank details (optional)</span>
              <textarea
                name="bank"
                rows={2}
                value={form.bank}
                onChange={handleChange}
                placeholder="Account name, account number, IFSC"
              />
            </label>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save details'}
          </button>
        </form>
      </div>
    </div>
  )
}

/** Doc §4 steps 5–7: what someone sees about their own standing as a guide. */
export function GuideStatusCard({ user, onEditDetails }) {
  if (user.guideStatus === 'suspended') {
    return (
      <div className="status-card status-card-rejected">
        <div className="status-card-head">
          <ShieldIcon />
          <div>
            <h3 className="status-card-title">Guide account suspended</h3>
            <p className="status-card-text">
              Your listings are closed to new bookings. Contact support to resolve this.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!user.isGuide) {
    return (
      <div className="status-card">
        <div className="status-card-head">
          <ShieldIcon />
          <div>
            <h3 className="status-card-title">Post your own trips</h3>
            <p className="status-card-text">
              Anyone can post a trip on OGod at no cost, with no approval step. Add a few details so
              travellers know who they&apos;re going with.
            </p>
          </div>
        </div>
        <button type="button" className="submit" onClick={onEditDetails}>
          Add your details
        </button>
      </div>
    )
  }

  return (
    <div className="status-card status-card-verified">
      <div className="status-card-head">
        <ShieldIcon />
        <div>
          <h3 className="status-card-title">
            {user.guideStatus === 'verified' ? 'Verified guide' : 'Tour guide'}
            {user.certified && ' · Certified'}
          </h3>
          <p className="status-card-text">Your profile is live and you can post trips.</p>
        </div>
      </div>
      <button type="button" className="ghost-btn full-width status-card-edit" onClick={onEditDetails}>
        Edit guide details
      </button>
    </div>
  )
}

/** Where travellers pay this guide — quoted in the automatic message after each booking. */
export function PayoutDetails({ user, onClose, onSaved }) {
  const [upi, setUpi] = useState(user.payoutUpi ?? '')
  const [bank, setBank] = useState(user.payoutBank ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useBackLayer(true, onClose)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!upi.trim() && !bank.trim()) return setError('Add a UPI ID or bank details')
    setSaving(true)
    setError('')
    try {
      const { user: updated } = await api.updatePayout({ upi: upi.trim(), bank: bank.trim() })
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
            Travellers see these in the automatic message after they book, pay you directly, and
            send you a screenshot. Approve a booking only once the money has reached you.
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
          <label className="field">
            <span className="field-label">Bank details (optional)</span>
            <textarea
              rows={3}
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              placeholder="Account name, account number, IFSC"
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
