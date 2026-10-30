import { useState } from 'react'
import AdminReview from '../AdminReview.jsx'
import AdminBlogs from './AdminBlogs.jsx'
import AdminOverview from './AdminOverview.jsx'
import AdminPeople from './AdminPeople.jsx'
import AdminSettings from './AdminSettings.jsx'
import { getInitials } from '../TripDetail.jsx'

const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'verification', label: 'Verification' },
  { key: 'people', label: 'People' },
  { key: 'blogs', label: 'Stories' },
  { key: 'settings', label: 'Settings' },
]

/**
 * The admin console is a separate shell from the traveler app — no trip feed,
 * no bottom nav. Admins moderate the platform, they do not browse or book.
 */
export default function AdminApp({ user, onLogout }) {
  const [section, setSection] = useState('overview')

  return (
    <div className="console">
      <header className="console-header">
        <div className="console-brand">
          <span className="brand-mark brand-mark-sm">O</span>
          <div>
            <span className="console-title">OGod Console</span>
            <span className="console-subtitle">Platform administration</span>
          </div>
        </div>

        <div className="console-account">
          <span className="console-avatar">{getInitials(user.name)}</span>
          <div className="console-account-text">
            <span className="console-account-name">{user.name}</span>
            <span className="console-account-role">Administrator</span>
          </div>
          <button type="button" className="ghost-btn" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <nav className="console-nav" aria-label="Console sections">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`console-tab${section === item.key ? ' console-tab-active' : ''}`}
            aria-current={section === item.key ? 'page' : undefined}
            onClick={() => setSection(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="console-body">
        {section === 'overview' && <AdminOverview onJump={setSection} />}
        {section === 'verification' && <AdminReview />}
        {section === 'people' && <AdminPeople currentUserId={user.id} />}
        {section === 'blogs' && <AdminBlogs />}
        {section === 'settings' && <AdminSettings user={user} />}
      </main>
    </div>
  )
}
