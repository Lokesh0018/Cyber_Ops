import { createHash } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../config/db.js'
import { board, invalidateBoard } from '../lib/boardCache.js'
import { rateLimit } from '../lib/rateLimit.js'
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
// Open sign-up, so cap it per IP to stop a script flooding the roster/leaderboard with fake students. Sized for a class registering
// together from one college network (20 sign-ups or typo retries per 10 minutes); raise it with REGISTER_LIMIT if you need more.
const registerByIp = rateLimit({ windowMs: 10 * 60_000, max: Number(process.env.REGISTER_LIMIT) || 20, key: (req) => `reg:${req.ip}`, message: 'Too many sign-ups from this network. Please wait a few minutes and try again.' })
router.post('/register', registerByIp, async (req, res, next) => {
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
    invalidateBoard() // a new student joins the ranking
    res.status(201).json({ token: issueToken(row.email), student: publicStudent(row) })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login — registered email + roll number
// Login is email + roll number, so guessing is the main attack. Limit per email (stops guessing one account from anywhere)
// and per IP (stops sweeping many accounts), with headroom for a whole class behind one college NAT.
const loginByEmail = rateLimit({ windowMs: 10 * 60_000, max: 10, key: (req) => `e:${String(req.body?.email ?? '').trim().toLowerCase()}`, message: 'Too many login attempts for this email. Please wait 10 minutes and try again.' })
const loginByIp = rateLimit({ windowMs: 10 * 60_000, max: 200, key: (req) => `ip:${req.ip}`, message: 'Too many login attempts from this network. Please wait a few minutes and try again.' })
router.post('/login', loginByIp, loginByEmail, async (req, res, next) => {
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
    // Built at most once per few seconds for everyone (see lib/boardCache.js); only "me" is computed per request.
    const b = await board(buildBoard)
    const meId = publicId(req.studentId)
    res.json({ all: b.all, top: b.top, series: b.series, me: { id: meId, score: b.scoreOf.get(meId) ?? 0, rank: b.rankOf.get(meId) ?? b.all.length, total: b.all.length } })
  } catch (err) {
    next(err)
  }
})

// Students are keyed by email, which must never reach other students: the public list carries an opaque id derived from it.
async function buildBoard() {
  const [rows] = await pool.query('SELECT email, full_name AS name, institution, score FROM students ORDER BY score DESC, full_name ASC')
  const all = rows.map(({ email, ...r }) => ({ id: publicId(email), ...r }))
  const top = all.slice(0, 10)
  let series = []
  if (top.length) {
    const emails = rows.slice(0, 10).map((r) => r.email)
    const [events] = await pool.query(
      'SELECT student_email, points, created_at FROM score_events WHERE student_email IN (?) ORDER BY created_at ASC, id ASC',
      [emails],
    )
    const byEmail = new Map(emails.map((e) => [e, []]))
    for (const e of events) byEmail.get(e.student_email)?.push(e)
    series = top.map((r, i) => {
      let running = 0
      return { id: r.id, name: r.name, points: byEmail.get(emails[i]).map((e) => ({ t: e.created_at, score: (running += e.points) })) }
    })
  }
  return { all, top, series, rankOf: new Map(all.map((r, i) => [r.id, i + 1])), scoreOf: new Map(all.map((r) => [r.id, r.score])) }
}

export default router
