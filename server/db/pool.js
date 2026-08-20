const { Pool } = require('pg');
const env = require('../config/env');

const hasDatabaseConfig = Boolean(
  env.database.host &&
  env.database.name &&
  env.database.user &&
  env.database.password
);

const pool = hasDatabaseConfig
  ? new Pool({
      host: env.database.host,
      port: env.database.port,
      database: env.database.name,
      user: env.database.user,
      password: env.database.password,
      ssl: env.database.ssl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    })
  : null;

async function checkDatabase() {
  if (!pool) {
    return { configured: false, connected: false };
  }

  const result = await pool.query('SELECT 1 AS healthy');
  return { configured: true, connected: result.rows[0].healthy === 1 };
}

module.exports = { pool, checkDatabase };
