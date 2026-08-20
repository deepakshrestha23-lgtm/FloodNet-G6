const { pool } = require('../db/pool');

function getPool() {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  return pool;
}

async function createSession({ id, userId, refreshTokenHash, expiresAt }) {
  await getPool().query(
    `
      INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
    `,
    [id, userId, refreshTokenHash, expiresAt]
  );
}

async function findValidSession(id, refreshTokenHash) {
  const result = await getPool().query(
    `
      SELECT id, user_id, expires_at
      FROM auth_sessions
      WHERE id = $1
        AND refresh_token_hash = $2
        AND revoked_at IS NULL
        AND expires_at > NOW()
    `,
    [id, refreshTokenHash]
  );

  return result.rows[0] || null;
}

async function rotateSession(id, refreshTokenHash, expiresAt) {
  await getPool().query(
    `
      UPDATE auth_sessions
      SET refresh_token_hash = $2,
          expires_at = $3
      WHERE id = $1
        AND revoked_at IS NULL
    `,
    [id, refreshTokenHash, expiresAt]
  );
}

async function revokeSession(id) {
  await getPool().query(
    `UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
    [id]
  );
}

module.exports = {
  createSession,
  findValidSession,
  rotateSession,
  revokeSession
};
