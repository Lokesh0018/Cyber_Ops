import { pool } from './db.js'

// Creates the tables the API needs if they don't exist yet. Called once at server start.
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      full_name     VARCHAR(120)  NOT NULL,
      email         VARCHAR(190)  NOT NULL UNIQUE,
      phone         VARCHAR(20)   NOT NULL,
      institution   VARCHAR(160)  NOT NULL,
      level         VARCHAR(40)   NOT NULL,
      password_hash VARCHAR(255)  NOT NULL,
      created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}
