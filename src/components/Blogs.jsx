import { useState } from 'react'
import { api } from '../api/client.js'
import { getInitials } from './TripDetail.jsx'
import { CloseIcon, VerifiedIcon } from './icons.jsx'

/** The horizontally-scrolling "Travel stories" strip on the home feed. */
export function BlogsSection({ blogs, loading, onCompose, onSelect, onSeeAll }) {
  return (
    <section className="blogs-section">
      <div className="blogs-section-header">
        <h2 className="home-heading">Travel stories</h2>
        <div className="blogs-section-actions">
          {blogs.length > 0 && (
            <button type="button" className="ghost-btn" onClick={onSeeAll}>
              See all
            </button>
          )}
          <button type="button" className="ghost-btn" onClick={onCompose}>
            Share your story
          </button>
        </div>
      </div>

      {loading && <p className="trip-list-empty">Loading stories…</p>}
      {!loading && blogs.length === 0 && (
        <p className="trip-list-empty">No stories yet — be the first to share one.</p>
      )}

      {!loading && blogs.length > 0 && (
        <div className="scroll-row blog-scroll-row">
          {blogs.map((blog) => (
            <BlogCard key={blog.id} blog={blog} onClick={() => onSelect(blog)} />
          ))}
        </div>
      )}
    </section>
  )
}

/** Full-screen list of every published story, opened from "See all". */
export function BlogsAllOverlay({ blogs, onSelect, onClose }) {
  return (
    <div className="edit-overlay">
      <header className="edit-header">
        <button type="button" className="edit-icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <h2 className="edit-header-title">All stories</h2>
        <span className="edit-header-spacer" />
      </header>

      <div className="edit-body">
        {blogs.length === 0 ? (
          <p className="trip-list-empty">No stories yet — be the first to share one.</p>
        ) : (
          <div className="blog-grid">
            {blogs.map((blog) => (
              <BlogCard key={blog.id} blog={blog} onClick={() => onSelect(blog)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BlogCard({ blog, onClick }) {
  return (
    <button type="button" className="blog-card" onClick={onClick}>
      <div className="blog-card-media">
        {blog.mediaType === 'video' && blog.mediaUrl ? (
          <video src={blog.mediaUrl} muted playsInline preload="metadata" />
        ) : blog.mediaUrl ? (
          <img src={blog.mediaUrl} alt="" loading="lazy" />
        ) : (
          <span className="blog-card-fallback" aria-hidden="true">
            {blog.title.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="blog-card-body">
        <p className="blog-card-title">{blog.title}</p>
        {blog.location && <p className="blog-card-location">{blog.location}</p>}
        <p className="blog-card-author">
          <span className="console-avatar sm">{getInitials(blog.author.name)}</span>
          {blog.author.name}
          {blog.author.verified && (
            <span className="verified-badge verified-badge-sm">
              <VerifiedIcon />
            </span>
          )}
        </p>
      </div>
    </button>
  )
}

/** Full-screen story: media, byline, and body text. Owner (or admin) may delete it. */
export function BlogDetailOverlay({ blog, currentUser, onClose, onDeleted }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const canDelete = currentUser && (currentUser.id === blog.author.id || currentUser.role === 'admin')

  async function handleDelete() {
    setBusy(true)
    setError('')
    try {
      await api.deleteBlog(blog.id)
      onDeleted(blog.id)
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
        <h2 className="edit-header-title">Story</h2>
        <span className="edit-header-spacer" />
      </header>

      <div className="edit-body">
        {blog.mediaUrl && (
          <div className="blog-detail-media">
            {blog.mediaType === 'video' ? (
              <video src={blog.mediaUrl} controls playsInline />
            ) : (
              <img src={blog.mediaUrl} alt="" />
            )}
          </div>
        )}

        <h3 className="trip-detail-title">{blog.title}</h3>
        {blog.location && <p className="trip-detail-location">{blog.location}</p>}

        <p className="blog-detail-author">
          <span className="console-avatar sm">{getInitials(blog.author.name)}</span>
          <span>
            {blog.author.name}
            {blog.author.verified && (
              <span className="verified-badge verified-badge-sm">
                <VerifiedIcon />
              </span>
            )}
          </span>
          <span className="blog-detail-date">{blog.createdAt?.slice(0, 10)}</span>
        </p>

        <p className="blog-detail-content">{blog.content}</p>

        {error && <p className="form-error">{error}</p>}

        {canDelete && (
          <button type="button" className="ghost-btn danger" onClick={handleDelete} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete story'}
          </button>
        )}
      </div>
    </div>
  )
}

/** The compose form — open to any signed-in user, with an optional photo or video. */
export function BlogComposer({ onClose, onPosted }) {
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!title.trim()) return setError('Give your story a title')
    if (!content.trim()) return setError('Write something about the trip')

    const form = new FormData()
    form.append('title', title.trim())
    form.append('content', content.trim())
    form.append('location', location.trim())
    if (file) form.append('media', file)

    setSubmitting(true)
    try {
      const { blog } = await api.createBlog(form)
      onPosted(blog)
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
        <h2 className="edit-header-title">Share your story</h2>
        <button type="button" className="edit-save-btn" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </header>

      <div className="edit-body">
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setError('')
              }}
              placeholder="e.g. Sunrise over the Himalayas"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Location</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Triund, Himachal Pradesh"
            />
          </label>

          <label className="field">
            <span className="field-label">Your story</span>
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                setError('')
              }}
              rows={6}
              placeholder="What made this trip memorable?"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Photo or video (optional)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {error && <p className="form-error">{error}</p>}
        </form>
      </div>
    </div>
  )
}
