import { createHash } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../config/db.js'
import { issueToken, requireAuth } from '../lib/token.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9]{10}$/ // 10-digit mobile number, no country code
const ROLL_RE = /^[A-Za-z0-9\-\/]{3,30}$/ // college roll number: letters, digits, - and /
const normRoll = (v) => String(v ?? '').trim().toUpperCase()
/** Opaque, stable id for a student in public lists (the email itself is the primary key and stays private). */
const publicId = (email) => createHash('sha256').update(`lb:${email}`).digest('hex').slice(0, 12)

const publicStudent = (row) => ({
  id: row.email,
  fullName: row.full_name,
  email: row.email,
  phone: row.phone,
  institution: row.institution,
  branch: row.branch,
  rollNumber: row.roll_number,
  score: row.score ?? 0,
  createdAt: row.created_at,
})

/** Field-level validation; returns {field: message} (empty when valid). */
function validateRegistration(b) {
  const errors = {}
  if (!b.fullName || b.fullName.trim().length < 2) errors.fullName = 'Enter your full name.'
  if (!EMAIL_RE.test(b.email ?? '')) errors.email = 'Enter a valid email address.'
  if (!PHONE_RE.test(b.phone ?? '')) errors.phone = 'Enter a 10-digit mobile number.'
  if (!b.institution || b.institution.trim().length < 2) errors.institution = 'Enter your college or organisation.'
  if (!b.branch || b.branch.trim().length < 2) errors.branch = 'Enter your branch / department.'
  if (!ROLL_RE.test(normRoll(b.rollNumber))) errors.rollNumber = 'Enter your roll number (3–30 letters/digits).'
  return errors
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const b = req.body ?? {}
    const errors = validateRegistration(b)
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Please fix the highlighted fields.', errors })

    const email = b.email.trim().toLowerCase()
    const [dupes] = await pool.query('SELECT email FROM students WHERE email = ? LIMIT 1', [email])
    if (dupes.length) {
      return res.status(409).json({ message: 'This email is already registered.', errors: { email: 'Already registered — try logging in.' } })
    }

    await pool.query(
      'INSERT INTO students (full_name, email, phone, institution, branch, roll_number) VALUES (?, ?, ?, ?, ?, ?)',
      [b.fullName.trim(), email, b.phone.trim(), b.institution.trim(), b.branch.trim(), normRoll(b.rollNumber)],
    )
    const [[row]] = await pool.query('SELECT * FROM students WHERE email = ?', [email])
    res.status(201).json({ token: issueToken(row.email), student: publicStudent(row) })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login — registered email + roll number
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const roll = normRoll(req.body?.rollNumber)
    if (!EMAIL_RE.test(email) || !roll) {
      return res.status(422).json({ message: 'Enter your email and roll number.' })
    }
    const [[row]] = await pool.query('SELECT * FROM students WHERE email = ? LIMIT 1', [email])
    // Same message for unknown email and wrong roll number, so accounts can't be enumerated.
    if (!row || row.roll_number !== roll) {
      return res.status(401).json({ message: 'Email and roll number don’t match our records.' })
    }
    res.json({ token: issueToken(row.email), student: publicStudent(row) })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me — current student from the bearer token
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM students WHERE email = ? LIMIT 1', [req.studentId])
    if (!row) return res.status(401).json({ message: 'Please log in.' })
    res.json({ student: publicStudent(row) })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/leaderboard — full ranking, the caller's rank, and score-over-time series for the top 10.
// Scores come from score_events (awarded by organisers); students.score holds the running total.
router.get('/leaderboard', requireAuth, async (req, res, next) => {
  try {
    // Students are keyed by email, which must never reach other students: the public list carries an opaque id derived from it.
    const [rows] = await pool.query(
      'SELECT email, full_name AS name, institution, score FROM students ORDER BY score DESC, full_name ASC',
    )
    const all = rows.map(({ email, ...r }) => ({ id: publicId(email), ...r, _email: email }))
    const top = all.slice(0, 10)
    const meId = publicId(req.studentId)
    const meRow = all.find((r) => r.id === meId)
    const rank = meRow ? all.findIndex((r) => r.id === meId) + 1 : all.length
    let series = []
    if (top.length) {
      const [events] = await pool.query(
        'SELECT student_email, points, created_at FROM score_events WHERE student_email IN (?) ORDER BY created_at ASC, id ASC',
        [top.map((r) => r._email)],
      )
      series = top.map((r) => {
        let running = 0
        const points = events.filter((e) => e.student_email === r._email).map((e) => ({ t: e.created_at, score: (running += e.points) }))
        return { id: r.id, name: r.name, points }
      })
    }
    const strip = ({ _email, ...r }) => r
    res.json({ all: all.map(strip), top: top.map(strip), series, me: { id: meId, score: meRow?.score ?? 0, rank, total: all.length } })
  } catch (err) {
    next(err)
  }
})

export default router
