// Temporary TEST DATA so every screen has something to show. Not for the real event.
//
//   npm run db:seed              insert flags + demo students/submissions (skips if demo students already exist)
//   npm run db:seed -- --reset   remove the demo students (and their submissions/score events), then insert fresh data with times relative to now
//   npm run db:seed -- --clear   remove the demo students only
//
// Demo students are the ones with email demo.N@example.com. Student login = that email + the roll number from DEMO below.
// Data is internally consistent: each student's score = the points of the flags they captured (+ one organiser bonus),
// submissions respect the 3-attempts-per-flag rule, and times are spread over the last ~5 hours with some activity in the last few minutes
// (so the live admin charts have something to draw).
import { pool } from './db.js'
import { ensureSchema } from './schema.js'
import { hashAnswer, MAX_ATTEMPTS } from '../routes/flags.js'

// name, college, branch, roll, skill (0..1: how many flags they get through), pace (0..1: how recently they were active)
const DEMO = [
  ['Diya Krishnan', 'Tech Institute', 'CSE', '22CS-014', 0.95, 0.9],
  ['Aarav Mehta', 'Demo College', 'IT', '22IT-031', 0.85, 0.7],
  ['Ishaan Rao', 'Demo College', 'ECE', '22EC-007', 0.75, 0.95],
  ['Ananya Iyer', 'Vidya University', 'CSE', '21CS-102', 0.72, 0.5],
  ['Rohan Verma', 'Tech Institute', 'CSE', '22CS-055', 0.65, 0.8],
  ['Sneha Pillai', 'Vidya University', 'IT', '21IT-019', 0.6, 0.4],
  ['Kabir Singh', 'Demo College', 'ECE', '22EC-040', 0.55, 0.85],
  ['Meera Nair', 'Tech Institute', 'CSE', '22CS-088', 0.5, 0.3],
  ['Arjun Das', 'Vidya University', 'CSE', '21CS-077', 0.45, 0.6],
  ['Tanvi Joshi', 'Demo College', 'IT', '22IT-012', 0.4, 0.75],
  ['Vikram Sethi', 'Tech Institute', 'ECE', '22EC-061', 0.32, 0.2],
  ['Nisha Reddy', 'Vidya University', 'IT', '21IT-045', 0.25, 0.55],
  ['Farhan Ali', 'Nova Engineering College', 'CSE', '23CS-003', 0.7, 0.92],
  ['Priya Menon', 'Nova Engineering College', 'IT', '23IT-021', 0.35, 0.65],
  ['Karthik Bose', 'Nova Engineering College', 'ECE', '23EC-018', 0.2, 0.1],
  ['Zoya Khan', 'Tech Institute', 'IT', '22IT-077', 0.12, 0.45],
]

/* Placeholder challenges: title, points, answer, link to the question/assets. Replace the answers and links
   with the real ones before the event (edit here and re-run `npm run db:seed`, which updates existing flags by title). */
const FLAGS = [
  ['Flag 1', 100, 'CYBEROPS{demo_flag_1}', '/#ctf'],
  ['Flag 2', 200, 'CYBEROPS{demo_flag_2}', '/#ctf'],
  ['Flag 3', 300, 'CYBEROPS{demo_flag_3}', '/#ctf'],
  ['Flag 4', 500, 'CYBEROPS{demo_flag_4}', '/#ctf'],
  ['Flag 5', 700, 'CYBEROPS{demo_flag_5}', '/#ctf'],
  ['Flag 6', 900, 'CYBEROPS{demo_flag_6}', '/#ctf'],
  ['Flag 7', 1000, 'CYBEROPS{demo_flag_7}', '/#ctf'],
]
const WRONG = ['CYBEROPS{test}', 'flag{admin}', 'CYBEROPS{password}', 'cyberops{demo}', 'CTF{wrong}', 'CYBEROPS{flag_1}', 'admin', 'CYBEROPS{ctf_2024}']
const levelOf = (points) => (points <= 300 ? 'easy' : points <= 700 ? 'medium' : 'hard')

// Small deterministic PRNG so re-seeding gives the same shape of data.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clear = process.argv.includes('--clear')
const reset = process.argv.includes('--reset')
await ensureSchema()

// Flags are upserted on every run.
for (const [i, [title, points, answer, url]] of FLAGS.entries()) {
  await pool.query(
    `INSERT INTO flags (title, points, level, answer, answer_hash, question_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE points = VALUES(points), level = VALUES(level), answer = VALUES(answer), answer_hash = VALUES(answer_hash), question_url = VALUES(question_url), sort_order = VALUES(sort_order)`,
    [title, points, levelOf(points), answer, hashAnswer(answer), url, i],
  )
}
console.log(`Flags in place: ${FLAGS.length}.`)

if (clear || reset) {
  const [r] = await pool.query("DELETE FROM students WHERE email LIKE 'demo.%@example.com'") // submissions + score_events cascade
  console.log(`Removed ${r.affectedRows} demo students (and their submissions and score events).`)
}

if (!clear) {
  const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM students WHERE email LIKE 'demo.%@example.com'")
  if (n > 0) {
    console.log(`Demo students already present (${n}); nothing added. Use --reset to regenerate with fresh times.`)
  } else {
    const [flagRows] = await pool.query('SELECT id, title, points FROM flags ORDER BY sort_order, id')
    const now = Date.now()
    const MIN = 60 * 1000
    const conn = await pool.getConnection()
    let nStudents = 0, nSubs = 0, nCaptures = 0
    try {
      await conn.beginTransaction()
      for (const [i, [name, institution, branch, roll, skill, pace]] of DEMO.entries()) {
        const email = `demo.${i + 1}@example.com`
        const rand = rng(1000 + i * 97)
        const joinedAt = now - (300 + Math.round(rand() * 40)) * MIN // everyone registered around the start (~5h ago)
        await conn.query(
          'INSERT INTO students (full_name, email, phone, institution, branch, roll_number, score, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
          [name, email, `98765${String(43200 + i).padStart(5, '0')}`, institution, branch, roll, new Date(joinedAt)],
        )
        const sid = email // students are keyed by email
        nStudents++

        // Activity window: from ~10 min after joining until `lastAt`, which is closer to "now" for faster/more active students.
        const firstAt = joinedAt + 10 * MIN
        const lastAt = now - Math.round((1 - pace) * 150 * MIN * rand() + (pace > 0.8 ? 1 : 6) * MIN)
        const attemptedFlags = Math.min(flagRows.length, Math.max(1, Math.round(skill * flagRows.length + (rand() - 0.5))))
        const subs = [], events = []
        let score = 0
        for (let k = 0; k < attemptedFlags; k++) {
          const flag = flagRows[k]
          // The last attempted flag may stay unsolved (all attempts wrong); harder flags need more tries.
          const stuck = k === attemptedFlags - 1 && rand() < 0.45 && attemptedFlags < flagRows.length + 1 && skill < 0.9
          const wrongTries = stuck ? MAX_ATTEMPTS : Math.min(MAX_ATTEMPTS - 1, Math.floor(rand() * (1 + k / 3)))
          const slotStart = firstAt + ((lastAt - firstAt) * k) / attemptedFlags
          const slotLen = (lastAt - firstAt) / attemptedFlags
          const tries = wrongTries + (stuck ? 0 : 1)
          for (let t = 0; t < tries; t++) {
            const at = new Date(Math.min(now - MIN, slotStart + (slotLen * (t + 1)) / (tries + 0.5)))
            const correct = !stuck && t === tries - 1
            subs.push([sid, flag.id, correct ? FLAGS[k][2] : WRONG[Math.floor(rand() * WRONG.length)], correct ? 1 : 0, at])
            if (correct) { events.push([sid, flag.points, flag.title, at]); score += flag.points; nCaptures++ }
          }
        }
        // One organiser bonus for the top student, so manual awards show up too.
        if (i === 0) { events.push([sid, 50, 'Bonus: best writeup', new Date(now - 20 * MIN)]); score += 50 }
        if (subs.length) await conn.query('INSERT INTO submissions (student_email, flag_id, answer, correct, created_at) VALUES ?', [subs])
        if (events.length) await conn.query('INSERT INTO score_events (student_email, points, note, created_at) VALUES ?', [events])
        await conn.query('UPDATE students SET score = ? WHERE email = ?', [score, sid])
        nSubs += subs.length
      }
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
    console.log(`Seeded ${nStudents} demo students, ${nSubs} submissions (${nCaptures} captures). Log in as any of them with email demo.N@example.com and the roll number from this file.`)
  }
}
await pool.end()
