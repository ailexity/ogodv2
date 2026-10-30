import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { TRAVEL_INTERESTS } from '../data/interests.js'
import {
  BOOKING_STATUS,
  CANCELLABLE,
  DIFFICULTIES,
  LANGUAGE_OPTIONS,
  STATUS_ACTIONS,
  TRIP_CATEGORIES,
} from '../data/categories.js'
import BookTrip from './BookTrip.jsx'
import { cancelBookingWithConfirm } from './cancelBooking.js'
import { formatDateRange, timeAgo, tripCountdown } from '../data/dates.js'
import { useNow } from '../hooks/useNow.js'
import { BlogComposer, BlogDetailOverlay, BlogsAllOverlay, BlogsSection } from './Blogs.jsx'
import GuideVerification, {
  GuideStatusCard,
  PayoutDetails,
  SubscriptionRenewal,
} from './GuideVerification.jsx'
import { ChatThread, MessagesInbox, useChatLauncher, useUnreadMessages } from './Messages.jsx'
import TripApplicants from './TripApplicants.jsx'
import TripForm from './TripForm.jsx'
import TripDetail, {
  RatingBadge,
  StatusPill,
  TripCover,
  TripThumbImage,
  formatPrice,
  getInitials,
} from './TripDetail.jsx'
import {
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
  HomeIcon,
  MessageIcon,
  PenIcon,
  PlusIcon,
  ProfileIcon,
  SearchIcon,
  SlidersIcon,
  StarIcon,
  TripsIcon,
  VerifiedIcon,
} from './icons.jsx'

const NOTIFICATION_SETTINGS_KEY = 'ogod_notification_settings'
const DEFAULT_NOTIFICATION_SETTINGS = { push: true, emailUpdates: true }

function loadNotificationSettings() {
  try {
    const raw = localStorage.getItem(NOTIFICATION_SETTINGS_KEY)
    return raw ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) } : DEFAULT_NOTIFICATION_SETTINGS
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS
  }
}

const BASE_TABS = [
  { key: 'home', label: 'Home', Icon: HomeIcon },
  { key: 'explore', label: 'Explore', Icon: SearchIcon },
  { key: 'trips', label: 'My Trips', Icon: TripsIcon },
  { key: 'profile', label: 'Profile', Icon: ProfileIcon },
]

/** Doc §6 step 2: the traveler-facing search filters, mapped to API query params. */
export const FILTERS = [
  {
    // Trips starting within the next N days, counted from today on the server.
    key: 'withinDays',
    label: 'When',
    options: [
      { label: 'Next 2 weeks', value: 14 },
      { label: 'Next month', value: 30 },
      { label: 'Next 3 months', value: 90 },
      { label: 'Next 6 months', value: 180 },
    ],
  },
  {
    key: 'maxPrice',
    label: 'Budget',
    options: [
      { label: 'Under $500', value: 500 },
      { label: 'Under $1,000', value: 1000 },
      { label: 'Under $2,000', value: 2000 },
      { label: 'Under $5,000', value: 5000 },
    ],
  },
  {
    key: 'groupSize',
    label: 'Group size',
    options: [
      { label: 'Solo', value: 1 },
      { label: 'Couple', value: 2 },
      { label: 'Small group (4)', value: 4 },
      { label: 'Medium group (8)', value: 8 },
    ],
  },
  {
    key: 'minRating',
    label: 'Guide rating',
    options: [
      { label: '4.0+', value: 4 },
      { label: '4.5+', value: 4.5 },
      { label: '4.8+', value: 4.8 },
    ],
  },
  {
    key: 'difficulty',
    label: 'Difficulty',
    options: DIFFICULTIES.map((level) => ({ label: level, value: level })),
  },
  {
    key: 'language',
    label: 'Language',
    options: LANGUAGE_OPTIONS.map((language) => ({ label: language, value: language })),
  },
]

const TERMS_TEXT = [
  'By using OGod, you agree to book and travel responsibly, and to provide accurate information when creating an account or applying to become a guide.',
  'Only verified guides may post trips. Verification checks identity documents and, where a region requires one, a tour-guide licence.',
  'Trips listed on OGod are run by independent guides. OGod verifies identity but is not responsible for the outcome of any trip.',
  'Your personal information is used only to operate your account and is never sold to third parties. Verification documents are visible only to our review team.',
  'These terms may be updated from time to time. Continued use of the app means you accept the latest version.',
]

/**
 * The phone app. `user` is null for a signed-out visitor, who can browse trips
 * and stories; anything that needs an account calls `onSignIn` instead.
 */
export default function Home({ user, onUserChange, onLogout, onSignIn }) {
  const [activeTab, setActiveTab] = useState('home')
  const [trips, setTrips] = useState([])
  const [myTrips, setMyTrips] = useState([])
  const [bookings, setBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [loadingTrips, setLoadingTrips] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeCategory, setActiveCategory] = useState(null)
  const [filterValues, setFilterValues] = useState({})
  const [openFilter, setOpenFilter] = useState(null)
  const [openInfoSheet, setOpenInfoSheet] = useState(null)
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [notifSettings, setNotifSettings] = useState(loadNotificationSettings)
  const [editingProfile, setEditingProfile] = useState(false)
  const [tripFormState, setTripFormState] = useState(null)
  const [applying, setApplying] = useState(false)
  const [application, setApplication] = useState(null)
  const [bookingTrip, setBookingTrip] = useState(null)
  const [applicantsTrip, setApplicantsTrip] = useState(null)
  const [blogs, setBlogs] = useState([])
  const [loadingBlogs, setLoadingBlogs] = useState(true)
  const [composingBlog, setComposingBlog] = useState(false)
  const [viewingBlog, setViewingBlog] = useState(null)
  const [viewingAllBlogs, setViewingAllBlogs] = useState(false)
  const [creating, setCreating] = useState(false)
  const chat = useChatLauncher()
  const [unreadMessages, refreshUnread] = useUnreadMessages(Boolean(user))
  const [renewal, setRenewal] = useState(null)
  const [renewing, setRenewing] = useState(false)
  const [editingPayout, setEditingPayout] = useState(false)
  const signedIn = Boolean(user)
  const guideStatus = user?.guideStatus ?? 'none'

  /** Tabs that only make sense with an account send visitors to sign in. */
  function selectTab(key) {
    if (!signedIn && (key === 'trips' || key === 'profile')) onSignIn('login')
    else setActiveTab(key)
  }

  const tabs = BASE_TABS
  const openFilterConfig = FILTERS.find((f) => f.key === openFilter) ?? null

  const loadTrips = useCallback(async () => {
    setLoadingTrips(true)
    try {
      const { trips: rows } = await api.listTrips({ category: activeCategory, ...filterValues })
      setTrips(rows)
      setLoadError('')
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoadingTrips(false)
    }
  }, [activeCategory, filterValues])

  const loadMyTrips = useCallback(async () => {
    try {
      const { trips: rows } = await api.myTrips()
      setMyTrips(rows)
    } catch (err) {
      setLoadError(err.message)
    }
  }, [])

  const loadBookings = useCallback(async () => {
    setLoadingBookings(true)
    try {
      const { bookings: rows } = await api.myBookings()
      setBookings(rows)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoadingBookings(false)
    }
  }, [])

  const loadBlogs = useCallback(async () => {
    setLoadingBlogs(true)
    try {
      const { blogs: rows } = await api.listBlogs()
      setBlogs(rows)
    } catch {
      // Stories are a secondary feature — a failed fetch just leaves the strip empty.
    } finally {
      setLoadingBlogs(false)
    }
  }, [])

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  useEffect(() => {
    if (signedIn) loadMyTrips()
  }, [loadMyTrips, signedIn])

  useEffect(() => {
    if (signedIn) loadBookings()
  }, [loadBookings, signedIn])

  useEffect(() => {
    loadBlogs()
  }, [loadBlogs])

  const loadApplication = useCallback(() => {
    api
      .myApplication()
      .then(({ application: row, renewal: next }) => {
        setApplication(row)
        setRenewal(next)
      })
      .catch(() => setApplication(null))
  }, [])

  useEffect(() => {
    if (guideStatus !== 'none') loadApplication()
  }, [guideStatus, loadApplication])

  const activeFilterCount = Object.keys(filterValues).length

  function selectFilterValue(key, value) {
    setFilterValues((prev) => {
      const next = { ...prev }
      if (next[key] === value) delete next[key]
      else next[key] = value
      return next
    })
    setOpenFilter(null)
  }

  function clearFilterValue(key) {
    setFilterValues((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setOpenFilter(null)
  }

  function toggleNotifSetting(key) {
    setNotifSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  }

  /** Doc §4 step 6: the post button only opens the composer for a verified guide. */
  function handlePostIntent() {
    if (user?.canPostTrips) setTripFormState({ trip: null })
    else {
      setActiveTab('profile')
      setApplying(user?.guideStatus === 'none' || user?.guideStatus === 'rejected')
    }
  }

  async function handleTripSaved() {
    setTripFormState(null)
    await Promise.all([loadTrips(), loadMyTrips()])
    setActiveTab('trips')
  }

  async function handleStatusChange(trip, status, reason) {
    try {
      await api.setTripStatus(trip.id, status, reason)
      await Promise.all([loadTrips(), loadMyTrips()])
    } catch (err) {
      setLoadError(err.message)
    }
  }

  async function handleDuplicate(trip) {
    try {
      await api.duplicateTrip(trip.id)
      await loadMyTrips()
    } catch (err) {
      setLoadError(err.message)
    }
  }

  async function handleDelete(trip) {
    try {
      await api.deleteTrip(trip.id)
      await loadMyTrips()
    } catch (err) {
      setLoadError(err.message)
    }
  }

  async function handleCancelBooking(booking) {
    try {
      const updated = await cancelBookingWithConfirm(booking, booking.trip?.title ?? selectedTrip?.title)
      if (updated) await Promise.all([loadBookings(), loadTrips()])
    } catch (err) {
      setLoadError(err.message)
    }
  }

  async function handleBooked(_booking, conversationId) {
    setBookingTrip(null)
    // Seat counts on the feed change too, so refresh both.
    await Promise.all([loadBookings(), loadTrips()])
    setActiveTab('trips')
    // The guide's automatic message has the payment details, so show it.
    if (conversationId) chat.setChatId(conversationId)
  }

  function handleApplicationSubmitted(updatedUser) {
    setApplying(false)
    onUserChange(updatedUser)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="greeting">
          <h1 className="greeting-name">
            {user ? `Hello, ${user.name.split(' ')[0]}` : 'Discover trips'}
          </h1>
          <p className="greeting-sub">
            {user?.canPostTrips ? 'Verified guide' : 'Book trips of your favorite places'}
          </p>
        </div>
        {!user && (
          <button type="button" className="header-signin" onClick={() => onSignIn('login')}>
            Sign in
          </button>
        )}
        {user && (
        <>
        <button
          type="button"
          className="header-icon-btn"
          onClick={() => chat.setInboxOpen(true)}
          aria-label={unreadMessages ? `Messages, ${unreadMessages} unread` : 'Messages'}
        >
          <MessageIcon />
          {unreadMessages > 0 && <span className="header-badge">{unreadMessages}</span>}
        </button>
        <button
          type="button"
          className="greeting-avatar"
          onClick={() => setActiveTab('profile')}
          aria-label="Your profile"
        >
          {getInitials(user.name)}
          {user?.canPostTrips && (
            <span className="greeting-verified" aria-hidden="true">
              <VerifiedIcon />
            </span>
          )}
        </button>
        </>
        )}
      </header>

      <main className="app-content">
        {activeTab === 'home' && (
          <div className="home-view">
            <div className="home-search">
              <button
                type="button"
                className="search-bar search-bar-button"
                onClick={() => setActiveTab('explore')}
              >
                <SearchIcon />
                <span className="search-placeholder">Search</span>
              </button>
              <button
                type="button"
                className={`filter-btn${activeFilterCount > 0 ? ' filter-btn-active' : ''}`}
                onClick={() => setOpenFilter(FILTERS[0].key)}
                aria-label="Filters"
              >
                <SlidersIcon />
                {activeFilterCount > 0 && <span className="pending-badge">{activeFilterCount}</span>}
              </button>
            </div>

            <BlogsSection
              blogs={blogs}
              loading={loadingBlogs}
              onCompose={() => (signedIn ? setComposingBlog(true) : onSignIn('login'))}
              onSelect={setViewingBlog}
              onSeeAll={() => setViewingAllBlogs(true)}
            />

            <h2 className="home-heading">Select your next trip</h2>

            <div className="scroll-row category-pills">
              <button
                type="button"
                className={`pill${activeCategory === null ? ' pill-active' : ''}`}
                aria-pressed={activeCategory === null}
                onClick={() => setActiveCategory(null)}
              >
                All
              </button>
              {TRIP_CATEGORIES.map(({ label }) => (
                <button
                  key={label}
                  type="button"
                  className={`pill${activeCategory === label ? ' pill-active' : ''}`}
                  aria-pressed={activeCategory === label}
                  onClick={() => setActiveCategory((prev) => (prev === label ? null : label))}
                >
                  {label}
                </button>
              ))}
            </div>

            {loadError && <p className="form-error">{loadError}</p>}

            <section className="hero-list">
              {loadingTrips && <p className="trip-list-empty">Loading trips…</p>}

              {!loadingTrips && trips.length === 0 && (
                <div className="empty-state">
                  <TripsIcon />
                  <p>
                    {activeCategory || activeFilterCount > 0
                      ? 'No trips match your filters yet.'
                      : 'No trips have been published yet.'}
                  </p>
                  <p className="field-hint">
                    {user?.canPostTrips
                      ? 'Post the first one and it will show up here.'
                      : 'Once verified guides publish trips, you can browse and book them here.'}
                  </p>
                  {user?.canPostTrips && (
                    <button
                      type="button"
                      className="submit empty-state-cta"
                      onClick={handlePostIntent}
                    >
                      Create a trip
                    </button>
                  )}
                </div>
              )}

              {trips.map((trip) => (
                <HeroTripCard key={trip.id} trip={trip} onSelect={() => setSelectedTrip(trip)} />
              ))}
            </section>
          </div>
        )}

        {activeTab === 'explore' && <ExploreTab onSelectTrip={setSelectedTrip} />}

        {activeTab === 'trips' && (
          <MyTripsTab
            user={user}
            bookings={bookings}
            loadingBookings={loadingBookings}
            listings={myTrips}
            onSelectTrip={setSelectedTrip}
            onCreateTrip={handlePostIntent}
            onEditTrip={(trip) => setTripFormState({ trip })}
            onStatusChange={handleStatusChange}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onExplore={() => setActiveTab('explore')}
            onViewApplicants={setApplicantsTrip}
          />
        )}

        {activeTab === 'profile' && (
          <div className="profile-view">
            <div className="profile-header">
              <div className="profile-avatar">{getInitials(user.name)}</div>
              <h2 className="profile-name">
                {user.name}
                {user.canPostTrips && (
                  <span className="verified-badge" title="Verified guide">
                    <VerifiedIcon />
                  </span>
                )}
              </h2>
              <p className="profile-email">{user.email}</p>
            </div>

            <GuideStatusCard
              user={user}
              application={application}
              renewal={renewal}
              onApply={() => setApplying(true)}
              onRenew={() => setRenewing(true)}
            />

            <div className="profile-details">
              <div className="profile-detail-row">
                <span className="profile-detail-label">Age</span>
                <span className="profile-detail-value">{user.age ?? '—'}</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-detail-label">Phone number</span>
                <span className="profile-detail-value">{user.phone ?? '—'}</span>
              </div>
              <div className="profile-detail-row">
                <span className="profile-detail-label">Address</span>
                <span className="profile-detail-value">{user.address ?? '—'}</span>
              </div>
            </div>

            {user.bio && <p className="guide-bio">{user.bio}</p>}

            {user.interests?.length > 0 && (
              <div className="profile-interests">
                <span className="field-label">Travel interests</span>
                <div className="chip-group">
                  {user.interests.map((interest) => (
                    <span key={interest} className="chip chip-static">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="profile-menu">
              {['verified', 'suspended'].includes(user.guideStatus) && (
                <button
                  type="button"
                  className="profile-menu-item"
                  onClick={() => setEditingPayout(true)}
                >
                  <span>
                    Payment details
                    {!user.payoutUpi && !user.payoutBank && (
                      <span className="field-hint profile-menu-hint">
                        Add these so travellers can pay you
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon />
                </button>
              )}
              <button
                type="button"
                className="profile-menu-item"
                onClick={() => chat.setInboxOpen(true)}
              >
                <span>
                  Messages
                  {unreadMessages > 0 && <span className="pending-badge">{unreadMessages}</span>}
                </span>
                <ChevronRightIcon />
              </button>
              <button
                type="button"
                className="profile-menu-item"
                onClick={() => setOpenInfoSheet('settings')}
              >
                <span>Settings</span>
                <ChevronRightIcon />
              </button>
              <button
                type="button"
                className="profile-menu-item"
                onClick={() => setOpenInfoSheet('terms')}
              >
                <span>Terms &amp; Conditions</span>
                <ChevronRightIcon />
              </button>
            </div>

            <button type="button" className="logout-link profile-logout" onClick={onLogout}>
              Log out
            </button>
            <button
              type="button"
              className="logout-link profile-logout profile-logout-all"
              onClick={async () => {
                try {
                  await api.logoutAll()
                } finally {
                  onLogout()
                }
              }}
            >
              Log out of all devices
            </button>
          </div>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {tabs.slice(0, 2).map((tab) => (
          <NavButton
            key={tab.key}
            tab={tab}
            active={activeTab === tab.key}
            onClick={() => selectTab(tab.key)}
          />
        ))}

        <button
          type="button"
          className="nav-post"
          aria-label="Create"
          aria-haspopup="dialog"
          onClick={() => (signedIn ? setCreating(true) : onSignIn('login'))}
        >
          <PlusIcon />
        </button>

        {tabs.slice(2).map((tab) => (
          <NavButton
            key={tab.key}
            tab={tab}
            active={activeTab === tab.key}
            onClick={() => selectTab(tab.key)}
          />
        ))}
      </nav>

      {openFilterConfig && (
        <div className="sheet-backdrop" onClick={() => setOpenFilter(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="sheet-title">Select {openFilterConfig.label.toLowerCase()}</h3>
            <div className="sheet-options">
              {openFilterConfig.options.map((option) => {
                const selected = filterValues[openFilterConfig.key] === option.value
                return (
                  <button
                    key={option.label}
                    type="button"
                    className={`sheet-option${selected ? ' sheet-option-active' : ''}`}
                    onClick={() => selectFilterValue(openFilterConfig.key, option.value)}
                  >
                    <span>{option.label}</span>
                    {selected && <CheckIcon />}
                  </button>
                )
              })}
            </div>
            {filterValues[openFilterConfig.key] !== undefined && (
              <button
                type="button"
                className="sheet-clear"
                onClick={() => clearFilterValue(openFilterConfig.key)}
              >
                Clear selection
              </button>
            )}
          </div>
        </div>
      )}

      {creating && (
        <div className="sheet-backdrop" onClick={() => setCreating(false)}>
          <div className="sheet" role="dialog" aria-label="Create" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="sheet-title">Create</h3>
            <div className="sheet-options">
              <CreateOption
                Icon={PenIcon}
                title="Share a travel story"
                text="Post photos or a video from a trip to the home feed."
                onClick={() => {
                  setCreating(false)
                  setComposingBlog(true)
                }}
              />
              {user?.canPostTrips && (
                <CreateOption
                  Icon={TripsIcon}
                  title="Post a trip"
                  text="List a new trip for travellers to book."
                  onClick={() => {
                    setCreating(false)
                    setTripFormState({ trip: null })
                  }}
                />
              )}
              <CreateOption
                Icon={MessageIcon}
                title="Messages"
                text="Chat with guides and travellers, and share photos."
                onClick={() => {
                  setCreating(false)
                  chat.setInboxOpen(true)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {openInfoSheet && (
        <div className="sheet-backdrop" onClick={() => setOpenInfoSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h3 className="sheet-title">
              {openInfoSheet === 'settings' ? 'Settings' : 'Terms & Conditions'}
            </h3>
            <div className="sheet-body">
              {openInfoSheet === 'settings' ? (
                <>
                  <button
                    type="button"
                    className="sheet-option"
                    onClick={() => {
                      setOpenInfoSheet(null)
                      setEditingProfile(true)
                    }}
                  >
                    <span>Edit profile</span>
                    <ChevronRightIcon />
                  </button>
                  <label className="sheet-option">
                    <span>Push notifications</span>
                    <ToggleSwitch
                      checked={notifSettings.push}
                      onChange={() => toggleNotifSetting('push')}
                    />
                  </label>
                  <label className="sheet-option">
                    <span>Email updates</span>
                    <ToggleSwitch
                      checked={notifSettings.emailUpdates}
                      onChange={() => toggleNotifSetting('emailUpdates')}
                    />
                  </label>
                </>
              ) : (
                TERMS_TEXT.map((paragraph, i) => <p key={i}>{paragraph}</p>)
              )}
            </div>
          </div>
        </div>
      )}

      {editingProfile && (
        <EditProfileOverlay
          user={user}
          onClose={() => setEditingProfile(false)}
          onSaved={(updated) => {
            onUserChange(updated)
            setEditingProfile(false)
          }}
        />
      )}

      {renewing && (
        <SubscriptionRenewal
          onClose={() => setRenewing(false)}
          onSubmitted={() => {
            setRenewing(false)
            loadApplication()
          }}
        />
      )}

      {editingPayout && (
        <PayoutDetails
          user={user}
          onClose={() => setEditingPayout(false)}
          onSaved={(updated) => {
            onUserChange(updated)
            setEditingPayout(false)
          }}
        />
      )}

      {applying && (
        <GuideVerification
          onClose={() => setApplying(false)}
          onSubmitted={handleApplicationSubmitted}
        />
      )}

      {tripFormState && (
        <TripForm
          trip={tripFormState.trip}
          onClose={() => setTripFormState(null)}
          onSaved={handleTripSaved}
        />
      )}

      {selectedTrip && (
        <TripDetail
          trip={selectedTrip}
          user={user}
          booking={bookings.find(
            (b) => b.trip.id === selectedTrip.id && b.status !== 'cancelled',
          )}
          showStatus={selectedTrip.guide?.id === user?.id}
          onApply={(trip) => {
            if (!signedIn) return onSignIn('login')
            setSelectedTrip(null)
            setBookingTrip(trip)
          }}
          onMessageGuide={(trip) =>
            signedIn ? chat.openChatWith(trip.guide.id, trip.id) : onSignIn('login')
          }
          onCancelBooking={signedIn ? handleCancelBooking : undefined}
          onClose={() => setSelectedTrip(null)}
        />
      )}

      {bookingTrip && (
        <BookTrip
          trip={bookingTrip}
          user={user}
          onClose={() => setBookingTrip(null)}
          onBooked={handleBooked}
        />
      )}

      {applicantsTrip && (
        <TripApplicants
          trip={applicantsTrip}
          onClose={() => setApplicantsTrip(null)}
          onChanged={loadMyTrips}
          onMessage={(booking) => chat.openChatWith(booking.bookedBy.id, applicantsTrip.id)}
        />
      )}

      {composingBlog && (
        <BlogComposer
          onClose={() => setComposingBlog(false)}
          onPosted={() => {
            setComposingBlog(false)
            loadBlogs()
          }}
        />
      )}

      {viewingAllBlogs && (
        <BlogsAllOverlay
          blogs={blogs}
          onSelect={setViewingBlog}
          onClose={() => setViewingAllBlogs(false)}
        />
      )}

      {viewingBlog && (
        <BlogDetailOverlay
          blog={viewingBlog}
          currentUser={user}
          onRequireAuth={() => onSignIn('login')}
          onVoted={(updated) =>
            setBlogs((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
          }
          onClose={() => setViewingBlog(null)}
          onDeleted={() => {
            setViewingBlog(null)
            setViewingAllBlogs(false)
            loadBlogs()
          }}
        />
      )}

      {chat.inboxOpen && (
        <MessagesInbox
          onOpen={chat.setChatId}
          onClose={() => {
            chat.setInboxOpen(false)
            refreshUnread()
          }}
        />
      )}

      {chat.chatId && (
        <ChatThread
          conversationId={chat.chatId}
          onClose={() => {
            chat.setChatId(null)
            refreshUnread()
          }}
        />
      )}

      {chat.error && (
        <button type="button" className="chat-toast" onClick={() => chat.setError('')}>
          {chat.error}
        </button>
      )}
    </div>
  )
}

function CreateOption({ Icon, title, text, onClick }) {
  return (
    <button type="button" className="sheet-option create-option" onClick={onClick}>
      <span className="create-option-icon">
        <Icon />
      </span>
      <span className="create-option-text">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <ChevronRightIcon />
    </button>
  )
}

function NavButton({ tab, active, onClick }) {
  const { Icon, label } = tab
  return (
    <button
      type="button"
      className={`nav-btn${active ? ' nav-btn-active' : ''}`}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <Icon />
    </button>
  )
}

/**
 * The home feed's headline card: a full-bleed cover with the trip's details on
 * a card that floats over the bottom of the image.
 */
function HeroTripCard({ trip, onSelect }) {
  const seatsLeft = trip.seatsLeft ?? trip.maxGroupSize
  const now = useNow()

  return (
    <article className="hero-card">
      <div className="hero-media">
        <TripCover trip={trip} />
        <span className="hero-tag">{trip.category}</span>
      </div>

      <div className="hero-panel">
        <p className="hero-destination">{trip.destination}</p>
        <h3 className="hero-title">{trip.title}</h3>
        {trip.startDate && (
          <p className="hero-dates">
            {formatDateRange(trip.startDate, trip.endDate)}
            <span>{tripCountdown(trip, now)}</span>
          </p>
        )}

        <div className="hero-meta">
          {trip.reviewCount > 0 ? (
            <>
              <span className="hero-rating">
                <StarIcon />
                {trip.rating.toFixed(1)}
              </span>
              <span>{trip.reviewCount} reviews</span>
            </>
          ) : (
            <span>{formatPrice(trip)}</span>
          )}
          <span className="hero-seats">
            {seatsLeft} {seatsLeft === 1 ? 'seat' : 'seats'} left
          </span>
        </div>

        <button type="button" className="hero-cta" onClick={onSelect}>
          <span>See more</span>
          <span className="hero-cta-arrow" aria-hidden="true">
            <ChevronRightIcon />
          </span>
        </button>
      </div>
    </article>
  )
}

function TripRow({ trip, onClick, showStatus }) {
  return (
    <button type="button" className="trip-row" onClick={onClick}>
      <div className="trip-thumb trip-thumb-sm">
        <TripThumbImage trip={trip} />
      </div>
      <div className="trip-row-info">
        <h3 className="trip-row-title">{trip.title}</h3>
        <p className="trip-row-location">
          {trip.startDate ? `${formatDateRange(trip.startDate, trip.endDate)} · ` : ''}
          {trip.destination}
        </p>
        <div className="trip-row-meta">
          {showStatus ? <StatusPill status={trip.status} /> : <RatingBadge rating={trip.rating} />}
          <span>
            {showStatus ? formatPrice(trip) : `By ${trip.guide.name}`}
            {!showStatus && trip.guide.verified && (
              <span className="verified-badge verified-badge-sm" title="Verified guide">
                <VerifiedIcon />
              </span>
            )}
          </span>
        </div>
      </div>
    </button>
  )
}

function ExploreTab({ onSelectTrip }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const timer = setTimeout(() => {
      api
        .listTrips({ q: query.trim(), category })
        .then(({ trips }) => !cancelled && setResults(trips))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setLoading(false))
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, category])

  return (
    <div className="explore-view">
      <div className="search-bar">
        <SearchIcon />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search trips or destinations"
        />
      </div>

      <div className="scroll-row explore-category-row">
        {TRIP_CATEGORIES.map(({ label }) => (
          <button
            key={label}
            type="button"
            className={`chip${category === label ? ' chip-active' : ''}`}
            aria-pressed={category === label}
            onClick={() => setCategory((prev) => (prev === label ? null : label))}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="trip-list explore-results">
        {loading && <p className="trip-list-empty">Searching…</p>}
        {!loading && results.length === 0 && (
          <p className="trip-list-empty">No trips match your search.</p>
        )}
        {results.map((trip) => (
          <TripRow key={trip.id} trip={trip} onClick={() => onSelectTrip(trip)} />
        ))}
      </div>
    </div>
  )
}

/**
 * "My Trips" is the traveler's own history — the trips they booked and
 * attended. A verified guide can switch to the listings they publish, which is
 * a separate concept with its own lifecycle controls (doc §5 steps 5–9).
 */
function MyTripsTab({
  user,
  bookings,
  loadingBookings,
  listings,
  onSelectTrip,
  onCreateTrip,
  onEditTrip,
  onStatusChange,
  onDuplicate,
  onDelete,
  onExplore,
  onViewApplicants,
}) {
  const [segment, setSegment] = useState('attending')
  const showSegments = user.canPostTrips
  const active = showSegments ? segment : 'attending'
  const pendingTotal = listings.reduce((sum, trip) => sum + (trip.pendingRequests ?? 0), 0)

  return (
    <div className="my-trips-view">
      {showSegments && (
        <div className="segmented" role="tablist" aria-label="My trips">
          <button
            type="button"
            role="tab"
            aria-selected={active === 'attending'}
            className={`segment${active === 'attending' ? ' segment-active' : ''}`}
            onClick={() => setSegment('attending')}
          >
            Attending
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={active === 'listings'}
            className={`segment${active === 'listings' ? ' segment-active' : ''}`}
            onClick={() => setSegment('listings')}
          >
            My listings
            {pendingTotal > 0 && <span className="pending-badge">{pendingTotal}</span>}
          </button>
        </div>
      )}

      {active === 'attending' ? (
        <AttendingList
          bookings={bookings}
          loading={loadingBookings}
          onSelectTrip={onSelectTrip}
          onExplore={onExplore}
        />
      ) : (
        <ListingsList
          listings={listings}
          onSelectTrip={onSelectTrip}
          onCreateTrip={onCreateTrip}
          onEditTrip={onEditTrip}
          onStatusChange={onStatusChange}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onViewApplicants={onViewApplicants}
        />
      )}
    </div>
  )
}

function AttendingList({ bookings, loading, onSelectTrip, onExplore }) {
  const upcoming = bookings.filter((b) => b.status === 'pending' || b.status === 'confirmed')
  const past = bookings.filter((b) => b.status === 'completed')
  const cancelled = bookings.filter((b) => b.status === 'cancelled')

  if (loading) {
    return <p className="trip-list-empty">Loading your trips…</p>
  }

  if (bookings.length === 0) {
    return (
      <div className="empty-state">
        <TripsIcon />
        <p>You haven&apos;t been on a trip yet.</p>
        <p className="field-hint">Trips you book will show up here, along with the ones you&apos;ve completed.</p>
        <button type="button" className="submit empty-state-cta" onClick={onExplore}>
          Explore trips
        </button>
      </div>
    )
  }

  return (
    <>
      <BookingGroup title="Upcoming" bookings={upcoming} onSelectTrip={onSelectTrip} />
      <BookingGroup title="Attended" bookings={past} onSelectTrip={onSelectTrip} />
      <BookingGroup title="Cancelled" bookings={cancelled} onSelectTrip={onSelectTrip} />
    </>
  )
}

function BookingGroup({ title, bookings, onSelectTrip }) {
  if (bookings.length === 0) return null

  return (
    <section className="trip-list-section">
      <h2 className="section-title">
        {title} <span className="section-count">{bookings.length}</span>
      </h2>
      <div className="trip-list">
        {bookings.map((booking) => (
          <BookingRow
            key={booking.id}
            booking={booking}
            onClick={() => onSelectTrip(booking.trip)}
          />
        ))}
      </div>
    </section>
  )
}

function BookingRow({ booking, onClick }) {
  const { trip } = booking
  const status = BOOKING_STATUS[booking.status]
  const now = useNow()
  const date = trip.startDate
    ? `${formatDateRange(trip.startDate, trip.endDate)}${
        booking.status === 'pending' || booking.status === 'confirmed' ? ` · ${tripCountdown(trip, now)}` : ''
      }`
    : `Booked ${timeAgo(booking.bookedAt, now)}`

  return (
    <button type="button" className="trip-row" onClick={onClick}>
      <div className="trip-thumb trip-thumb-sm">
        <TripThumbImage trip={trip} />
      </div>
      <div className="trip-row-info">
        <h3 className="trip-row-title">{trip.title}</h3>
        <p className="trip-row-location">{trip.destination}</p>
        <div className="trip-row-meta">
          <span className={`status-pill status-tone-${status.tone}`}>{status.label}</span>
          <span>
            {booking.travelers} {booking.travelers === 1 ? 'traveler' : 'travelers'} · {date}
          </span>
        </div>
      </div>
    </button>
  )
}

function ListingsList({
  listings,
  onSelectTrip,
  onCreateTrip,
  onEditTrip,
  onStatusChange,
  onDuplicate,
  onDelete,
  onViewApplicants,
}) {
  const [cancelling, setCancelling] = useState(null)

  if (listings.length === 0) {
    return (
      <div className="empty-state">
        <p>You haven&apos;t posted any trips yet.</p>
        <button type="button" className="submit empty-state-cta" onClick={onCreateTrip}>
          Create a trip
        </button>
      </div>
    )
  }

  return (
    <div className="trip-list-section my-trips">
      <div className="trip-list">
        {listings.map((trip) => (
          <div key={trip.id} className="my-trip-item">
            <TripRow trip={trip} showStatus onClick={() => onSelectTrip(trip)} />
            <div className="trip-actions">
              <button
                type="button"
                className={`ghost-btn${trip.pendingRequests > 0 ? ' ghost-btn-accent' : ''}`}
                onClick={() => onViewApplicants(trip)}
              >
                Applicants
                {trip.pendingRequests > 0 && (
                  <span className="pending-badge">{trip.pendingRequests}</span>
                )}
              </button>

              {STATUS_ACTIONS[trip.status].map((action) => (
                <button
                  key={action.status}
                  type="button"
                  className="ghost-btn"
                  onClick={() => onStatusChange(trip, action.status)}
                >
                  {action.label}
                </button>
              ))}

              {!['ongoing', 'completed', 'archived', 'cancelled'].includes(trip.status) && (
                <button type="button" className="ghost-btn" onClick={() => onEditTrip(trip)}>
                  Edit
                </button>
              )}

              <button type="button" className="ghost-btn" onClick={() => onDuplicate(trip)}>
                Duplicate
              </button>

              {CANCELLABLE.includes(trip.status) && (
                <button
                  type="button"
                  className="ghost-btn danger"
                  onClick={() => setCancelling(trip)}
                >
                  Cancel
                </button>
              )}

              {trip.status === 'draft' && (
                <button type="button" className="ghost-btn danger" onClick={() => onDelete(trip)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {cancelling && (
        <CancelTripSheet
          trip={cancelling}
          onClose={() => setCancelling(null)}
          onConfirm={async (reason) => {
            await onStatusChange(cancelling, 'cancelled', reason)
            setCancelling(null)
          }}
        />
      )}
    </div>
  )
}

function CancelTripSheet({ trip, onClose, onConfirm }) {
  const [reason, setReason] = useState('')

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h3 className="sheet-title">Cancel “{trip.title}”</h3>
        <div className="sheet-body">
          <p className="field-hint">
            Travelers with a booking are notified and refunded under the trip&apos;s cancellation
            policy. This cannot be undone.
          </p>
          <label className="field">
            <span className="field-label">Reason</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Let travelers know why"
            />
          </label>
          <div className="decision-row">
            <button type="button" className="ghost-btn" onClick={onClose}>
              Keep trip
            </button>
            <button type="button" className="ghost-btn danger" onClick={() => onConfirm(reason)}>
              Cancel trip
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditProfileOverlay({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: user.name ?? '',
    age: user.age ?? '',
    phone: user.phone ?? '',
    address: user.address ?? '',
    bio: user.bio ?? '',
  })
  const [interests, setInterests] = useState(user.interests ?? [])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  function toggleInterest(value) {
    setError('')
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim() || !form.age || !form.phone.trim() || !form.address.trim()) {
      return setError('Please fill in all fields')
    }
    if (interests.length === 0) return setError('Select at least one travel interest')

    setSaving(true)
    try {
      const { user: updated } = await api.updateProfile({
        name: form.name.trim(),
        age: Number(form.age),
        phone: form.phone.trim(),
        address: form.address.trim(),
        bio: form.bio.trim(),
        interests,
        languages: user.languages,
      })
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
        <h2 className="edit-header-title">Edit profile</h2>
        <button type="button" className="edit-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div className="edit-body">
        <form className="form" onSubmit={handleSave}>
          <label className="field">
            <span className="field-label">Full name</span>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Age</span>
            <input
              type="number"
              name="age"
              value={form.age}
              onChange={handleChange}
              min="1"
              max="120"
              required
            />
          </label>

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

          <label className="field">
            <span className="field-label">Address</span>
            <textarea
              name="address"
              value={form.address}
              onChange={handleChange}
              rows={2}
              required
            />
          </label>

          {user.guideStatus === 'verified' && (
            <label className="field">
              <span className="field-label">Guide bio</span>
              <textarea
                name="bio"
                value={form.bio}
                onChange={handleChange}
                rows={3}
                placeholder="Shown to travelers on your trips"
              />
            </label>
          )}

          <div className="field">
            <span className="field-label">Travel interests</span>
            <div className="chip-group">
              {TRAVEL_INTERESTS.map((interest) => (
                <button
                  key={interest}
                  type="button"
                  className={`chip${interests.includes(interest) ? ' chip-active' : ''}`}
                  aria-pressed={interests.includes(interest)}
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
        </form>
      </div>
    </div>
  )
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <span className="toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </span>
  )
}
