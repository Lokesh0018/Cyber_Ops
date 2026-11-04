import cors from 'cors'
import express from 'express'
import { checkConnection } from './config/db.js'
import healthRouter from './routes/health.js'

const app = express()
const PORT = Number(process.env.PORT ?? 5000)

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/health', healthRouter)

app.listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`)
  try {
    await checkConnection()
    console.log(`MySQL connected → ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`)
  } catch (err) {
    console.error(`MySQL connection failed: ${err.message}`)
  }
})
