// Inserts demo students with CTF scores so the dashboard scoreboard has something to show.
// Run with: npm run db:seed   (safe to re-run: existing emails are skipped; remove with npm run db:seed -- --clear)
import { pool } from './db.js'
import { ensureSchema } from './schema.js'

const DEMO = [
  ['Diya Krishnan', 'Tech Institute', 'CSE', '22CS-014', 1150],
  ['Aarav Mehta', 'Demo College', 'IT', '22IT-031', 980],
  ['Ishaan Rao', 'Demo College', 'ECE', '22EC-007', 870],
  ['Ananya Iyer', 'Vidya University', 'CSE', '21CS-102', 820],
  ['Rohan Verma', 'Tech Institute', 'CSE', '22CS-055', 760],
  ['Sneha Pillai', 'Vidya University', 'IT', '21IT-019', 690],
  ['Kabir Singh', 'Demo College', 'ECE', '22EC-040', 640],
  ['Meera Nair', 'Tech Institute', 'CSE', '22CS-088', 590],
  ['Arjun Das', 'Vidya University', 'CSE', '21CS-077', 510],
  ['Tanvi Joshi', 'Demo College', 'IT', '22IT-012', 450],
  ['Vikram Sethi', 'Tech Institute', 'ECE', '22EC-061', 380],
  ['Nisha Reddy', 'Vidya University', 'IT', '21IT-045', 220],
]

const clear = process.argv.includes('--clear')
await ensureSchema()
if (clear) {
  const [r] = await pool.query("DELETE FROM students WHERE email LIKE 'demo.%@example.com'")
  console.log(`Removed ${r.affectedRows} demo students.`)
} else {
  let added = 0
  const start = Date.now() - 5 * 60 * 60 * 1000 // "CTF started 5 hours ago"
  for (const [i, [name, institution, branch, roll, score]] of DEMO.entries()) {
    const email = `demo.${i + 1}@example.com`
    const [r] = await pool.query(
      `INSERT IGNORE INTO students (full_name, email, phone, institution, branch, roll_number, score)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, `98765${String(43200 + i).padStart(5, '0')}`, institution, branch, roll, score],
    )
    if (!r.affectedRows) continue
    added += r.affectedRows
    // Split the total into 4–8 flag captures at pseudo-random times (deterministic per student).
    const n = 4 + ((i * 7) % 5)
    const weights = Array.from({ length: n }, (_, k) => 1 + ((i * 13 + k * 5) % 4))
    const sum = weights.reduce((a, b) => a + b, 0)
    let remaining = score
    const rows = []
    for (let k = 0; k < n; k++) {
      const pts = k === n - 1 ? remaining : Math.round((score * weights[k]) / sum / 10) * 10
      remaining -= pts
      const minutes = Math.round((300 * (k + 1)) / (n + 1) + ((i * 11 + k * 17) % 23) - 11)
      rows.push([r.insertId, pts, `flag ${k + 1}`, new Date(start + minutes * 60 * 1000)])
    }
    await pool.query('INSERT INTO score_events (student_id, points, note, created_at) VALUES ?', [rows])
  }
  console.log(`Seeded ${added} demo students (${DEMO.length - added} already present). Log in as any of them with email demo.N@example.com and the roll number shown above.`)
}
await pool.end()
