import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { LANGUAGE_OPTIONS } from '../data/categories.js'
import { CloseIcon, ShieldIcon } from './icons.jsx'

const DOCUMENTS = [
  {
    name: 'idDocument',
    label: 'Government ID',
    hint: 'Passport, driving licence or national ID card.',
    required: true,
  },
  {
    name: 'selfie',
    label: 'Selfie',
    hint: 'Used for the liveness match against your ID.',
    required: true,
  },
  {
    name: 'addressProof',
    label: 'Proof of address',
    hint: 'A utility bill or bank statement from the last 3 months.',
    required: true,
  },
  {
    name: 'licenseDocument',
    label: 'Tour-guide licence',
    hint: 'Only if your region requires one.',
    required: false,
  },
  {
    name: 'feeReceipt',
    label: 'Subscription payment receipt',
    hint: 'Screenshot or PDF of your yearly subscription payment to OGod.',
    required: true,
  },
]

function UploadRow({ doc, file, onChange }) {
  return (
    <div className="upload-row">
      <div className="upload-copy">
        <span className="upload-label">
          {doc.label}
          {!doc.required && <span className="upload-optional">Optional</span>}
        </span>
        <span className="field-hint">{doc.hint}</span>
        {file && <span className="upload-filename">{file.name}</span>}
      </div>
      <label className={`upload-btn${file ? ' upload-btn-done' : ''}`}>
        {file ? 'Replace' : 'Upload'}
        <input
          type="file"
          name={doc.name}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={onChange}
        />
      </label>
    </div>
  )
}

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
          upload the payment receipt. It&apos;s checked together with your
          {renewal ? ' renewal.' : ' documents.'}
        </p>
      ) : (
        <p>OGod&apos;s payment details aren&apos;t set up yet — please contact support before applying.</p>
      )}
    </div>
  )
}

/** Doc §4 step 2: the verification application a guide submits for review. */
export default function GuideVerification({ onClose, onSubmitted }) {
  const [form, setForm] = useState({
    yearsExperience: '',
    licenseNumber: '',
    licenseRegion: '',
    licenseExpires: '',
    sampleItinerary: '',
    areas: '',
  })
  const [languages, setLanguages] = useState([])
  const [files, setFiles] = useState({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  function handleFileChange(e) {
    const { name, files: selected } = e.target
    setFiles((prev) => ({ ...prev, [name]: selected[0] ?? null }))
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

    if (languages.length === 0) return setError('Select at least one language you speak')
    if (areas.length === 0) return setError('List at least one area you operate in')
    for (const doc of DOCUMENTS) {
      if (doc.required && !files[doc.name]) return setError(`${doc.label} is required`)
    }

    const payload = new FormData()
    payload.set('yearsExperience', form.yearsExperience || '0')
    payload.set('languages', JSON.stringify(languages))
    payload.set('areas', JSON.stringify(areas))
    payload.set('licenseNumber', form.licenseNumber)
    payload.set('licenseRegion', form.licenseRegion)
    payload.set('licenseExpires', form.licenseExpires)
    payload.set('sampleItinerary', form.sampleItinerary)
    for (const [name, file] of Object.entries(files)) {
      if (file) payload.set(name, file)
    }

    setSubmitting(true)
    try {
      const { user } = await api.applyAsGuide(payload)
      onSubmitted(user)
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
        <h2 className="edit-header-title">Become a guide</h2>
        <button type="button" className="edit-save-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Sending…' : 'Submit'}
        </button>
      </header>

      <div className="edit-body">
        <div className="notice">
          <ShieldIcon />
          <p>
            Every guide is verified before they can post a trip. Your documents are reviewed by our
            team and are never shown to travelers.
          </p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Years of experience</span>
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
            <span className="field-label">Areas of operation</span>
            <input
              type="text"
              name="areas"
              value={form.areas}
              onChange={handleChange}
              placeholder="e.g. Dharamshala, Manali, Shimla"
            />
            <span className="field-hint">Separate each area with a comma.</span>
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field-label">Licence number</span>
              <input
                type="text"
                name="licenseNumber"
                value={form.licenseNumber}
                onChange={handleChange}
                placeholder="If required"
              />
            </label>

            <label className="field">
              <span className="field-label">Licence expires</span>
              <input
                type="date"
                name="licenseExpires"
                value={form.licenseExpires}
                onChange={handleChange}
              />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Licence region</span>
            <input
              type="text"
              name="licenseRegion"
              value={form.licenseRegion}
              onChange={handleChange}
              placeholder="e.g. Himachal Pradesh"
            />
          </label>

          <label className="field">
            <span className="field-label">
              Sample itinerary <span className="upload-optional">Optional</span>
            </span>
            <textarea
              name="sampleItinerary"
              value={form.sampleItinerary}
              onChange={handleChange}
              rows={4}
              placeholder="A sample day-by-day plan. Helps you get the Certified badge."
            />
          </label>

          <div className="field">
            <span className="field-label">Documents</span>
            <div className="upload-list">
              {DOCUMENTS.filter((doc) => doc.name !== 'feeReceipt').map((doc) => (
                <UploadRow key={doc.name} doc={doc} file={files[doc.name]} onChange={handleFileChange} />
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field-label">Yearly subscription</span>
            <SubscriptionNotice />
            <div className="upload-list">
              <UploadRow
                doc={DOCUMENTS.find((doc) => doc.name === 'feeReceipt')}
                file={files.feeReceipt}
                onChange={handleFileChange}
              />
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit application'}
          </button>
        </form>
      </div>
    </div>
  )
}

/** Doc §4 steps 5–7: what the guide sees about their own verification state. */
function subscriptionState(user) {
  if (!user.subscriptionUntil) return { active: false, daysLeft: 0 }
  const end = new Date(`${user.subscriptionUntil}T23:59:59Z`)
  const daysLeft = Math.ceil((end - Date.now()) / 86_400_000)
  return { active: daysLeft > 0, daysLeft }
}

export function GuideStatusCard({ user, application, renewal, onApply, onRenew }) {
  if (user.guideStatus === 'none') {
    return (
      <div className="status-card">
        <div className="status-card-head">
          <ShieldIcon />
          <div>
            <h3 className="status-card-title">Become a guide</h3>
            <p className="status-card-text">
              Get verified to post trips, take bookings and earn on OGod.
            </p>
          </div>
        </div>
        <button type="button" className="submit" onClick={onApply}>
          Start verification
        </button>
      </div>
    )
  }

  if (user.guideStatus === 'pending') {
    return (
      <div className="status-card status-card-pending">
        <div className="status-card-head">
          <ShieldIcon />
          <div>
            <h3 className="status-card-title">Verification under review</h3>
            <p className="status-card-text">
              We&apos;re checking your documents. You&apos;ll be notified once a decision is made.
            </p>
          </div>
        </div>
        {application?.submittedAt && (
          <p className="status-card-meta">Submitted {application.submittedAt}</p>
        )}
      </div>
    )
  }

  if (user.guideStatus === 'rejected') {
    return (
      <div className="status-card status-card-rejected">
        <div className="status-card-head">
          <ShieldIcon />
          <div>
            <h3 className="status-card-title">Verification not approved</h3>
            <p className="status-card-text">
              {application?.reviewNotes ?? 'Your application was not approved.'}
            </p>
          </div>
        </div>
        <button type="button" className="submit" onClick={onApply}>
          Fix and reapply
        </button>
      </div>
    )
  }

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

  const { active, daysLeft } = subscriptionState(user)
  const renewalPending = renewal?.status === 'pending'
  const canRenew = !renewalPending && daysLeft <= 30

  return (
    <div className={`status-card ${active ? 'status-card-verified' : 'status-card-rejected'}`}>
      <div className="status-card-head">
        <ShieldIcon />
        <div>
          <h3 className="status-card-title">
            Verified guide{user.certified && ' · Certified'}
          </h3>
          <p className="status-card-text">
            {active
              ? 'Your profile is live and you can post trips.'
              : 'Your yearly subscription has expired, so you can’t post or open trips until you renew.'}
          </p>
        </div>
      </div>
      {user.subscriptionUntil && (
        <p className="status-card-meta">
          Subscription {active ? 'active until' : 'ended on'} {user.subscriptionUntil}
          {active && daysLeft <= 30 && ` · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}
        </p>
      )}
      {renewalPending && <p className="status-card-meta">Renewal payment under review.</p>}
      {renewal?.status === 'rejected' && !renewalPending && renewal.reviewNotes && (
        <p className="status-card-meta">Last renewal not approved: {renewal.reviewNotes}</p>
      )}
      {canRenew && onRenew && (
        <button type="button" className="submit" onClick={onRenew}>
          Renew subscription
        </button>
      )}
    </div>
  )
}

/** A yearly renewal: pay OGod, upload the receipt, and the admin extends it. */
export function SubscriptionRenewal({ onClose, onSubmitted }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
        <h2 className="edit-header-title">Renew subscription</h2>
        <span className="edit-header-spacer" />
      </header>
      <div className="edit-body">
        <form className="form" onSubmit={handleSubmit}>
          <SubscriptionNotice renewal />
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
