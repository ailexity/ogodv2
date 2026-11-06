import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client.js'

/**
 * Everyone who has posted a trip, and how to reach them. No one is reviewed before
 * they post, so suspending someone is the check on them.
 */
export default function AdminGuides() {
  const [guides, setGuides] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { guides: rows } = await api.listGuides()
      setGuides(rows)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleGuideAction(guide) {
    try {
      if (guide.suspended) await api.reinstateGuide(guide.id)
      else await api.suspendGuide(guide.id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="admin-view">
      <section>
        <h2 className="section-title">People posting trips</h2>
        {error && <p className="form-error">{error}</p>}
        {loading && <p className="console-empty">Loading…</p>}
        {!loading && guides.length === 0 && <p className="console-empty">No one has posted a trip yet.</p>}
        <div className="admin-list">
          {guides.map((guide) => (
            <div key={guide.id} className="admin-row admin-row-static">
              <div>
                <p className="admin-row-name">{guide.name}</p>
                <p className="admin-row-meta">
                  {[guide.email, guide.phone].filter(Boolean).join(' · ')}
                </p>
                <p className="admin-row-meta">
                  {[
                    `${guide.tripCount} ${guide.tripCount === 1 ? 'trip' : 'trips'}`,
                    guide.payoutUpi && `UPI ${guide.payoutUpi}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="admin-row-actions">
                {guide.suspended && <span className="status-pill status-suspended">Suspended</span>}
                <button type="button" className="ghost-btn" onClick={() => handleGuideAction(guide)}>
                  {guide.suspended ? 'Reinstate' : 'Suspend'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
