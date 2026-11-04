import { createHash } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../config/db.js'
import { requireAuth } from '../lib/token.js'

const router = Router()
export const MAX_ATTEMPTS = 3

/** Flags are compared case-insensitively with surrounding whitespace removed, then hashed. */
export const normalize = (v) => String(v ?? '').trim().toLowerCase()
export const hashAnswer = (v) => createHash('sha256').update(normalize(v)).digest('hex')

// GET /api/flags — every flag with this student's progress (attempts used, solved). Answers never leave the server.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [flags] = await pool.query('SELECT id, title, points, question_url FROM flags ORDER BY sort_order ASC, id ASC')
    const [subs] = await pool.query(
      'SELECT flag_id, COUNT(*) AS attempts, MAX(correct) AS solved, MAX(created_at) AS last FROM submissions WHERE student_id = ? GROUP BY flag_id',
      [req.studentId],
    )
    const byFlag = new Map(subs.map((s) => [s.flag_id, s]))
    res.json({
      maxAttempts: MAX_ATTEMPTS,
      flags: flags.map((f) => {
        const s = byFlag.get(f.id)
        return { ...f, attempts: Number(s?.attempts ?? 0), solved: !!Number(s?.solved ?? 0), lastAt: s?.last ?? null }
      }),
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/flags/:id/submit { answer } — at most MAX_ATTEMPTS per flag; a correct answer awards the points once.
router.post('/:id/submit', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection()
  try {
    const flagId = Number(req.params.id)
    const answer = String(req.body?.answer ?? '')
    if (!answer.trim()) return res.status(422).json({ message: 'Paste the flag first.' })

    await conn.beginTransaction()
    const [[flag]] = await conn.query('SELECT id, title, points, answer_hash FROM flags WHERE id = ? FOR UPDATE', [flagId])
    if (!flag) { await conn.rollback(); return res.status(404).json({ message: 'Unknown flag.' }) }

    const [[st]] = await conn.query(
      'SELECT COUNT(*) AS attempts, COALESCE(MAX(correct), 0) AS solved FROM submissions WHERE student_id = ? AND flag_id = ? FOR UPDATE',
      [req.studentId, flagId],
    )
    if (Number(st.solved)) { await conn.rollback(); return res.status(409).json({ message: 'Already solved.', solved: true, attempts: Number(st.attempts) }) }
    if (Number(st.attempts) >= MAX_ATTEMPTS) { await conn.rollback(); return res.status(429).json({ message: 'No attempts left for this flag.', attempts: Number(st.attempts) }) }

    const correct = hashAnswer(answer) === flag.answer_hash
    await conn.query('INSERT INTO submissions (student_id, flag_id, answer, correct) VALUES (?, ?, ?, ?)', [req.studentId, flagId, answer.trim().slice(0, 200), correct ? 1 : 0])
    if (correct) {
      await conn.query('INSERT INTO score_events (student_id, points, note) VALUES (?, ?, ?)', [req.studentId, flag.points, flag.title])
      await conn.query('UPDATE students SET score = score + ? WHERE id = ?', [flag.points, req.studentId])
    }
    await conn.commit()
    const attempts = Number(st.attempts) + 1
    res.json(correct
      ? { correct: true, attempts, points: flag.points, message: `Correct — +${flag.points} points.` }
      : { correct: false, attempts, message: attempts >= MAX_ATTEMPTS ? 'Incorrect. No attempts left.' : `Incorrect. ${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts === 1 ? '' : 's'} left.` })
  } catch (err) {
    await conn.rollback().catch(() => {})
    next(err)
  } finally {
    conn.release()
  }
})

export default router
