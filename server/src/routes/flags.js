import { createHash } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../config/db.js'
import { invalidateBoard } from '../lib/boardCache.js'
import { rateLimit } from '../lib/rateLimit.js'
import { requireAuth } from '../lib/token.js'

const router = Router()
export const MAX_ATTEMPTS = 3

/** Flags are compared case-insensitively with surrounding whitespace removed, then hashed. */
export const normalize = (v) => String(v ?? '').trim().toLowerCase()
/** A positive whole-number id from a URL/query value, or null (so 'abc' or '1; DROP' never reaches SQL as NaN). */
export const intId = (v) => (/^[0-9]{1,10}$/.test(String(v)) && Number(v) > 0 ? Number(v) : null)
export const hashAnswer = (v) => createHash('sha256').update(normalize(v)).digest('hex')

// GET /api/flags — every flag with this student's progress (attempts used, solved). Answers never leave the server.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [flags] = await pool.query('SELECT id, title, points, level, frozen, question_url FROM flags ORDER BY sort_order ASC, id ASC')
    const [subs] = await pool.query(
      'SELECT flag_id, COUNT(*) AS attempts, MAX(correct) AS solved, MAX(created_at) AS last FROM submissions WHERE student_email = ? GROUP BY flag_id',
      [req.studentId],
    )
    const byFlag = new Map(subs.map((s) => [s.flag_id, s]))
    res.json({
      maxAttempts: MAX_ATTEMPTS,
      flags: flags.map((f) => {
        const s = byFlag.get(f.id)
        return { ...f, frozen: !!Number(f.frozen), attempts: Number(s?.attempts ?? 0), solved: !!Number(s?.solved ?? 0), lastAt: s?.last ?? null }
      }),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/flags/:id/submit { answer } — at most MAX_ATTEMPTS per flag; a correct answer awards the points once.
// Each flag already allows only MAX_ATTEMPTS tries; this also stops a script hammering the endpoint (and the database) across flags.
const submitLimit = rateLimit({ windowMs: 60_000, max: 20, key: (req) => `s:${req.studentId}`, message: 'Slow down: too many submissions. Try again in a minute.' })
router.post('/:id/submit', requireAuth, submitLimit, async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const flagId = intId(req.params.id)
    if (flagId === null) return res.status(404).json({ message: 'Unknown flag.' })
    const answer = String(req.body?.answer ?? '')
    if (!answer.trim()) return res.status(422).json({ message: 'Paste the flag first.' })

    await conn.beginTransaction()
    const [[flag]] = await conn.query('SELECT id, title, points, answer_hash, frozen FROM flags WHERE id = ? FOR UPDATE', [flagId])
    if (!flag) { await conn.rollback(); return res.status(404).json({ message: 'Unknown flag.' }) }
    if (Number(flag.frozen)) { await conn.rollback(); return res.status(423).json({ message: 'This flag is frozen by the organisers. Submissions are paused.', frozen: true }) }

    const [[st]] = await conn.query(
      'SELECT COUNT(*) AS attempts, COALESCE(MAX(correct), 0) AS solved FROM submissions WHERE student_email = ? AND flag_id = ? FOR UPDATE',
      [req.studentId, flagId],
    )
    if (Number(st.solved)) { await conn.rollback(); return res.status(409).json({ message: 'Already solved.', solved: true, attempts: Number(st.attempts) }) }
    if (Number(st.attempts) >= MAX_ATTEMPTS) { await conn.rollback(); return res.status(429).json({ message: 'No attempts left for this flag.', attempts: Number(st.attempts) }) }

    const correct = hashAnswer(answer) === flag.answer_hash
    await conn.query('INSERT INTO submissions (student_email, flag_id, answer, correct) VALUES (?, ?, ?, ?)', [req.studentId, flagId, answer.trim().slice(0, 200), correct ? 1 : 0])
    // An admin can delete a capture and keep its points (no refund). If the student still holds credit for this flag, a fresh correct
    // answer is recorded but must not pay again; after a refund the net credit is 0, so a re-capture pays normally.
    let paid = correct
    if (correct) {
      const [[held]] = await conn.query('SELECT COALESCE(SUM(points), 0) AS pts FROM score_events WHERE student_email = ? AND flag_id = ?', [req.studentId, flagId])
      paid = Number(held.pts) <= 0
    }
    if (paid) {
      // flag_id ties the award to its flag, so a later points change re-scores exactly what this student was credited
      await conn.query('INSERT INTO score_events (student_email, points, note, flag_id) VALUES (?, ?, ?, ?)', [req.studentId, flag.points, flag.title, flagId])
      await conn.query('UPDATE students SET score = score + ? WHERE email = ?', [flag.points, req.studentId])
    }
    await conn.commit()
    if (correct) invalidateBoard() // a capture changes the ranking and the score-over-time chart
    const attempts = Number(st.attempts) + 1
    res.json(correct
      ? paid
        ? { correct: true, attempts, points: flag.points, message: `Correct — +${flag.points} points.` }
        : { correct: true, attempts, points: 0, message: 'Correct — the organisers kept your points for this flag, so nothing more is added.' }
      : { correct: false, attempts, message: attempts >= MAX_ATTEMPTS ? 'Incorrect. No attempts left.' : `Incorrect. ${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts === 1 ? '' : 's'} left.` })
  } catch (err) {
    await conn.rollback().catch(() => {})
    next(err)
  } finally {
    conn.release()
  }
})

export default router
