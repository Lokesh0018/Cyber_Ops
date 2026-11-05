import { pool } from './db.js'

// Creates the tables the API needs if they don't exist yet, and brings older ones up to date.
// Called once at server start.
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      full_name     VARCHAR(120)  NOT NULL,
      email         VARCHAR(190)  NOT NULL UNIQUE,
      phone         VARCHAR(20)   NOT NULL,
      institution   VARCHAR(160)  NOT NULL,
      branch        VARCHAR(80)   NOT NULL DEFAULT '',
      roll_number   VARCHAR(40)   NOT NULL DEFAULT '',
      score         INT           NOT NULL DEFAULT 0,
      created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Every award of points, so the scoreboard can draw score over time. students.score is the running total.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS score_events (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      student_id INT UNSIGNED NOT NULL,
      points     INT          NOT NULL,
      note       VARCHAR(120) NOT NULL DEFAULT '',
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX (student_id, created_at),
      CONSTRAINT fk_score_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // CTF flags (answers stored as SHA-256 of the normalised flag) and every submission attempt.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flags (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title        VARCHAR(80)  NOT NULL UNIQUE,
      points       INT          NOT NULL,
      answer_hash  CHAR(64)     NOT NULL,
      question_url VARCHAR(300) NOT NULL DEFAULT '',
      sort_order   INT          NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      student_id INT UNSIGNED NOT NULL,
      flag_id    INT UNSIGNED NOT NULL,
      answer     VARCHAR(200) NOT NULL,
      correct    TINYINT(1)   NOT NULL DEFAULT 0,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX (student_id, flag_id),
      CONSTRAINT fk_sub_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      CONSTRAINT fk_sub_flag FOREIGN KEY (flag_id) REFERENCES flags(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Migration for tables created before branch/roll number replaced the password.
  const [cols] = await pool.query(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    ['students'],
  )
  const have = new Set(cols.map((c) => c.COLUMN_NAME))
  if (!have.has('branch')) await pool.query("ALTER TABLE students ADD COLUMN branch VARCHAR(80) NOT NULL DEFAULT '' AFTER institution")
  if (!have.has('roll_number')) await pool.query("ALTER TABLE students ADD COLUMN roll_number VARCHAR(40) NOT NULL DEFAULT '' AFTER branch")
  if (!have.has('score')) await pool.query('ALTER TABLE students ADD COLUMN score INT NOT NULL DEFAULT 0 AFTER roll_number') // CTF score, set by organisers
  if (have.has('password_hash')) await pool.query('ALTER TABLE students DROP COLUMN password_hash')
  if (have.has('level')) await pool.query('ALTER TABLE students DROP COLUMN level') // role field removed

  // Flags keep the plaintext answer alongside the hash so organisers can read and edit it in the admin console.
  const [fcols] = await pool.query(
    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    ['flags'],
  )
  if (!fcols.some((c) => c.COLUMN_NAME === 'answer')) await pool.query("ALTER TABLE flags ADD COLUMN answer VARCHAR(200) NOT NULL DEFAULT '' AFTER points")
}
