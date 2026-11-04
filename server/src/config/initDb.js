// Creates the `cyber_ops` schema if it doesn't exist yet. Run with: npm run db:init
import mysql from 'mysql2/promise'

const name = process.env.DB_NAME ?? 'cyber_ops'

const conn = await mysql.createConnection({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
})

try {
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  console.log(`Schema "${name}" is ready.`)
} finally {
  await conn.end()
}
