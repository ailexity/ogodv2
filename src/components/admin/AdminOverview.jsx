import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { TRIP_STATUS } from '../../data/categories.js'

export default function AdminOverview() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .stats()
      .then(({ stats: rows }) => setStats(rows))
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <p className="form-error">{error}</p>
  if (!stats) return <p className="console-empty">Loading statistics…</p>

  const tripStatuses = Object.entries(stats.trips)
    .filter(([key]) => key !== 'total')
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="console-sections">
      <section>
        <h2 className="console-section-title">People</h2>
        <div className="stat-grid">
          <StatCard label="Total accounts" value={stats.users.total} emphasis />
          <StatCard label="Members" value={stats.users.members} />
          <StatCard label="Posting trips" value={stats.users.postingTrips} />
          <StatCard label="Suspended" value={stats.users.suspended} tone="danger" />
          <StatCard label="Admins" value={stats.users.admins} />
        </div>
      </section>

      <section>
        <h2 className="console-section-title">Bookings</h2>
        <div className="stat-grid">
          <StatCard label="Total" value={stats.bookings.total} emphasis />
          <StatCard label="Seats sold" value={stats.bookings.seatsSold} />
          <StatCard label="Awaiting approval" value={stats.bookings.pending ?? 0} />
          <StatCard label="Upcoming" value={stats.bookings.confirmed ?? 0} />
          <StatCard label="Completed" value={stats.bookings.completed ?? 0} />
          <StatCard label="Cancelled" value={stats.bookings.cancelled ?? 0} tone="danger" />
        </div>
      </section>

      <section>
        <h2 className="console-section-title">Trips by status</h2>
        <div className="bar-list">
          {tripStatuses.length === 0 && <p className="console-empty">No trips yet.</p>}
          {tripStatuses.map(([status, n]) => (
            <div key={status} className="bar-row">
              <span className="bar-label">{TRIP_STATUS[status]?.label ?? status}</span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{ width: `${stats.trips.total ? (n / stats.trips.total) * 100 : 0}%` }}
                />
              </span>
              <span className="bar-value">{n}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, hint, emphasis, tone }) {
  return (
    <div className={`stat-card${emphasis ? ' stat-card-emphasis' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className={`stat-value${tone === 'danger' && value > 0 ? ' stat-value-danger' : ''}`}>
        {value}
      </span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  )
}
