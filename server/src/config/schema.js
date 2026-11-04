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
      created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  if (have.has('password_hash')) await pool.query('ALTER TABLE students DROP COLUMN password_hash')
  if (have.has('level')) await pool.query('ALTER TABLE students DROP COLUMN level') // role field removed
}
