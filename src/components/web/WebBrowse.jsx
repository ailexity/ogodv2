import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { BlogDetailOverlay, BlogVotes } from '../Blogs.jsx'
import { TRIP_CATEGORIES } from '../../data/categories.js'
import { FILTERS } from '../Home.jsx'
import { SearchIcon, ShieldIcon, CheckIcon, CompassIcon } from '../icons.jsx'
import WebTripCard from './WebTripCard.jsx'

const STEPS = [
  {
    Icon: CompassIcon,
    title: 'Find a trip',
    text: 'Browse small-group trips by place, style, budget and language.',
  },
  {
    Icon: ShieldIcon,
    title: 'Travel with a verified guide',
    text: 'Every guide passes an ID, address and licence review before they can list a trip.',
  },
  {
    Icon: CheckIcon,
    title: 'Book and pay the guide',
    text: 'Send a request, pay your guide directly, and get your PDF ticket once they confirm.',
  },
]

export default function WebBrowse({ user, onSignIn }) {
  const [blogs, setBlogs] = useState([])
  const [openBlog, setOpenBlog] = useState(null)

  useEffect(() => {
    api
      .listBlogs()
      .then(({ blogs: rows }) => setBlogs(rows))
      .catch(() => setBlogs([]))
  }, [user])

  function updateBlog(updated) {
    setBlogs((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
  }

  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [filters, setFilters] = useState({})
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .listTrips({ q: search, category, ...filters })
      .then(({ trips: rows }) => {
        if (cancelled) return
        setTrips(rows)
        setError('')
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [search, category, filters])

  function setFilter(key, value) {
    setFilters((prev) => {
      const next = { ...prev }
      if (value === '') delete next[key]
      else next[key] = value
      return next
    })
  }

  const filtered = Boolean(search || category || Object.keys(filters).length)

  function clearAll() {
    setQuery('')
    setSearch('')
    setCategory('')
    setFilters({})
  }

  return (
    <>
      <section className="web-hero">
        <div className="web-container web-hero-inner">
          <div className="web-hero-copy">
            <h1>Travel with people who know the way.</h1>
            <p>Small-group trips led by verified local guides. No app needed — book right here.</p>
            <form
              className="web-search"
              onSubmit={(e) => {
                e.preventDefault()
                setSearch(query.trim())
              }}
            >
              <SearchIcon />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Where do you want to go?"
                aria-label="Search trips by title or destination"
              />
              <button type="submit" className="web-btn">
                Search
              </button>
            </form>
          </div>
          <div className="web-hero-image" aria-hidden="true" />
        </div>
      </section>

      <section className="web-container web-section" id="trips">
        <div className="web-categories" role="group" aria-label="Trip categories">
          <button
            type="button"
            className={`chip${category === '' ? ' chip-active' : ''}`}
            onClick={() => setCategory('')}
          >
            All trips
          </button>
          {TRIP_CATEGORIES.map(({ label, Icon }) => (
            <button
              key={label}
              type="button"
              className={`chip web-category${category === label ? ' chip-active' : ''}`}
              onClick={() => setCategory(category === label ? '' : label)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>

        <div className="web-filters">
          {FILTERS.map((filter) => (
            <label key={filter.key} className="web-select">
              <span>{filter.label}</span>
              <select
                value={filters[filter.key] ?? ''}
                onChange={(e) => setFilter(filter.key, e.target.value)}
              >
                <option value="">Any</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {filtered && (
            <button type="button" className="web-link" onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>

        <div className="web-results-head">
          <h2>{search ? `Trips matching “${search}”` : category || 'All trips'}</h2>
          {!loading && <span className="web-faint">{trips.length} {trips.length === 1 ? 'trip' : 'trips'}</span>}
        </div>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <div className="web-grid">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="web-card-skeleton" />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="web-empty">
            <p>No trips match that yet.</p>
            {filtered && (
              <button type="button" className="web-btn-ghost" onClick={clearAll}>
                Show all trips
              </button>
            )}
          </div>
        ) : (
          <div className="web-grid">
            {trips.map((trip) => (
              <WebTripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </section>

      {blogs.length > 0 && (
        <section className="web-container web-section web-stories">
          <div className="web-results-head">
            <h2>Travel stories</h2>
            <span className="web-faint">From travellers and guides</span>
          </div>
          <div className="web-story-grid">
            {blogs.slice(0, 6).map((blog) => (
              <article key={blog.id} className="web-story">
                <button type="button" className="web-story-open" onClick={() => setOpenBlog(blog)}>
                  <div className="web-story-media">
                    {blog.mediaType === 'video' && blog.mediaUrl ? (
                      <video src={blog.mediaUrl} muted playsInline preload="metadata" />
                    ) : blog.mediaUrl ? (
                      <img src={blog.mediaUrl} alt="" loading="lazy" />
                    ) : null}
                  </div>
                  {blog.location && <p className="web-card-place">{blog.location}</p>}
                  <h3 className="web-card-title">{blog.title}</h3>
                  <p className="web-card-meta">{blog.author.name}</p>
                </button>
                <BlogVotes
                  blog={blog}
                  currentUser={user}
                  onVoted={updateBlog}
                  onRequireAuth={() => onSignIn('login')}
                  compact
                />
              </article>
            ))}
          </div>
        </section>
      )}

      {openBlog && (
        <>
          <div className="web-drawer-backdrop" onClick={() => setOpenBlog(null)} />
          <BlogDetailOverlay
            blog={openBlog}
            currentUser={user}
            onClose={() => setOpenBlog(null)}
            onDeleted={() => {
              setBlogs((prev) => prev.filter((b) => b.id !== openBlog.id))
              setOpenBlog(null)
            }}
            onVoted={updateBlog}
            onRequireAuth={() => onSignIn('login')}
          />
        </>
      )}

      <section className="web-steps-band">
        <div className="web-container">
          <h2>How booking works</h2>
          <div className="web-steps">
            {STEPS.map(({ Icon, title, text }) => (
              <div key={title} className="web-step">
                <span className="web-step-icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
