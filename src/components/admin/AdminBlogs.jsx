import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { getInitials } from '../TripDetail.jsx'

export default function AdminBlogs() {
  const [blogs, setBlogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { blogs: rows } = await api.adminListBlogs()
      setBlogs(rows)
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

  async function run(id, action) {
    setBusyId(id)
    try {
      await action()
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(blog) {
    if (confirmDeleteId !== blog.id) {
      setConfirmDeleteId(blog.id)
      return
    }
    setConfirmDeleteId(null)
    await run(blog.id, () => api.deleteBlog(blog.id))
  }

  return (
    <div className="console-sections">
      <section>
        <h2 className="console-section-title">Travel stories</h2>
        <p className="console-section-hint">Hide a story to pull it from the home feed without deleting it.</p>

        {error && <p className="form-error">{error}</p>}
        {loading && <p className="console-empty">Loading stories…</p>}
        {!loading && blogs.length === 0 && <p className="console-empty">No stories have been posted yet.</p>}

        {!loading && blogs.length > 0 && (
          <div className="table-wrap">
            <table className="console-table">
              <thead>
                <tr>
                  <th>Story</th>
                  <th>Author</th>
                  <th>Status</th>
                  <th>Posted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {blogs.map((blog) => (
                  <tr key={blog.id}>
                    <td>
                      <div className="table-account">
                        {blog.mediaUrl ? (
                          <span className="console-avatar sm blog-admin-thumb">
                            {blog.mediaType === 'video' ? (
                              <video src={blog.mediaUrl} muted />
                            ) : (
                              <img src={blog.mediaUrl} alt="" />
                            )}
                          </span>
                        ) : (
                          <span className="console-avatar sm">{getInitials(blog.title)}</span>
                        )}
                        <div>
                          <span className="table-name">{blog.title}</span>
                          <span className="table-email">{blog.location || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td>{blog.author.name}</td>
                    <td>
                      <span className={`status-pill status-${blog.status === 'published' ? 'verified' : 'suspended'}`}>
                        {blog.status}
                      </span>
                    </td>
                    <td className="table-muted">{blog.createdAt?.slice(0, 10)}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={busyId === blog.id}
                        onClick={() =>
                          run(blog.id, () =>
                            blog.status === 'hidden' ? api.unhideBlog(blog.id) : api.hideBlog(blog.id),
                          )
                        }
                      >
                        {blog.status === 'hidden' ? 'Unhide' : 'Hide'}
                      </button>
                      <button
                        type="button"
                        className="ghost-btn danger"
                        disabled={busyId === blog.id}
                        onClick={() => handleDelete(blog)}
                      >
                        {confirmDeleteId === blog.id ? 'Confirm delete' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
