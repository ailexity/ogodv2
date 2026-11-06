import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client.js'

/**
 * Everyone posting trips, with the details they gave. No one is reviewed before
 * they post, so suspending a guide is the check on them.
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
        <h2 className="section-title">Tour guides</h2>
        {error && <p className="form-error">{error}</p>}
        {loading && <p className="console-empty">Loading…</p>}
        {!loading && guides.length === 0 && <p className="console-empty">No guides yet.</p>}
        <div className="admin-list">
          {guides.map((guide) => (
            <div key={guide.id} className="admin-row admin-row-static">
              <div>
                <p className="admin-row-name">
                  {guide.name}
                  {guide.certified && <span className="certified-tag">Certified</span>}
                </p>
                <p className="admin-row-meta">
                  {[guide.email, guide.phone].filter(Boolean).join(' · ')}
                </p>
                <p className="admin-row-meta">
                  {[
                    guide.guideAreas.join(', '),
                    guide.languages.join(', '),
                    guide.guideExperience > 0 && `${guide.guideExperience} yrs`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="admin-row-actions">
                {guide.guideStatus !== 'none' && (
                  <span className={`status-pill status-${guide.guideStatus}`}>{guide.guideStatus}</span>
                )}
                <button type="button" className="ghost-btn" onClick={() => handleGuideAction(guide)}>
                  {guide.guideStatus === 'suspended' ? 'Reinstate' : 'Suspend'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
