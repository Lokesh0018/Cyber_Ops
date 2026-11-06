import { pool } from './db.js'

// Creates the tables the API needs if they don't exist yet. Called once at server start (idempotent).
//
// Design notes (MySQL 8):
//  - students.email is the primary key (already unique, stored lower-case, and what people log in with).
//    submissions/score_events reference it with ON UPDATE CASCADE, so correcting an email keeps the history attached.
//    Trade-off: child tables store the email text (up to 190 chars) instead of a 4-byte number, so their indexes are larger.
//  - Every foreign key has an index that starts with the FK column, so cascades and joins never scan.
//  - Indexes are chosen for the queries the routes actually run (named next to each one below).
//  - submissions.solved_once + uq_one_capture make "one correct capture per student per flag" a database rule,
//    so a double-click or race can never award the points twice (NULLs are ignored by UNIQUE, so wrong answers are unlimited by the index).
//  - Counters stay derived (COUNT over covering indexes) rather than duplicated, so they can't drift out of sync.
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      email       VARCHAR(190)  NOT NULL,
      full_name   VARCHAR(120)  NOT NULL,
      phone       VARCHAR(20)   NOT NULL,
      institution VARCHAR(160)  NOT NULL,
      branch      VARCHAR(80)   NOT NULL DEFAULT '',
      roll_number VARCHAR(40)   NOT NULL DEFAULT '',
      score       INT           NOT NULL DEFAULT 0,
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (email),
      KEY ix_students_rank (score DESC, full_name),
      KEY ix_students_institution (institution, score)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // CTF flags. The answer is stored as plaintext (organisers read/edit it in the console) and as the SHA-256 of the normalised flag (what submissions are checked against).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS flags (
      id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
      title        VARCHAR(80)   NOT NULL,
      points       INT UNSIGNED  NOT NULL,
      level        ENUM('easy','medium','hard') NOT NULL DEFAULT 'easy',
      frozen       TINYINT(1)    NOT NULL DEFAULT 0,
      answer       VARCHAR(200)  NOT NULL DEFAULT '',
      answer_hash  CHAR(64)      NOT NULL,
      question_url VARCHAR(300)  NOT NULL DEFAULT '',
      sort_order   INT           NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uq_flags_title (title),
      KEY ix_flags_order (sort_order, id),
      CONSTRAINT ck_flags_points CHECK (points BETWEEN 1 AND 100000)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Every submission attempt (right or wrong).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
      student_email VARCHAR(190) NOT NULL,
      flag_id     INT UNSIGNED  NOT NULL,
      answer      VARCHAR(200)  NOT NULL,
      correct     TINYINT(1)    NOT NULL DEFAULT 0,
      created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      solved_once TINYINT       GENERATED ALWAYS AS (IF(correct = 1, 1, NULL)) STORED,
      PRIMARY KEY (id),
      UNIQUE KEY uq_one_capture (student_email, flag_id, solved_once),
      KEY ix_sub_student_flag (student_email, flag_id, correct, created_at),
      KEY ix_sub_flag (flag_id, correct),
      KEY ix_sub_created (created_at),
      CONSTRAINT fk_sub_student FOREIGN KEY (student_email) REFERENCES students(email) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_sub_flag    FOREIGN KEY (flag_id)    REFERENCES flags(id)    ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Every award or deduction of points, so the scoreboard can draw score over time. students.score is the running total.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS score_events (
      id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
      student_email VARCHAR(190) NOT NULL,
      points     INT           NOT NULL,
      flag_id    INT UNSIGNED  NULL,
      note       VARCHAR(120)  NOT NULL DEFAULT '',
      created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY ix_events_student_time (student_email, created_at),
      KEY ix_events_flag (flag_id, student_email),
      CONSTRAINT fk_score_student FOREIGN KEY (student_email) REFERENCES students(email) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_score_flag    FOREIGN KEY (flag_id)       REFERENCES flags(id)       ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Upgrade for databases created before score_events.flag_id existed: add the column, then link old awards/refunds to their flag by note.
  // (flag_id lets a points change re-score each solver by exactly what they were credited for that flag.)
  const [fid] = await pool.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'score_events' AND COLUMN_NAME = 'flag_id' LIMIT 1",
  )
  if (!fid.length) {
    await pool.query(
      'ALTER TABLE score_events ADD COLUMN flag_id INT UNSIGNED NULL AFTER student_email, ADD KEY ix_events_flag (flag_id, student_email), ' +
      'ADD CONSTRAINT fk_score_flag FOREIGN KEY (flag_id) REFERENCES flags(id) ON DELETE SET NULL',
    )
    await pool.query('UPDATE score_events e JOIN flags f ON e.note = f.title SET e.flag_id = f.id WHERE e.flag_id IS NULL AND e.points > 0')
    await pool.query("UPDATE score_events e JOIN flags f ON e.note = CONCAT('Removed capture: ', f.title) SET e.flag_id = f.id WHERE e.flag_id IS NULL AND e.points < 0")
  }
  // Live captures recorded by older server versions had no flag_id; link them (captures only: positive events titled exactly like a flag).
  // Idempotent: once linked, a row no longer matches, so this is a no-op on later starts.
  await pool.query('UPDATE score_events e JOIN flags f ON e.note = f.title SET e.flag_id = f.id WHERE e.flag_id IS NULL AND e.points > 0')
}
