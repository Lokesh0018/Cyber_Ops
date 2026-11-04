import { Router } from 'express'
import { pool } from '../config/db.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { issueToken, requireAuth } from '../lib/token.js'

const router = Router()

export const LEVELS = ['Student', 'Fresher', 'Working professional', 'Educator']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,18}$/

const publicStudent = (row) => ({
  id: row.id,
  fullName: row.full_name,
  email: row.email,
  phone: row.phone,
  institution: row.institution,
  level: row.level,
  createdAt: row.created_at,
})

/** Field-level validation; returns {field: message} (empty when valid). */
function validateRegistration(b) {
  const errors = {}
  if (!b.fullName || b.fullName.trim().length < 2) errors.fullName = 'Enter your full name.'
  if (!EMAIL_RE.test(b.email ?? '')) errors.email = 'Enter a valid email address.'
  if (!PHONE_RE.test(b.phone ?? '')) errors.phone = 'Enter a valid phone number.'
  if (!b.institution || b.institution.trim().length < 2) errors.institution = 'Enter your college or organisation.'
  if (!LEVELS.includes(b.level)) errors.level = 'Choose an option.'
  if (!b.password || b.password.length < 8) errors.password = 'Use at least 8 characters.'
  return errors
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const b = req.body ?? {}
    const errors = validateRegistration(b)
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Please fix the highlighted fields.', errors })

    const email = b.email.trim().toLowerCase()
    const [dupes] = await pool.query('SELECT id FROM students WHERE email = ? LIMIT 1', [email])
    if (dupes.length) {
      return res.status(409).json({ message: 'This email is already registered.', errors: { email: 'Already registered — try logging in.' } })
    }

    const passwordHash = await hashPassword(b.password)
    const [result] = await pool.query(
      'INSERT INTO students (full_name, email, phone, institution, level, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
      [b.fullName.trim(), email, b.phone.trim(), b.institution.trim(), b.level, passwordHash],
    )
    const [[row]] = await pool.query('SELECT * FROM students WHERE id = ?', [result.insertId])
    res.status(201).json({ token: issueToken(row.id), student: publicStudent(row) })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const password = String(req.body?.password ?? '')
    if (!EMAIL_RE.test(email) || !password) {
      return res.status(422).json({ message: 'Enter your email and password.' })
    }
    const [[row]] = await pool.query('SELECT * FROM students WHERE email = ? LIMIT 1', [email])
    // Same message for unknown email and wrong password, so accounts can't be enumerated.
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return res.status(401).json({ message: 'Incorrect email or password.' })
    }
    res.json({ token: issueToken(row.id), student: publicStudent(row) })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me — current student from the bearer token
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM students WHERE id = ? LIMIT 1', [req.studentId])
    if (!row) return res.status(401).json({ message: 'Please log in.' })
    res.json({ student: publicStudent(row) })
  } catch (err) {
    next(err)
  }
})

export default router
