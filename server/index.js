import os from 'node:os'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import authRoutes from './routes/auth.js'
import guideRoutes from './routes/guides.js'
import adminRoutes from './routes/admin.js'
import tripRoutes from './routes/trips.js'
import bookingRoutes from './routes/bookings.js'
import blogRoutes from './routes/blogs.js'
import messageRoutes from './routes/messages.js'
import wishlistRoutes from './routes/wishlist.js'

const app = express()
const PORT = Number(process.env.PORT ?? 4000)
const HOST = process.env.HOST ?? '0.0.0.0'

// Rate limits key on the client IP. Behind a reverse proxy, set OGOD_TRUST_PROXY
// (e.g. "1" for one hop) so req.ip is the visitor, not the proxy.
const trustProxy = process.env.OGOD_TRUST_PROXY ?? 'loopback'
app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy)

// Same-origin deployments (nginx in front) need no CORS. In production it is off
// unless OGOD_CORS_ORIGIN lists the allowed origins, comma-separated.
const corsOrigin = process.env.OGOD_CORS_ORIGIN
app.use(
  cors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((origin) => origin.trim())
      : process.env.NODE_ENV !== 'production',
  }),
)
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRoutes)
app.use('/api/guides', guideRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/trips', tripRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/blogs', blogRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/wishlist', wishlistRoutes)

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

// Print the addresses the API is actually reachable on, instead of assuming one.
function listenUrls(host, port) {
  if (host !== '0.0.0.0' && host !== '::') return [`http://${host}:${port}`]
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => `http://${iface.address}:${port}`)
  return [`http://localhost:${port}`, ...lan]
}

app.listen(PORT, HOST, () => {
  console.log('OGod API listening on:')
  for (const url of listenUrls(HOST, PORT)) console.log(`  ${url}`)
})
