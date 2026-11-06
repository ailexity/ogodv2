import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { LANGUAGE_OPTIONS } from '../data/categories.js'
import { useBackLayer } from '../hooks/useBackLayer.js'
import { CloseIcon, ShieldIcon } from './icons.jsx'

function formatRupees(amount) {
  return `₹${Number(amount ?? 0).toLocaleString('en-IN')}`
}

/** The yearly fee and where to pay it, as configured by the admin. */
function SubscriptionNotice({ renewal = false }) {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    api
      .subscriptionInfo()
      .then(({ subscription }) => setInfo(subscription))
      .catch(() => setInfo(null))
  }, [])

  return (
    <div className="subscription-notice">
      <p className="subscription-notice-title">
        {renewal ? 'Renew for another year' : 'Yearly guide subscription'}
        {info && <strong>{formatRupees(info.fee)} / year</strong>}
      </p>
      {info?.upi ? (
        <p>
          Pay to OGod&apos;s UPI ID <strong className="subscription-upi">{info.upi}</strong>, then
          upload the payment receipt. Our team checks it and extends your subscription.
        </p>
      ) : (
        <p>OGod&apos;s payment details aren&apos;t set up yet — please contact support before paying.</p>
      )}
    </div>
  )
}

/**
 * The essentials a guide gives before their first trip, and how they correct
 * them later. Nothing is reviewed: saving these is what lets them post.
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
            There&apos;s no approval step — you can post trips as soon as this is saved. Travellers
            see your languages, areas, experience and bio on your trips, and your phone number on
            their ticket.
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

function subscriptionState(user) {
  if (!user.subscriptionUntil) return { active: false, daysLeft: 0 }
  const end = new Date(`${user.subscriptionUntil}T23:59:59Z`)
  const daysLeft = Math.ceil((end - Date.now()) / 86_400_000)
  return { active: daysLeft > 0, daysLeft }
}

/** Doc §4 steps 5–7: what someone sees about their own standing as a guide. */
export function GuideStatusCard({ user, renewal, onEditDetails, onRenew }) {
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
              Anyone can post a trip on OGod, paid or free. Add a few details so travellers know who
              they&apos;re going with.
            </p>
          </div>
        </div>
        <button type="button" className="submit" onClick={onEditDetails}>
          Add your details
        </button>
      </div>
    )
  }

  const { active, daysLeft } = subscriptionState(user)
  const lapsed = user.subscriptionRequired && !active
  const renewalPending = renewal?.status === 'pending'
  const canRenew = user.subscriptionRequired && !renewalPending && daysLeft <= 30

  return (
    <div className={`status-card ${lapsed ? 'status-card-rejected' : 'status-card-verified'}`}>
      <div className="status-card-head">
        <ShieldIcon />
        <div>
          <h3 className="status-card-title">
            {user.guideStatus === 'verified' ? 'Verified guide' : 'Tour guide'}
            {user.certified && ' · Certified'}
          </h3>
          <p className="status-card-text">
            {!lapsed
              ? 'Your profile is live and you can post trips.'
              : user.subscriptionUntil
                ? 'Your yearly subscription has expired, so you can’t post or open trips until you renew.'
                : 'Posting trips needs a yearly subscription. Pay it to get started.'}
          </p>
        </div>
      </div>
      {user.subscriptionRequired && user.subscriptionUntil && (
        <p className="status-card-meta">
          Subscription {active ? 'active until' : 'ended on'} {user.subscriptionUntil}
          {active && daysLeft <= 30 && ` · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
        </p>
      )}
      {user.subscriptionRequired && renewalPending && (
        <p className="status-card-meta">Subscription payment under review.</p>
      )}
      {user.subscriptionRequired && renewal?.status === 'rejected' && renewal.reviewNotes && (
        <p className="status-card-meta">Last payment not approved: {renewal.reviewNotes}</p>
      )}
      {canRenew && onRenew && (
        <button type="button" className="submit" onClick={onRenew}>
          {user.subscriptionUntil ? 'Renew subscription' : 'Pay subscription'}
        </button>
      )}
      <button type="button" className="ghost-btn full-width status-card-edit" onClick={onEditDetails}>
        Edit guide details
      </button>
    </div>
  )
}

/** A yearly renewal: pay OGod, upload the receipt, and the admin extends it. */
export function SubscriptionRenewal({ user, onClose, onSubmitted }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  useBackLayer(true, onClose)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return setError('Upload the receipt for your payment')
    const form = new FormData()
    form.set('feeReceipt', file)
    setSubmitting(true)
    setError('')
    try {
      await api.renewSubscription(form)
      onSubmitted()
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
        <h2 className="edit-header-title">
          {user.subscriptionUntil ? 'Renew subscription' : 'Guide subscription'}
        </h2>
        <span className="edit-header-spacer" />
      </header>
      <div className="edit-body">
        <form className="form" onSubmit={handleSubmit}>
          <SubscriptionNotice renewal={Boolean(user.subscriptionUntil)} />
          <div className="upload-row">
            <div className="upload-copy">
              <span className="upload-label">Payment receipt</span>
              <span className="field-hint">Screenshot or PDF of the payment.</span>
              {file && <span className="upload-filename">{file.name}</span>}
            </div>
            <label className="upload-btn">
              {file ? 'Replace' : 'Upload'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setError('')
                }}
              />
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit for review'}
          </button>
        </form>
      </div>
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
