import { useCallback, useEffect, useState } from 'react'
import { api, getToken } from '../api/client.js'
import { CheckIcon, CloseIcon, ShieldIcon } from './icons.jsx'

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

/** Doc §4 step 3: the admin queue for reviewing guide verification applications. */
export default function AdminReview() {
  const [filter, setFilter] = useState('pending')
  const [applications, setApplications] = useState([])
  const [guides, setGuides] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ applications: rows }, { guides: guideRows }] = await Promise.all([
        api.listApplications(filter),
        api.listGuides(),
      ])
      setApplications(rows)
      setGuides(guideRows)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  async function handleGuideAction(guide) {
    try {
      if (guide.guideStatus === 'suspended') await api.reinstateGuide(guide.id)
      else await api.suspendGuide(guide.id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="admin-view">
      <section>
        <h2 className="section-title">Guide verification queue</h2>
        <div className="scroll-row">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`chip${filter === option.key ? ' chip-active' : ''}`}
              aria-pressed={filter === option.key}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error && <p className="form-error">{error}</p>}
        {loading && <p className="console-empty">Loading…</p>}
        {!loading && applications.length === 0 && (
          <p className="console-empty">No {filter} applications.</p>
        )}

        <div className="admin-list">
          {applications.map((application) => (
            <button
              key={application.id}
              type="button"
              className="admin-row"
              onClick={() => setSelected(application)}
            >
              <div>
                <p className="admin-row-name">
                  {application.applicant.name}
                  {application.kind === 'renewal' && (
                    <span className="chip chip-static admin-kind-tag">Subscription renewal</span>
                  )}
                </p>
                <p className="admin-row-meta">
                  {application.applicant.email} · {application.yearsExperience} yrs ·{' '}
                  {application.areas.join(', ')}
                </p>
              </div>
              <span className={`status-pill status-${application.status}`}>{application.status}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Verified guides</h2>
        {guides.length === 0 && <p className="console-empty">No guides yet.</p>}
        <div className="admin-list">
          {guides.map((guide) => (
            <div key={guide.id} className="admin-row admin-row-static">
              <div>
                <p className="admin-row-name">
                  {guide.name}
                  {guide.certified && <span className="certified-tag">Certified</span>}
                </p>
                <p className="admin-row-meta">{guide.email}</p>
              </div>
              <div className="admin-row-actions">
                <span className={`status-pill status-${guide.guideStatus}`}>{guide.guideStatus}</span>
                {['verified', 'suspended'].includes(guide.guideStatus) && (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => handleGuideAction(guide)}
                  >
                    {guide.guideStatus === 'suspended' ? 'Reinstate' : 'Suspend'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {selected && (
        <ApplicationDetail
          application={selected}
          onClose={() => setSelected(null)}
          onReviewed={async () => {
            setSelected(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

function ApplicationDetail({ application, onClose, onReviewed }) {
  const [notes, setNotes] = useState('')
  const [certified, setCertified] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const documents = Object.entries(application.documents).filter(([, value]) => value)

  async function decide(action) {
    setError('')
    if (action === 'reject' && !notes.trim()) {
      setError('Give the applicant a reason so they can fix it and reapply')
      return
    }

    setBusy(true)
    try {
      if (action === 'approve') await api.approveApplication(application.id, { notes, certified })
      else await api.rejectApplication(application.id, notes)
      await onReviewed()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="edit-overlay">
      <header className="edit-header">
        <button type="button" className="edit-icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <h2 className="edit-header-title">Review application</h2>
        <span className="edit-header-spacer" />
      </header>

      <div className="edit-body">
        <h3 className="trip-detail-title">{application.applicant.name}</h3>
        <p className="trip-detail-location">{application.applicant.email}</p>

        <div className="trip-detail-stats">
          <div className="trip-detail-stat">
            <p className="trip-detail-stat-label">Experience</p>
            <p className="trip-detail-stat-value">{application.yearsExperience} yrs</p>
          </div>
          <div className="trip-detail-stat">
            <p className="trip-detail-stat-label">Status</p>
            <p className="trip-detail-stat-value">{application.status}</p>
          </div>
          <div className="trip-detail-stat">
            <p className="trip-detail-stat-label">Submitted</p>
            <p className="trip-detail-stat-value">{application.submittedAt?.slice(0, 10)}</p>
          </div>
        </div>

        <DetailBlock label="Languages" value={application.languages.join(', ')} />
        <DetailBlock label="Areas of operation" value={application.areas.join(', ')} />
        <DetailBlock
          label="Licence"
          value={
            application.licenseNumber
              ? `${application.licenseNumber}${application.licenseRegion ? ` · ${application.licenseRegion}` : ''}${
                  application.licenseExpires ? ` · expires ${application.licenseExpires}` : ''
                }`
              : 'Not provided'
          }
        />
        {application.sampleItinerary && (
          <DetailBlock label="Sample itinerary" value={application.sampleItinerary} />
        )}

        <div className="field">
          <span className="field-label">Submitted documents</span>
          <div className="document-grid">
            {documents.length === 0 && <p className="field-hint">No documents on file.</p>}
            {documents.map(([key, filename]) => (
              <DocumentLink key={key} label={DOCUMENT_LABELS[key] ?? key} filename={filename} />
            ))}
          </div>
        </div>

        {application.status === 'pending' ? (
          <>
            <label className="field">
              <span className="field-label">Review notes</span>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  setError('')
                }}
                rows={3}
                placeholder="Required when rejecting — explain what the applicant should fix."
              />
            </label>

            <label className="sheet-option checkbox-row">
              <span>
                Grant Certified badge
                <span className="field-hint">For a reviewed, high-quality sample itinerary.</span>
              </span>
              <input
                type="checkbox"
                checked={certified}
                onChange={(e) => setCertified(e.target.checked)}
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <div className="decision-row">
              <button
                type="button"
                className="ghost-btn danger"
                onClick={() => decide('reject')}
                disabled={busy}
              >
                Reject
              </button>
              <button type="button" className="submit" onClick={() => decide('approve')} disabled={busy}>
                <CheckIcon />
                Approve
              </button>
            </div>
          </>
        ) : (
          <div className="notice">
            <ShieldIcon />
            <p>
              Reviewed on {application.reviewedAt?.slice(0, 10)}.
              {application.reviewNotes ? ` Notes: ${application.reviewNotes}` : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

const DOCUMENT_LABELS = {
  idDocument: 'Government ID',
  selfie: 'Selfie',
  addressProof: 'Proof of address',
  licenseDocument: 'Tour-guide licence',
  feeReceipt: 'Subscription payment receipt',
}

/**
 * Verification documents sit behind an admin-only endpoint, so they are fetched
 * with the auth header and shown from an object URL rather than a plain src.
 */
function DocumentLink({ label, filename }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl
    let cancelled = false

    fetch(`/api/admin/documents/${filename}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('failed'))))
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => !cancelled && setFailed(true))

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [filename])

  return (
    <div className="document-card">
      <span className="document-label">{label}</span>
      {failed && <span className="field-hint">Could not load</span>}
      {url && filename.endsWith('.pdf') && (
        <a className="ghost-btn" href={url} target="_blank" rel="noreferrer">
          Open PDF
        </a>
      )}
      {url && !filename.endsWith('.pdf') && <img src={url} alt={label} className="document-image" />}
    </div>
  )
}

function DetailBlock({ label, value }) {
  return (
    <div className="trip-detail-description">
      <span className="field-label">{label}</span>
      <p>{value}</p>
    </div>
  )
}
