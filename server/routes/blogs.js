import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { db, BLOG_MEDIA_DIR } from '../db.js'
import { authenticate, optionalAuth } from '../auth.js'

const router = Router()

const ALLOWED_TYPES = {
  'image/jpeg': { ext: '.jpg', kind: 'image' },
  'image/png': { ext: '.png', kind: 'image' },
  'image/webp': { ext: '.webp', kind: 'image' },
  'video/mp4': { ext: '.mp4', kind: 'video' },
  'video/webm': { ext: '.webm', kind: 'video' },
  'video/quicktime': { ext: '.mov', kind: 'video' },
}

const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, BLOG_MEDIA_DIR),
    filename: (_req, file, cb) =>
      cb(null, randomBytes(16).toString('hex') + ALLOWED_TYPES[file.mimetype].ext),
  }),
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      const error = new Error('Attach a JPG, PNG or WEBP photo, or an MP4, WEBM or MOV video')
      error.expose = true
      cb(error)
      return
    }
    cb(null, true)
  },
})

export const BLOG_QUERY = `
  SELECT b.*, u.name AS author_name, u.email AS author_email, u.guide_status AS author_guide_status
    FROM blogs b
    JOIN users u ON u.id = b.author_id
`

export function mapBlog(row) {
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    location: row.location,
    mediaType: row.media_type,
    mediaUrl: row.media_url,
    status: row.status,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      name: row.author_name,
      email: row.author_email,
      verified: row.author_guide_status === 'verified',
    },
  }
}

/** Home-feed: published stories only, newest first. */
router.get('/', optionalAuth, (req, res) => {
  const { location, author } = req.query
  const clauses = ["b.status = 'published'"]
  const params = []

  if (location) {
    clauses.push('b.location LIKE ?')
    params.push(`%${location}%`)
  }
  if (author) {
    clauses.push('b.author_id = ?')
    params.push(Number(author))
  }

  const rows = db
    .prepare(`${BLOG_QUERY} WHERE ${clauses.join(' AND ')} ORDER BY b.created_at DESC`)
    .all(...params)

  res.json({ blogs: rows.map(mapBlog) })
})

/** The signed-in user's own stories, including any an admin has hidden. */
router.get('/mine', authenticate, (req, res) => {
  const rows = db
    .prepare(`${BLOG_QUERY} WHERE b.author_id = ? ORDER BY b.created_at DESC`)
    .all(req.user.id)

  res.json({ blogs: rows.map(mapBlog) })
})

/** Story media is shown on the public home feed, so it is served with no auth gate. */
router.get('/media/:filename', (req, res) => {
  const { filename } = req.params
  if (!/^[a-f0-9]{32}\.(jpg|png|webp|mp4|webm|mov)$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid media reference' })
  }

  res.sendFile(path.join(BLOG_MEDIA_DIR, filename), (error) => {
    if (error && !res.headersSent) res.status(404).json({ error: 'Media not found' })
  })
})

router.get('/:id', optionalAuth, (req, res) => {
  const row = db.prepare(`${BLOG_QUERY} WHERE b.id = ?`).get(Number(req.params.id))
  if (!row) return res.status(404).json({ error: 'Story not found' })

  const isOwner = req.user?.id === row.author_id
  const isAdmin = req.user?.role === 'admin'
  if (row.status !== 'published' && !isOwner && !isAdmin) {
    return res.status(404).json({ error: 'Story not found' })
  }

  res.json({ blog: mapBlog(row) })
})

/** Any signed-in traveler, guide or admin can share a story from their trips. */
router.post('/', authenticate, upload.single('media'), (req, res) => {
  const title = String(req.body?.title ?? '').trim()
  const content = String(req.body?.content ?? '').trim()
  const location = String(req.body?.location ?? '').trim() || null

  if (!title) return res.status(400).json({ error: 'Give your story a title' })
  if (!content) return res.status(400).json({ error: 'Write something about the trip' })

  const file = req.file
  const media = file ? ALLOWED_TYPES[file.mimetype] : null
  const mediaUrl = file ? `/api/blogs/media/${file.filename}` : null

  const result = db
    .prepare(
      `INSERT INTO blogs (author_id, title, content, location, media_type, media_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(req.user.id, title, content, location, media?.kind ?? null, mediaUrl)

  const row = db.prepare(`${BLOG_QUERY} WHERE b.id = ?`).get(result.lastInsertRowid)
  res.status(201).json({ blog: mapBlog(row) })
})

/** The author can remove their own story; an admin can remove any of them. */
router.delete('/:id', authenticate, (req, res) => {
  const blog = db.prepare('SELECT * FROM blogs WHERE id = ?').get(Number(req.params.id))
  if (!blog) return res.status(404).json({ error: 'Story not found' })
  if (blog.author_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'This is not your story' })
  }

  db.prepare('DELETE FROM blogs WHERE id = ?').run(blog.id)
  res.json({ ok: true })
})

export default router
