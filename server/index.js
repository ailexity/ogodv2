import express from 'express'
import cors from 'cors'
import multer from 'multer'
import authRoutes from './routes/auth.js'
import guideRoutes from './routes/guides.js'
import adminRoutes from './routes/admin.js'
import tripRoutes from './routes/trips.js'
import bookingRoutes from './routes/bookings.js'
import blogRoutes from './routes/blogs.js'

const app = express()
const PORT = Number(process.env.PORT ?? 4000)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRoutes)
app.use('/api/guides', guideRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/trips', tripRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/blogs', blogRoutes)

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE' ? 'The uploaded file is too large' : 'Invalid upload'
    return res.status(400).json({ error: message })
  }
  // Only errors we raised deliberately are safe to show — anything else could
  // leak database or filesystem internals.
  if (error?.expose) return res.status(error.status ?? 400).json({ error: error.message })

  console.error(error)
  res.status(500).json({ error: 'Something went wrong' })
})

// app.listen(PORT, () => {
//   console.log(`OGod API listening on http://localhost:${PORT}`)
// })

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OGod API listening on http://172.20.10.3:${PORT}`)
})
