import { useState } from 'react'
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
]

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
              placeholder="e.g. Kyoto, Osaka, Nara"
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
                placeholder="If required in your region"
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
              placeholder="e.g. Kyoto Prefecture, Japan"
            />
          </label>

          <div className="field">
            <span className="field-label">Documents</span>
            {DOCUMENTS.map((doc) => (
              <div key={doc.name} className="upload-row">
                <div className="upload-copy">
                  <span className="upload-label">
                    {doc.label}
                    {!doc.required && <span className="upload-optional">Optional</span>}
                  </span>
                  <span className="field-hint">{doc.hint}</span>
                  {files[doc.name] && <span className="upload-filename">{files[doc.name].name}</span>}
                </div>
                <label className="upload-btn">
                  {files[doc.name] ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    name={doc.name}
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            ))}
          </div>

          <label className="field">
            <span className="field-label">Sample itinerary</span>
            <textarea
              name="sampleItinerary"
              value={form.sampleItinerary}
              onChange={handleChange}
              rows={4}
              placeholder="Optional — submit a sample day-by-day itinerary to be considered for the Certified badge."
            />
          </label>

          {error && <p className="form-error">{error}</p>}
        </form>
      </div>
    </div>
  )
}

/** Doc §4 steps 5–7: what the guide sees about their own verification state. */
export function GuideStatusCard({ user, application, onApply }) {
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

  return (
    <div className="status-card status-card-verified">
      <div className="status-card-head">
        <ShieldIcon />
        <div>
          <h3 className="status-card-title">
            Verified guide{user.certified && ' · Certified'}
          </h3>
          <p className="status-card-text">
            Your profile is live and you can post trips.
          </p>
        </div>
      </div>
    </div>
  )
}
