import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { getInitials } from '../TripDetail.jsx'
import { CloseIcon, SearchIcon, VerifiedIcon } from '../icons.jsx'

const ROLE_FILTERS = [
  { key: '', label: 'Everyone' },
  { key: 'traveler', label: 'Travelers' },
  { key: 'guide', label: 'Guides' },
  { key: 'admin', label: 'Admins' },
]

export default function AdminPeople({ currentUserId }) {
  const [role, setRole] = useState('')
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { users: rows } = await api.listUsers({ role, q: query.trim() })
      setUsers(rows)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [role, query])

  useEffect(() => {
    const timer = setTimeout(load, 200)
    return () => clearTimeout(timer)
  }, [load])

  async function toggleSuspension(person) {
    setBusyId(person.id)
    try {
      if (person.guideStatus === 'suspended') await api.reinstateGuide(person.id)
      else await api.suspendGuide(person.id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="console-sections">
      <section>
        <h2 className="console-section-title">People</h2>

        <div className="console-toolbar">
          <div className="search-bar console-search">
            <SearchIcon />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email"
            />
          </div>

          <div className="chip-group">
            {ROLE_FILTERS.map((filter) => (
              <button
                key={filter.key || 'all'}
                type="button"
                className={`chip${role === filter.key ? ' chip-active' : ''}`}
                aria-pressed={role === filter.key}
                onClick={() => setRole(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        {loading && <p className="console-empty">Loading people…</p>}
        {!loading && users.length === 0 && <p className="console-empty">No accounts match.</p>}

        {!loading && users.length > 0 && (
          <div className="table-wrap">
            <table className="console-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Role</th>
                  <th>Verification</th>
                  <th className="num">Trips</th>
                  <th className="num">Bookings</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <div className="table-account">
                        <span className="console-avatar sm">{getInitials(person.name)}</span>
                        <div>
                          <span className="table-name">
                            {person.name}
                            {person.guideStatus === 'verified' && (
                              <span className="verified-badge verified-badge-sm">
                                <VerifiedIcon />
                              </span>
                            )}
                            {person.disabled && (
                              <span className="status-pill status-suspended">Disabled</span>
                            )}
                            {!person.emailVerified && (
                              <span className="status-pill status-pending">Unconfirmed</span>
                            )}
                          </span>
                          <span className="table-email">{person.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="role-tag">{person.role}</span>
                    </td>
                    <td>
                      {person.guideStatus === 'none' ? (
                        <span className="table-muted">—</span>
                      ) : (
                        <span className={`status-pill status-${person.guideStatus}`}>
                          {person.guideStatus}
                        </span>
                      )}
                    </td>
                    <td className="num">{person.tripCount}</td>
                    <td className="num">{person.bookingCount}</td>
                    <td className="row-actions">
                      <button type="button" className="ghost-btn" onClick={() => setEditing(person)}>
                        Manage
                      </button>
                      {['verified', 'suspended'].includes(person.guideStatus) && (
                        <button
                          type="button"
                          className={`ghost-btn${person.guideStatus === 'suspended' ? '' : ' danger'}`}
                          disabled={busyId === person.id}
                          onClick={() => toggleSuspension(person)}
                        >
                          {person.guideStatus === 'suspended' ? 'Reinstate' : 'Suspend'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <PersonEditor
          person={editing}
          isSelf={editing.id === currentUserId}
          onClose={() => setEditing(null)}
          onChanged={async (updatedPerson) => {
            if (updatedPerson) setEditing(updatedPerson)
            await load()
          }}
          onDeleted={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

function PersonEditor({ person, isSelf, onClose, onChanged, onDeleted }) {
  const [profile, setProfile] = useState({
    name: person.name ?? '',
    email: person.email ?? '',
    phone: person.phone ?? '',
    address: person.address ?? '',
    age: person.age ?? '',
    bio: person.bio ?? '',
  })
  const [role, setRole] = useState(person.role)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  function updateProfileField(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }))
    setError('')
    setNotice('')
  }

  async function run(action) {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function saveProfile() {
    if (!profile.name.trim()) return setError('Name is required')

    return run(async () => {
      const { user } = await api.updateUser(person.id, {
        name: profile.name.trim(),
        email: profile.email.trim(),
        phone: profile.phone,
        address: profile.address,
        age: profile.age ? Number(profile.age) : null,
        bio: profile.bio,
      })
      setNotice('Profile updated.')
      await onChanged(user)
    })
  }

  function saveRole() {
    if (role === person.role) return
    return run(async () => {
      const { user } = await api.updateUserRole(person.id, role)
      setNotice('Role updated.')
      await onChanged(user)
    })
  }

  function savePassword() {
    if (newPassword.length < 8) return setError('Password must be at least 8 characters')
    if (newPassword !== confirmPassword) return setError('Passwords do not match')

    return run(async () => {
      await api.resetUserPassword(person.id, newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setNotice('Password reset and all their sessions signed out. Share it with them directly.')
    })
  }

  function confirmEmail() {
    return run(async () => {
      const { user } = await api.verifyUserEmail(person.id)
      setNotice('Email marked as confirmed. They can sign in now.')
      await onChanged(user)
    })
  }

  function toggleDisabled() {
    return run(async () => {
      const { user } = person.disabled
        ? await api.enableUser(person.id)
        : await api.disableUser(person.id)
      setNotice(user.disabled ? 'Account disabled.' : 'Account re-enabled.')
      await onChanged(user)
    })
  }

  function deleteAccount() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    return run(async () => {
      await api.deleteUser(person.id)
      await onDeleted()
    })
  }

  return (
    <div className="edit-overlay">
      <header className="edit-header">
        <button type="button" className="edit-icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <h2 className="edit-header-title">Manage account</h2>
        <span className="edit-header-spacer" />
      </header>

      <div className="edit-body">
        {isSelf && (
          <div className="notice">
            <p>This is your own account — role, disable and delete actions are turned off.</p>
          </div>
        )}

        <h3 className="trip-detail-title">{person.name}</h3>
        <p className="trip-detail-location">{person.email}</p>

        <label className="field">
          <span className="field-label">Name</span>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => updateProfileField('name', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Email</span>
          <input
            type="email"
            value={profile.email}
            onChange={(e) => updateProfileField('email', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Phone</span>
          <input
            type="text"
            value={profile.phone}
            onChange={(e) => updateProfileField('phone', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Address</span>
          <input
            type="text"
            value={profile.address}
            onChange={(e) => updateProfileField('address', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Age</span>
          <input
            type="number"
            min="0"
            max="120"
            value={profile.age}
            onChange={(e) => updateProfileField('age', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Bio</span>
          <textarea
            rows={3}
            value={profile.bio}
            onChange={(e) => updateProfileField('bio', e.target.value)}
          />
        </label>

        <button type="button" className="submit" onClick={saveProfile} disabled={busy}>
          Save profile
        </button>

        <label className="field">
          <span className="field-label">Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf}>
            <option value="traveler">Traveler</option>
            <option value="guide">Guide</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button
          type="button"
          className="ghost-btn"
          onClick={saveRole}
          disabled={busy || isSelf || role === person.role}
        >
          Update role
        </button>

        <label className="field">
          <span className="field-label">Set new password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              setError('')
            }}
            placeholder="New password"
            autoComplete="new-password"
          />
        </label>
        <label className="field">
          <span className="field-label">Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setError('')
            }}
            placeholder="Re-enter new password"
            autoComplete="new-password"
          />
        </label>
        <button type="button" className="ghost-btn" onClick={savePassword} disabled={busy}>
          Reset password
        </button>

        {error && <p className="form-error">{error}</p>}
        {notice && <p className="save-note">{notice}</p>}

        <div className="decision-row">
          {!person.emailVerified && (
            <button type="button" className="ghost-btn" onClick={confirmEmail} disabled={busy}>
              Mark email confirmed
            </button>
          )}
          <button
            type="button"
            className="ghost-btn"
            onClick={toggleDisabled}
            disabled={busy || isSelf}
          >
            {person.disabled ? 'Re-enable account' : 'Disable account'}
          </button>
          <button
            type="button"
            className="ghost-btn danger"
            onClick={deleteAccount}
            disabled={busy || isSelf}
          >
            {confirmingDelete ? 'Confirm delete' : 'Delete account'}
          </button>
        </div>
      </div>
    </div>
  )
}
