import { createHash, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../config/db.js'
import { invalidateBoard } from '../lib/boardCache.js'
import { rateLimit } from '../lib/rateLimit.js'
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
  id: r.email, fullName: r.full_name, email: r.email, phone: r.phone, institution: r.institution,
  branch: r.branch, rollNumber: r.roll_number, score: r.score ?? 0, createdAt: r.created_at,
  solved: Number(r.solved ?? 0), attempts: Number(r.attempts ?? 0),
})

// POST /api/admin/login { email, password }
const adminLoginLimit = rateLimit({ windowMs: 15 * 60_000, max: 10, key: (req) => `admin:${req.ip}`, message: 'Too many admin sign-in attempts. Please wait 15 minutes and try again.' })
router.post('/login', adminLoginLimit, (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  const password = String(req.body?.password ?? '')
  if (!same(email, ADMIN_EMAIL) || !same(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ message: 'Invalid admin credentials.' })
  }
  res.json({ token: issueToken(0, 'admin'), admin: { email: ADMIN_EMAIL } })
})

router.use(requireAdmin)
// Any admin change (scores, students, flags, submissions) can alter the public leaderboard: drop its cache once the response is sent.
router.use((req, res, next) => { if (req.method !== 'GET') res.on('finish', invalidateBoard); next() })

// GET /api/admin/me
router.get('/me', (_req, res) => res.json({ admin: { email: ADMIN_EMAIL } }))

// GET /api/admin/stats — headline numbers for the overview
// ?range=1h|6h|24h picks the window for the activity time series (always 24 buckets, oldest first)
const RANGE_HOURS = { '1h': 1, '6h': 6, '24h': 24 }
router.get('/stats', async (req, res, next) => {
  try {
    const hours = RANGE_HOURS[req.query.range] ?? 6
    const BUCKETS = 24
    const bucketSec = Math.round((hours * 3600) / BUCKETS)
    // Independent queries: run them together instead of one after another (the pool has 10 connections).
    const [[[s]], [[f]], [[sub]], [perFlag], [recent], [bucketRows], [topStudents], [byCollege]] = await Promise.all([
      pool.query('SELECT COUNT(*) AS students, COALESCE(SUM(score),0) AS points, COUNT(DISTINCT institution) AS colleges FROM students'),
      pool.query('SELECT COUNT(*) AS flags, COALESCE(SUM(points),0) AS total FROM flags'),
      pool.query('SELECT COUNT(*) AS submissions, COALESCE(SUM(correct),0) AS captures FROM submissions'),
      pool.query(
        `SELECT f.id, f.title, f.points, COUNT(s.id) AS attempts, COALESCE(SUM(s.correct),0) AS captures
           FROM flags f LEFT JOIN submissions s ON s.flag_id = f.id GROUP BY f.id ORDER BY f.sort_order, f.id`,
      ),
      pool.query(
        `SELECT s.id, s.correct, s.created_at, s.answer, st.full_name AS student, f.title AS flag
           FROM submissions s JOIN students st ON st.email = s.student_email JOIN flags f ON f.id = s.flag_id
          ORDER BY s.id DESC LIMIT 12`,
      ),
      pool.query(
        `SELECT FLOOR((UNIX_TIMESTAMP(NOW()) - UNIX_TIMESTAMP(created_at)) / ?) AS ago, COUNT(*) AS attempts, COALESCE(SUM(correct),0) AS captures
           FROM submissions WHERE created_at >= NOW() - INTERVAL ? SECOND GROUP BY ago`,
        [bucketSec, bucketSec * BUCKETS],
      ),
      pool.query('SELECT email AS id, full_name AS name, institution, score FROM students ORDER BY score DESC, full_name ASC LIMIT 5'),
      pool.query('SELECT institution, COUNT(*) AS students, COALESCE(SUM(score),0) AS points FROM students GROUP BY institution ORDER BY points DESC, students DESC LIMIT 6'),
    ])
    const timeline = Array.from({ length: BUCKETS }, () => ({ attempts: 0, captures: 0 }))
    for (const r of bucketRows) {
      const i = BUCKETS - 1 - Number(r.ago)
      if (i >= 0 && i < BUCKETS) timeline[i] = { attempts: Number(r.attempts), captures: Number(r.captures) }
    }
    res.json({
      students: Number(s.students), points: Number(s.points), colleges: Number(s.colleges),
      flags: Number(f.flags), totalPoints: Number(f.total),
      submissions: Number(sub.submissions), captures: Number(sub.captures),
      perFlag: perFlag.map((r) => ({ ...r, attempts: Number(r.attempts), captures: Number(r.captures) })),
      recent,
      range: { key: Object.keys(RANGE_HOURS).find((k) => RANGE_HOURS[k] === hours), bucketSec, buckets: BUCKETS },
      timeline,
      topStudents: topStudents.map((r) => ({ ...r, score: Number(r.score) })),
      byCollege: byCollege.map((r) => ({ institution: r.institution, students: Number(r.students), points: Number(r.points) })),
      serverNow: Date.now(),
    })
  } catch (err) { next(err) }
})

/* ───────── students ───────── */

const STUDENT_SQL = `
  SELECT st.*, COUNT(DISTINCT CASE WHEN s.correct = 1 THEN s.flag_id END) AS solved, COUNT(s.id) AS attempts
    FROM students st LEFT JOIN submissions s ON s.student_email = st.email`

// Maximum lengths match the column sizes in config/schema.js; without them an over-long value fails in MySQL as a 500.
function validateStudent(b, partial = false) {
  const t = (v) => (typeof v === 'string' ? v.trim() : '') // anything that isn't a string (object, array, number) counts as empty
  const e = {}
  const name = t(b.fullName), email = t(b.email), inst = t(b.institution), branch = t(b.branch)
  if (!partial || b.fullName !== undefined) {
    if (name.length < 2) e.fullName = 'Full name is required.'
    else if (name.length > 120) e.fullName = 'Name is too long (max 120 characters).'
  }
  if (!partial || b.email !== undefined) {
    if (!EMAIL_RE.test(email)) e.email = 'Valid email required.'
    else if (email.length > 190) e.email = 'Email is too long (max 190 characters).'
  }
  if (!partial || b.phone !== undefined) if (!PHONE_RE.test(t(b.phone))) e.phone = '10-digit mobile required.'
  if (!partial || b.institution !== undefined) {
    if (inst.length < 2) e.institution = 'Institution is required.'
    else if (inst.length > 160) e.institution = 'Too long (max 160 characters).'
  }
  if (!partial || b.branch !== undefined) {
    if (branch.length < 2) e.branch = 'Branch is required.'
    else if (branch.length > 80) e.branch = 'Too long (max 80 characters).'
  }
  if (!partial || b.rollNumber !== undefined) if (!ROLL_RE.test(normRoll(t(b.rollNumber)))) e.rollNumber = 'Roll number: 3–30 letters/digits.'
  return e
}

// GET /api/admin/students?q=
router.get('/students', async (req, res, next) => {
  try {
    const q = `%${String(req.query.q ?? '').trim()}%`
    const [rows] = await pool.query(
      `${STUDENT_SQL} WHERE st.full_name LIKE ? OR st.email LIKE ? OR st.institution LIKE ? OR st.roll_number LIKE ?
       GROUP BY st.email ORDER BY st.score DESC, st.full_name ASC`,
      [q, q, q, q],
    )
    const [[{ n: totalFlags }]] = await pool.query('SELECT COUNT(*) AS n FROM flags')
    res.json({ students: rows.map(publicStudent), totalFlags: Number(totalFlags) })
  } catch (err) { next(err) }
})

// GET /api/admin/students/series?top=6 — score-over-time for the top N students (from score_events), for the students-tab "race" chart
router.get('/students/series', async (req, res, next) => {
  try {
    const top = Math.min(10, Math.max(1, Math.trunc(Number(req.query.top)) || 6))
    const [leaders] = await pool.query('SELECT email, full_name AS name, institution, score FROM students ORDER BY score DESC, full_name ASC LIMIT ?', [top])
    let series = []
    if (leaders.length) {
      const [events] = await pool.query(
        'SELECT student_email, points, created_at FROM score_events WHERE student_email IN (?) ORDER BY created_at ASC, id ASC',
        [leaders.map((r) => r.email)],
      )
      series = leaders.map((r) => {
        let running = 0
        const points = events.filter((e) => e.student_email === r.email).map((e) => ({ t: e.created_at, score: (running += e.points) }))
        return { id: r.email, name: r.name, institution: r.institution, score: r.score, points }
      })
    }
    res.json({ series })
  } catch (err) { next(err) }
})

// GET /api/admin/students/:id/detail — one student's profile, per-flag progress, every submission and every score event
router.get('/students/:id/detail', async (req, res, next) => {
  try {
    const id = emailParam(req)
    const [[row]] = await pool.query(`${STUDENT_SQL} WHERE st.email = ? GROUP BY st.email`, [id])
    if (!row) return res.status(404).json({ message: 'Student not found.' })
    const [[{ ahead }]] = await pool.query('SELECT COUNT(*) AS ahead FROM students WHERE score > ?', [row.score])
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM students')
    const [flags] = await pool.query('SELECT id, title, points, level, frozen FROM flags ORDER BY sort_order ASC, id ASC')
    const [submissions] = await pool.query(
      `SELECT s.id, s.answer, s.correct, s.created_at, f.id AS flag_id, f.title AS flag, f.points
         FROM submissions s JOIN flags f ON f.id = s.flag_id
        WHERE s.student_email = ? ORDER BY s.id DESC`,
      [id],
    )
    const [events] = await pool.query('SELECT id, points, note, created_at FROM score_events WHERE student_email = ? ORDER BY created_at DESC, id DESC', [id])
    const byFlag = new Map()
    for (const s of [...submissions].reverse()) { // oldest first, so solvedAt/firstAt are right
      const f = byFlag.get(s.flag_id) ?? { attempts: 0, solved: false, solvedAt: null, firstAt: s.created_at, lastAt: null }
      f.attempts++
      f.lastAt = s.created_at
      if (Number(s.correct)) { f.solved = true; f.solvedAt = s.created_at }
      byFlag.set(s.flag_id, f)
    }
    res.json({
      student: publicStudent(row),
      rank: Number(ahead) + 1, total: Number(total), maxAttempts: MAX_ATTEMPTS,
      flags: flags.map((f) => ({ ...f, frozen: !!Number(f.frozen), ...(byFlag.get(f.id) ?? { attempts: 0, solved: false, solvedAt: null, firstAt: null, lastAt: null }) })),
      submissions: submissions.map((s) => ({ ...s, correct: Number(s.correct) })),
      events,
    })
  } catch (err) { next(err) }
})

// POST /api/admin/students
router.post('/students', async (req, res, next) => {
  try {
    const b = req.body ?? {}
    const errors = validateStudent(b)
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Fix the highlighted fields.', errors })
    const email = b.email.trim().toLowerCase()
    const [dupes] = await pool.query('SELECT email FROM students WHERE email = ? LIMIT 1', [email])
    if (dupes.length) return res.status(409).json({ message: 'Email already registered.', errors: { email: 'Already registered.' } })
    await pool.query(
      'INSERT INTO students (full_name, email, phone, institution, branch, roll_number) VALUES (?, ?, ?, ?, ?, ?)',
      [b.fullName.trim(), email, b.phone.trim(), b.institution.trim(), b.branch.trim(), normRoll(b.rollNumber)],
    )
    const [[row]] = await pool.query(`${STUDENT_SQL} WHERE st.email = ? GROUP BY st.email`, [email])
    res.status(201).json({ student: publicStudent(row) })
  } catch (err) { next(err) }
})

// The student "id" in URLs is the student's email (the primary key), URL-encoded by the client.
const emailParam = (req) => String(req.params.id ?? '').trim().toLowerCase()

// PUT /api/admin/students/:id — :id is the current email; the body may change it (history follows via ON UPDATE CASCADE)
router.put('/students/:id', async (req, res, next) => {
  try {
    const id = emailParam(req)
    const b = req.body ?? {}
    const errors = validateStudent(b)
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Fix the highlighted fields.', errors })
    const email = b.email.trim().toLowerCase()
    if (email !== id) {
      const [dupes] = await pool.query('SELECT email FROM students WHERE email = ? LIMIT 1', [email])
      if (dupes.length) return res.status(409).json({ message: 'Email already used by another student.', errors: { email: 'Already in use.' } })
    }
    const [r] = await pool.query(
      'UPDATE students SET full_name = ?, email = ?, phone = ?, institution = ?, branch = ?, roll_number = ? WHERE email = ?',
      [b.fullName.trim(), email, b.phone.trim(), b.institution.trim(), b.branch.trim(), normRoll(b.rollNumber), id],
    )
    if (!r.affectedRows) return res.status(404).json({ message: 'Student not found.' })
    const [[row]] = await pool.query(`${STUDENT_SQL} WHERE st.email = ? GROUP BY st.email`, [email])
    res.json({ student: publicStudent(row) })
  } catch (err) { next(err) }
})

// POST /api/admin/students/:id/score { points, note } — manual award or deduction, logged as a score event
router.post('/students/:id/score', async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const id = emailParam(req)
    const points = Math.trunc(Number(req.body?.points))
    const note = String(req.body?.note ?? 'manual adjustment').trim().slice(0, 120) || 'manual adjustment'
    if (!Number.isFinite(points) || points === 0 || Math.abs(points) > 100000) return res.status(422).json({ message: 'Points must be a non-zero whole number.' })
    await conn.beginTransaction()
    const [r] = await conn.query('UPDATE students SET score = score + ? WHERE email = ?', [points, id])
    if (!r.affectedRows) { await conn.rollback(); return res.status(404).json({ message: 'Student not found.' }) }
    await conn.query('INSERT INTO score_events (student_email, points, note) VALUES (?, ?, ?)', [id, points, note])
    await conn.commit()
    const [[row]] = await pool.query(`${STUDENT_SQL} WHERE st.email = ? GROUP BY st.email`, [id])
    res.json({ student: publicStudent(row) })
  } catch (err) { await conn.rollback().catch(() => {}); next(err) } finally { conn.release() }
})

// DELETE /api/admin/students/:id — cascades to submissions and score events
router.delete('/students/:id', async (req, res, next) => {
  try {
    const [r] = await pool.query('DELETE FROM students WHERE email = ?', [emailParam(req)])
    if (!r.affectedRows) return res.status(404).json({ message: 'Student not found.' })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

/* ───────── flags ───────── */

const FLAG_SQL = `
  SELECT f.*, COUNT(s.id) AS attempts, COALESCE(SUM(s.correct),0) AS captures
    FROM flags f LEFT JOIN submissions s ON s.flag_id = f.id`
const LEVELS = ['easy', 'medium', 'hard']
const publicFlag = (r) => ({
  id: r.id, title: r.title, points: r.points, level: r.level ?? 'easy', frozen: !!Number(r.frozen), answer: r.answer ?? '', questionUrl: r.question_url, sortOrder: r.sort_order,
  attempts: Number(r.attempts ?? 0), captures: Number(r.captures ?? 0),
})

function validateFlag(b) {
  const e = {}
  if (!b.title || String(b.title).trim().length < 2 || String(b.title).trim().length > 80) e.title = 'Title: 2–80 characters.'
  const pts = Number(b.points)
  if (!Number.isInteger(pts) || pts < 1 || pts > 100000) e.points = 'Points: whole number 1–100000.'
  if (!LEVELS.includes(b.level)) e.level = 'Pick easy, medium or hard.'
  if (!b.answer || !String(b.answer).trim()) e.answer = 'Answer is required.'
  else if (String(b.answer).trim().length > 200) e.answer = 'Answer: max 200 characters.'
  if (b.questionUrl && String(b.questionUrl).length > 300) e.questionUrl = 'URL: max 300 characters.'
  return e
}

// GET /api/admin/flags
router.get('/flags', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`${FLAG_SQL} GROUP BY f.id ORDER BY f.sort_order ASC, f.id ASC`)
    const [[{ n: students }]] = await pool.query('SELECT COUNT(*) AS n FROM students')
    res.json({ flags: rows.map(publicFlag), maxAttempts: MAX_ATTEMPTS, students: Number(students) })
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
      'INSERT INTO flags (title, points, level, frozen, answer, answer_hash, question_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, Number(b.points), b.level, b.frozen ? 1 : 0, answer, hashAnswer(answer), String(b.questionUrl ?? '').trim(), b.sortOrder != null ? Number(b.sortOrder) : order],
    )
    const [[row]] = await pool.query(`${FLAG_SQL} WHERE f.id = ? GROUP BY f.id`, [r.insertId])
    res.status(201).json({ flag: publicFlag(row) })
  } catch (err) { next(err) }
})

// When a flag's points change, everyone who already captured it is re-scored so they hold exactly the new value for it.
// Each solver is adjusted by (new points - what they were actually credited for this flag, from score_events.flag_id), so it also
// repairs any past drift (e.g. the value was edited before re-scoring existed). Every change is logged as a score event, keeping
// students.score equal to the sum of score_events. Runs on the caller's connection, inside its transaction.
async function rescoreSolvers(conn, flagId, title, newPts, oldPts) {
  const [solvers] = await conn.query(
    `SELECT s.student_email, COUNT(e.id) AS linked, COALESCE(SUM(e.points), 0) AS credited
       FROM (SELECT DISTINCT student_email FROM submissions WHERE flag_id = ? AND correct = 1) s
       LEFT JOIN score_events e ON e.student_email = s.student_email AND e.flag_id = ?
      GROUP BY s.student_email`,
    [flagId, flagId],
  )
  // A solver with no linked events (a capture whose award was never tied to the flag) is assumed to hold the flag's previous value.
  const changes = solvers
    .map((r) => { const from = Number(r.linked) ? Number(r.credited) : oldPts; return { email: r.student_email, from, delta: newPts - from } })
    .filter((c) => c.delta !== 0)
  for (const c of changes) {
    await conn.query('UPDATE students SET score = score + ? WHERE email = ?', [c.delta, c.email])
    await conn.query('INSERT INTO score_events (student_email, points, note, flag_id) VALUES (?, ?, ?, ?)', [c.email, c.delta, `Points changed: ${title} (${c.from} → ${newPts})`.slice(0, 120), flagId])
  }
  const deltas = new Set(changes.map((c) => c.delta))
  return { rescored: changes.length, delta: deltas.size === 1 ? changes[0].delta : null } // delta is null when solvers moved by different amounts
}

// PUT /api/admin/flags/:id
router.put('/flags/:id', async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const id = Number(req.params.id)
    const b = req.body ?? {}
    const errors = validateFlag(b)
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Fix the highlighted fields.', errors })
    const title = String(b.title).trim()
    const newPts = Number(b.points)
    await conn.beginTransaction()
    const [[old]] = await conn.query('SELECT id, title, points FROM flags WHERE id = ? FOR UPDATE', [id])
    if (!old) { await conn.rollback(); return res.status(404).json({ message: 'Flag not found.' }) }
    const [dupes] = await conn.query('SELECT id FROM flags WHERE title = ? AND id <> ? LIMIT 1', [title, id])
    if (dupes.length) { await conn.rollback(); return res.status(409).json({ message: 'A flag with this title exists.', errors: { title: 'Title already used.' } }) }
    const answer = String(b.answer).trim()
    await conn.query(
      'UPDATE flags SET title = ?, points = ?, level = ?, frozen = ?, answer = ?, answer_hash = ?, question_url = ?, sort_order = ? WHERE id = ?',
      [title, newPts, b.level, b.frozen ? 1 : 0, answer, hashAnswer(answer), String(b.questionUrl ?? '').trim(), Number(b.sortOrder ?? 0), id],
    )
    const { rescored, delta } = await rescoreSolvers(conn, id, title, newPts, old.points)
    await conn.commit()
    const [[row]] = await pool.query(`${FLAG_SQL} WHERE f.id = ? GROUP BY f.id`, [id])
    res.json({ flag: publicFlag(row), rescored, delta })
  } catch (err) { await conn.rollback().catch(() => {}); next(err) } finally { conn.release() }
})

// PATCH /api/admin/flags/:id/freeze { frozen } — pause/resume submissions for one flag
router.patch('/flags/:id/freeze', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const [r] = await pool.query('UPDATE flags SET frozen = ? WHERE id = ?', [req.body?.frozen ? 1 : 0, id])
    if (!r.affectedRows) return res.status(404).json({ message: 'Flag not found.' })
    const [[row]] = await pool.query(`${FLAG_SQL} WHERE f.id = ? GROUP BY f.id`, [id])
    res.json({ flag: publicFlag(row) })
  } catch (err) { next(err) }
})

// PATCH /api/admin/flags/:id/points { points } — quick edit of a flag's value; everyone who already captured it is re-scored by the difference
router.patch('/flags/:id/points', async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const id = Number(req.params.id)
    const pts = Number(req.body?.points)
    if (!Number.isInteger(pts) || pts < 1 || pts > 100000) return res.status(422).json({ message: 'Points: whole number 1–100000.', errors: { points: 'Points: whole number 1–100000.' } })
    await conn.beginTransaction()
    const [[old]] = await conn.query('SELECT id, title, points FROM flags WHERE id = ? FOR UPDATE', [id])
    if (!old) { await conn.rollback(); return res.status(404).json({ message: 'Flag not found.' }) }
    await conn.query('UPDATE flags SET points = ? WHERE id = ?', [pts, id])
    const { rescored, delta } = await rescoreSolvers(conn, id, old.title, pts, old.points)
    await conn.commit()
    const [[row]] = await pool.query(`${FLAG_SQL} WHERE f.id = ? GROUP BY f.id`, [id])
    res.json({ flag: publicFlag(row), rescored, delta })
  } catch (err) { await conn.rollback().catch(() => {}); next(err) } finally { conn.release() }
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
      `SELECT s.id, s.answer, s.correct, s.created_at, s.student_email AS student_id, st.full_name AS student, st.email, f.id AS flag_id, f.title AS flag, f.points
         FROM submissions s JOIN students st ON st.email = s.student_email JOIN flags f ON f.id = s.flag_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY s.id DESC LIMIT 300`,
      args,
    )
    res.json({ submissions: rows })
  } catch (err) { next(err) }
})

// DELETE /api/admin/submissions/:id[?refund=1] — e.g. to give a student an attempt back.
// By default the score is not touched. With ?refund=1, removing a CORRECT submission also takes back the points that capture awarded
// (a negative score event, so the history stays auditable and students.score keeps equalling the sum of score_events), all in one transaction.
router.delete('/submissions/:id', async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const id = Number(req.params.id)
    const refund = req.query.refund === '1'
    await conn.beginTransaction()
    const [[sub]] = await conn.query(
      `SELECT s.id, s.student_email, s.flag_id, s.correct, f.title, f.points
         FROM submissions s JOIN flags f ON f.id = s.flag_id WHERE s.id = ? FOR UPDATE`,
      [id],
    )
    if (!sub) { await conn.rollback(); return res.status(404).json({ message: 'Submission not found.' }) }
    await conn.query('DELETE FROM submissions WHERE id = ?', [id])
    let refunded = 0
    if (refund && Number(sub.correct)) {
      // take back exactly what this student was credited for the flag (award + any later points changes); fall back to its current value
      const [[cr]] = await conn.query('SELECT COUNT(*) AS n, COALESCE(SUM(points), 0) AS total FROM score_events WHERE student_email = ? AND flag_id = ?', [sub.student_email, sub.flag_id])
      refunded = Number(cr.n) ? Number(cr.total) : Number(sub.points)
      await conn.query('INSERT INTO score_events (student_email, points, note, flag_id) VALUES (?, ?, ?, ?)', [sub.student_email, -refunded, `Removed capture: ${sub.title}`.slice(0, 120), sub.flag_id])
      await conn.query('UPDATE students SET score = score - ? WHERE email = ?', [refunded, sub.student_email])
    }
    await conn.commit()
    res.json({ ok: true, refunded })
  } catch (err) { await conn.rollback().catch(() => {}); next(err) } finally { conn.release() }
})

export default router
