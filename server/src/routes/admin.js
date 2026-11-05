import { createHash, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../config/db.js'
import { issueToken, requireAdmin } from '../lib/token.js'
import { MAX_ATTEMPTS, hashAnswer } from './flags.js'

const router = Router()

/* Single organiser account. Override with ADMIN_EMAIL / ADMIN_PASSWORD in .env. */
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL).toLowerCase()
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

const sha = (v) => createHash('sha256').update(String(v)).digest()
const same = (a, b) => timingSafeEqual(sha(a), sha(b))

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9]{10}$/
const ROLL_RE = /^[A-Za-z0-9\-\/]{3,30}$/
const normRoll = (v) => String(v ?? '').trim().toUpperCase()

const publicStudent = (r) => ({
  id: r.id, fullName: r.full_name, email: r.email, phone: r.phone, institution: r.institution,
  branch: r.branch, rollNumber: r.roll_number, score: r.score ?? 0, createdAt: r.created_at,
  solved: Number(r.solved ?? 0), attempts: Number(r.attempts ?? 0),
})

// POST /api/admin/login { email, password }
router.post('/login', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  if (!same(email, ADMIN_EMAIL) || !same(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ message: 'Invalid admin credentials.' })
  }
  res.json({ token: issueToken(0, 'admin'), admin: { email: ADMIN_EMAIL } })
})

router.use(requireAdmin)

// GET /api/admin/me
router.get('/me', (_req, res) => res.json({ admin: { email: ADMIN_EMAIL } }))

// GET /api/admin/stats — headline numbers for the overview
router.get('/stats', async (_req, res, next) => {
  try {
    const [[s]] = await pool.query('SELECT COUNT(*) AS students, COALESCE(SUM(score),0) AS points, COUNT(DISTINCT institution) AS colleges FROM students')
    const [[f]] = await pool.query('SELECT COUNT(*) AS flags, COALESCE(SUM(points),0) AS total FROM flags')
    const [[sub]] = await pool.query('SELECT COUNT(*) AS submissions, COALESCE(SUM(correct),0) AS captures FROM submissions')
    const [perFlag] = await pool.query(
      `SELECT f.id, f.title, f.points, COUNT(s.id) AS attempts, COALESCE(SUM(s.correct),0) AS captures
         FROM flags f LEFT JOIN submissions s ON s.flag_id = f.id GROUP BY f.id ORDER BY f.sort_order, f.id`,
    )
    const [recent] = await pool.query(
      `SELECT s.id, s.correct, s.created_at, s.answer, st.full_name AS student, f.title AS flag
         FROM submissions s JOIN students st ON st.id = s.student_id JOIN flags f ON f.id = s.flag_id
        ORDER BY s.id DESC LIMIT 12`,
    )
    res.json({
      students: Number(s.students), points: Number(s.points), colleges: Number(s.colleges),
      flags: Number(f.flags), totalPoints: Number(f.total),
      submissions: Number(sub.submissions), captures: Number(sub.captures),
      perFlag: perFlag.map((r) => ({ ...r, attempts: Number(r.attempts), captures: Number(r.captures) })),
      recent,
    })
  } catch (err) { next(err) }
})

/* ───────── students ───────── */

const STUDENT_SQL = `
  SELECT st.*, COUNT(DISTINCT CASE WHEN s.correct = 1 THEN s.flag_id END) AS solved, COUNT(s.id) AS attempts
    FROM students st LEFT JOIN submissions s ON s.student_id = st.id`

function validateStudent(b, partial = false) {
  const e = {}
  if (!partial || b.fullName !== undefined) if (!b.fullName || b.fullName.trim().length < 2) e.fullName = 'Full name is required.'
  if (!partial || b.email !== undefined) if (!EMAIL_RE.test(b.email ?? '')) e.email = 'Valid email required.'
  if (!partial || b.phone !== undefined) if (!PHONE_RE.test(b.phone ?? '')) e.phone = '10-digit mobile required.'
  if (!partial || b.institution !== undefined) if (!b.institution || b.institution.trim().length < 2) e.institution = 'Institution is required.'
  if (!partial || b.branch !== undefined) if (!b.branch || b.branch.trim().length < 2) e.branch = 'Branch is required.'
  if (!partial || b.rollNumber !== undefined) if (!ROLL_RE.test(normRoll(b.rollNumber))) e.rollNumber = 'Roll number: 3–30 letters/digits.'
  return e
}

// GET /api/admin/students?q=
router.get('/students', async (req, res, next) => {
  try {
    const q = `%${String(req.query.q ?? '').trim()}%`
    const [rows] = await pool.query(
      `${STUDENT_SQL} WHERE st.full_name LIKE ? OR st.email LIKE ? OR st.institution LIKE ? OR st.roll_number LIKE ?
       GROUP BY st.id ORDER BY st.score DESC, st.full_name ASC`,
      [q, q, q, q],
    )
    res.json({ students: rows.map(publicStudent) })
  } catch (err) { next(err) }
})

// POST /api/admin/students
router.post('/students', async (req, res, next) => {
  try {
    const b = req.body ?? {}
    const errors = validateStudent(b)
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Fix the highlighted fields.', errors })
    const email = b.email.trim().toLowerCase()
    const [dupes] = await pool.query('SELECT id FROM students WHERE email = ? LIMIT 1', [email])
    if (dupes.length) return res.status(409).json({ message: 'Email already registered.', errors: { email: 'Already registered.' } })
    const [r] = await pool.query(
      'INSERT INTO students (full_name, email, phone, institution, branch, roll_number) VALUES (?, ?, ?, ?, ?, ?)',
      [b.fullName.trim(), email, b.phone.trim(), b.institution.trim(), b.branch.trim(), normRoll(b.rollNumber)],
    )
    const [[row]] = await pool.query(`${STUDENT_SQL} WHERE st.id = ? GROUP BY st.id`, [r.insertId])
    res.status(201).json({ student: publicStudent(row) })
  } catch (err) { next(err) }
})

// PUT /api/admin/students/:id
router.put('/students/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const b = req.body ?? {}
    const errors = validateStudent(b)
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Fix the highlighted fields.', errors })
    const email = b.email.trim().toLowerCase()
    const [dupes] = await pool.query('SELECT id FROM students WHERE email = ? AND id <> ? LIMIT 1', [email, id])
    if (dupes.length) return res.status(409).json({ message: 'Email already used by another student.', errors: { email: 'Already in use.' } })
    const [r] = await pool.query(
      'UPDATE students SET full_name = ?, email = ?, phone = ?, institution = ?, branch = ?, roll_number = ? WHERE id = ?',
      [b.fullName.trim(), email, b.phone.trim(), b.institution.trim(), b.branch.trim(), normRoll(b.rollNumber), id],
    )
    if (!r.affectedRows) return res.status(404).json({ message: 'Student not found.' })
    const [[row]] = await pool.query(`${STUDENT_SQL} WHERE st.id = ? GROUP BY st.id`, [id])
    res.json({ student: publicStudent(row) })
  } catch (err) { next(err) }
})

// POST /api/admin/students/:id/score { points, note } — manual award or deduction, logged as a score event
router.post('/students/:id/score', async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const id = Number(req.params.id)
    const points = Math.trunc(Number(req.body?.points))
    const note = String(req.body?.note ?? 'manual adjustment').trim().slice(0, 120) || 'manual adjustment'
    if (!Number.isFinite(points) || points === 0 || Math.abs(points) > 100000) return res.status(422).json({ message: 'Points must be a non-zero whole number.' })
    await conn.beginTransaction()
    const [r] = await conn.query('UPDATE students SET score = score + ? WHERE id = ?', [points, id])
    if (!r.affectedRows) { await conn.rollback(); return res.status(404).json({ message: 'Student not found.' }) }
    await conn.query('INSERT INTO score_events (student_id, points, note) VALUES (?, ?, ?)', [id, points, note])
    await conn.commit()
    const [[row]] = await pool.query(`${STUDENT_SQL} WHERE st.id = ? GROUP BY st.id`, [id])
    res.json({ student: publicStudent(row) })
  } catch (err) { await conn.rollback().catch(() => {}); next(err) } finally { conn.release() }
})

// DELETE /api/admin/students/:id — cascades to submissions and score events
router.delete('/students/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query('DELETE FROM students WHERE id = ?', [Number(req.params.id)])
    if (!r.affectedRows) return res.status(404).json({ message: 'Student not found.' })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

/* ───────── flags ───────── */

const FLAG_SQL = `
  SELECT f.*, COUNT(s.id) AS attempts, COALESCE(SUM(s.correct),0) AS captures
    FROM flags f LEFT JOIN submissions s ON s.flag_id = f.id`
const publicFlag = (r) => ({
  id: r.id, title: r.title, points: r.points, answer: r.answer ?? '', questionUrl: r.question_url, sortOrder: r.sort_order,
  attempts: Number(r.attempts ?? 0), captures: Number(r.captures ?? 0),
})

function validateFlag(b) {
  const e = {}
  if (!b.title || String(b.title).trim().length < 2 || String(b.title).trim().length > 80) e.title = 'Title: 2–80 characters.'
  const pts = Number(b.points)
  if (!Number.isInteger(pts) || pts < 1 || pts > 100000) e.points = 'Points: whole number 1–100000.'
  if (!b.answer || !String(b.answer).trim()) e.answer = 'Answer is required.'
  else if (String(b.answer).trim().length > 200) e.answer = 'Answer: max 200 characters.'
  if (b.questionUrl && String(b.questionUrl).length > 300) e.questionUrl = 'URL: max 300 characters.'
  return e
}

// GET /api/admin/flags
router.get('/flags', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`${FLAG_SQL} GROUP BY f.id ORDER BY f.sort_order ASC, f.id ASC`)
    res.json({ flags: rows.map(publicFlag), maxAttempts: MAX_ATTEMPTS })
  } catch (err) { next(err) }
})

// POST /api/admin/flags
router.post('/flags', async (req, res, next) => {
  try {
    const b = req.body ?? {}
    const errors = validateFlag(b)
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Fix the highlighted fields.', errors })
    const title = String(b.title).trim()
    const [dupes] = await pool.query('SELECT id FROM flags WHERE title = ? LIMIT 1', [title])
    if (dupes.length) return res.status(409).json({ message: 'A flag with this title exists.', errors: { title: 'Title already used.' } })
    const [[{ next: order }]] = await pool.query('SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM flags')
    const answer = String(b.answer).trim()
    const [r] = await pool.query(
      'INSERT INTO flags (title, points, answer, answer_hash, question_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [title, Number(b.points), answer, hashAnswer(answer), String(b.questionUrl ?? '').trim(), b.sortOrder != null ? Number(b.sortOrder) : order],
    )
    const [[row]] = await pool.query(`${FLAG_SQL} WHERE f.id = ? GROUP BY f.id`, [r.insertId])
    res.status(201).json({ flag: publicFlag(row) })
  } catch (err) { next(err) }
})

// PUT /api/admin/flags/:id
router.put('/flags/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const b = req.body ?? {}
    const errors = validateFlag(b)
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Fix the highlighted fields.', errors })
    const title = String(b.title).trim()
    const [dupes] = await pool.query('SELECT id FROM flags WHERE title = ? AND id <> ? LIMIT 1', [title, id])
    if (dupes.length) return res.status(409).json({ message: 'A flag with this title exists.', errors: { title: 'Title already used.' } })
    const answer = String(b.answer).trim()
    const [r] = await pool.query(
      'UPDATE flags SET title = ?, points = ?, answer = ?, answer_hash = ?, question_url = ?, sort_order = ? WHERE id = ?',
      [title, Number(b.points), answer, hashAnswer(answer), String(b.questionUrl ?? '').trim(), Number(b.sortOrder ?? 0), id],
    )
    if (!r.affectedRows) return res.status(404).json({ message: 'Flag not found.' })
    const [[row]] = await pool.query(`${FLAG_SQL} WHERE f.id = ? GROUP BY f.id`, [id])
    res.json({ flag: publicFlag(row) })
  } catch (err) { next(err) }
})

// DELETE /api/admin/flags/:id — cascades to submissions (scores already awarded are kept)
router.delete('/flags/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query('DELETE FROM flags WHERE id = ?', [Number(req.params.id)])
    if (!r.affectedRows) return res.status(404).json({ message: 'Flag not found.' })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

/* ───────── submissions ───────── */

// GET /api/admin/submissions?q=&flag=&correct=
router.get('/submissions', async (req, res, next) => {
  try {
    const where = []
    const args = []
    if (req.query.q) { where.push('(st.full_name LIKE ? OR st.email LIKE ?)'); args.push(`%${req.query.q}%`, `%${req.query.q}%`) }
    if (req.query.flag) { where.push('s.flag_id = ?'); args.push(Number(req.query.flag)) }
    if (req.query.correct === '1' || req.query.correct === '0') { where.push('s.correct = ?'); args.push(Number(req.query.correct)) }
    const [rows] = await pool.query(
      `SELECT s.id, s.answer, s.correct, s.created_at, st.id AS student_id, st.full_name AS student, st.email, f.id AS flag_id, f.title AS flag, f.points
         FROM submissions s JOIN students st ON st.id = s.student_id JOIN flags f ON f.id = s.flag_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.id DESC LIMIT 300`,
      args,
    )
    res.json({ submissions: rows })
  } catch (err) { next(err) }
})

// DELETE /api/admin/submissions/:id — e.g. to give a student an attempt back (does not touch score)
router.delete('/submissions/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query('DELETE FROM submissions WHERE id = ?', [Number(req.params.id)])
    if (!r.affectedRows) return res.status(404).json({ message: 'Submission not found.' })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
