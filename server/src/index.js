import compression from 'compression'
import cors from 'cors'
import express from 'express'
import { checkConnection } from './config/db.js'
import { ensureSchema } from './config/schema.js'
import adminRouter from './routes/admin.js'
import authRouter from './routes/auth.js'
import flagsRouter from './routes/flags.js'
import healthRouter from './routes/health.js'

const app = express()
const PORT = Number(process.env.PORT ?? 5000)

app.disable('x-powered-by')
// Behind a reverse proxy / load balancer set TRUST_PROXY=1 so rate limits see the real client IP instead of the proxy's.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY)

// Cheap, safe defaults for a JSON API.
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-site',
  })
  next()
})
app.use(compression()) // gzip JSON responses (the leaderboard and admin lists are the big ones)
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json({ limit: '20kb' })) // every request body here is a few hundred bytes at most

app.use('/api/health', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/flags', flagsRouter)
app.use('/api/admin', adminRouter)
app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found.' }))

// Central error handler: log server faults, return a safe message. Client errors (bad JSON, body too large) are 4xx, not 500.
app.use((err, _req, res, _next) => {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500
  if (status === 500) console.error(err)
  res.status(status).json({ message: status === 500 ? 'Something went wrong. Please try again.' : 'Invalid request.' })
})

app.listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`)
  try {
    await checkConnection()
    await ensureSchema()
    console.log(`MySQL connected → ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`)
  } catch (err) {
    console.error(`MySQL connection failed: ${err.message}`)
  }
})
