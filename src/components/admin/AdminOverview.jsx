import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { formatMoney } from '../TripDetail.jsx'
import { TRIP_STATUS } from '../../data/categories.js'

export default function AdminOverview({ onJump }) {
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
      {stats.verification.awaitingReview > 0 && (
        <button type="button" className="console-alert" onClick={() => onJump('verification')}>
          <span>
            <strong>{stats.verification.awaitingReview}</strong> guide{' '}
            {stats.verification.awaitingReview === 1 ? 'application is' : 'applications are'} waiting
            for review
          </span>
          <span className="console-alert-cta">Review now →</span>
        </button>
      )}

      <section>
        <h2 className="console-section-title">Revenue</h2>
        <div className="stat-grid">
          <StatCard
            label="Gross bookings"
            value={formatMoney(stats.revenue.gross)}
            hint="Excludes cancelled bookings"
            emphasis
          />
          <StatCard
            label="Platform fees"
            value={formatMoney(stats.revenue.platformFees)}
            hint="Service fees collected"
          />
          <StatCard label="Seats sold" value={stats.bookings.seatsSold} hint="Across all bookings" />
        </div>
      </section>

      <section>
        <h2 className="console-section-title">People</h2>
        <div className="stat-grid">
          <StatCard label="Total accounts" value={stats.users.total} emphasis />
          <StatCard label="Travelers" value={stats.users.travelers} />
          <StatCard label="Guides" value={stats.users.guides} />
          <StatCard label="Admins" value={stats.users.admins} />
        </div>
      </section>

      <section>
        <h2 className="console-section-title">Verification</h2>
        <div className="stat-grid">
          <StatCard label="Verified" value={stats.verification.verified} emphasis />
          <StatCard label="Awaiting review" value={stats.verification.awaitingReview} />
          <StatCard label="Rejected" value={stats.verification.rejected} />
          <StatCard label="Suspended" value={stats.verification.suspended} tone="danger" />
        </div>
      </section>

      <section>
        <h2 className="console-section-title">Bookings</h2>
        <div className="stat-grid">
          <StatCard label="Total" value={stats.bookings.total} emphasis />
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
