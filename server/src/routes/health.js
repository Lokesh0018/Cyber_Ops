import { Router } from 'express'
import { checkConnection } from '../config/db.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    await checkConnection()
    res.json({ status: 'ok', db: 'connected' })
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: err.message })
  }
})

export default router
