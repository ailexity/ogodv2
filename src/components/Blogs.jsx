import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import { getInitials } from './TripDetail.jsx'
import {
  CloseIcon,
  ImageIcon,
  MessageIcon,
  ThumbDownIcon,
  ThumbUpIcon,
  VerifiedIcon,
} from './icons.jsx'
import { timeAgo } from '../data/dates.js'
import { useNow } from '../hooks/useNow.js'

/** The horizontally-scrolling "Travel stories" strip on the home feed. */
export function BlogsSection({ blogs, loading, onCompose, onSelect, onSeeAll }) {
  return (
    <section className="blogs-section" data-tour="stories">
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

/**
 * Upvote / dislike. Pressing your current choice again clears it. Signed-out
 * visitors are asked to sign in first.
 */
export function BlogVotes({ blog, currentUser, onVoted, onRequireAuth, compact = false }) {
  const [busy, setBusy] = useState(false)

  async function vote(value) {
    if (!currentUser) return onRequireAuth?.()
    if (busy) return
    setBusy(true)
    try {
      const { blog: updated } = await api.voteBlog(blog.id, blog.myVote === value ? 0 : value)
      onVoted?.(updated)
    } catch {
      // A failed vote just leaves the counts as they were.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`blog-votes${compact ? ' blog-votes-compact' : ''}`}>
      <button
        type="button"
        className={`vote-btn${blog.myVote === 1 ? ' vote-btn-active' : ''}`}
        aria-pressed={blog.myVote === 1}
        aria-label={`Upvote (${blog.upvotes})`}
        onClick={(e) => {
          e.stopPropagation()
          vote(1)
        }}
      >
        <ThumbUpIcon />
        <span>{blog.upvotes}</span>
      </button>
      <button
        type="button"
        className={`vote-btn${blog.myVote === -1 ? ' vote-btn-active' : ''}`}
        aria-pressed={blog.myVote === -1}
        aria-label={`Dislike (${blog.downvotes})`}
        onClick={(e) => {
          e.stopPropagation()
          vote(-1)
        }}
      >
        <ThumbDownIcon />
        <span>{blog.downvotes}</span>
      </button>
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
        <p className="blog-card-votes" aria-label={`${blog.upvotes} upvotes, ${blog.downvotes} dislikes`}>
          <ThumbUpIcon /> {blog.upvotes}
          <ThumbDownIcon /> {blog.downvotes}
        </p>
      </div>
    </button>
  )
}

/** Full-screen story: media, byline, and body text. Owner (or admin) may delete it. */
export function BlogDetailOverlay({
  blog: initialBlog,
  currentUser,
  onClose,
  onDeleted,
  onVoted,
  onRequireAuth,
  onMessageAuthor,
}) {
  const [blog, setBlog] = useState(initialBlog)
  const [error, setError] = useState('')
  const now = useNow()
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
          <span className="blog-detail-date">{timeAgo(blog.createdAt, now)}</span>
        </p>

        {onMessageAuthor && currentUser?.id !== blog.author.id && (
          <button type="button" className="ghost-btn blog-message" onClick={() => onMessageAuthor(blog)}>
            <MessageIcon />
            Message {blog.author.name.split(' ')[0]}
          </button>
        )}

        <p className="blog-detail-content">{blog.content}</p>

        <BlogVotes
          blog={blog}
          currentUser={currentUser}
          onRequireAuth={onRequireAuth}
          onVoted={(updated) => {
            setBlog(updated)
            onVoted?.(updated)
          }}
        />

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
const MAX_MEDIA_BYTES = 25 * 1024 * 1024

export function BlogComposer({ onClose, onPosted }) {
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  function pickFile(e) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (picked.size > MAX_MEDIA_BYTES) return setError('Photos and videos must be 25 MB or smaller')
    setError('')
    setFile(picked)
  }

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

          <div className="field">
            <span className="field-label">
              Photo or video <span className="upload-optional">Optional</span>
            </span>
            {file ? (
              <div className="media-preview">
                {file.type.startsWith('video/') ? (
                  <video src={previewUrl} controls muted playsInline />
                ) : (
                  <img src={previewUrl} alt="Selected photo" />
                )}
                <button type="button" className="media-remove" onClick={() => setFile(null)}>
                  Remove
                </button>
              </div>
            ) : (
              <label className="media-picker">
                <span className="media-picker-icon">
                  <ImageIcon />
                </span>
                <span className="media-picker-text">
                  <strong>Add a photo or video</strong>
                  <span>JPG, PNG, WEBP, MP4, WEBM or MOV · up to 25 MB</span>
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                  hidden
                  onChange={pickFile}
                />
              </label>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="submit" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post story'}
          </button>
        </form>
      </div>
    </div>
  )
}
