const { pool } = require('../db/pool');

/**
 * How long the immediately previous refresh token stays acceptable after a
 * rotation. This exists only to absorb concurrent refreshes from the same
 * client; it is deliberately short so a genuinely leaked token is not usable.
 */
const ROTATION_GRACE_SECONDS = 30;

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

/**
 * Accepts the current refresh token, or the previous one while it is still
 * inside the rotation grace window. `matchedPrevious` tells the caller which
 * one was used so the behaviour can be logged and tested.
 */
async function findValidSession(id, refreshTokenHash) {
  const result = await getPool().query(
    `
      SELECT
        id,
        user_id,
        expires_at,
        (refresh_token_hash = $2) AS matched_current,
        (
          previous_token_hash IS NOT NULL
          AND previous_token_hash = $2
          AND rotated_at IS NOT NULL
          AND rotated_at > NOW() - ($3 || ' seconds')::INTERVAL
        ) AS matched_previous
      FROM auth_sessions
      WHERE id = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()
        AND (
          refresh_token_hash = $2
          OR (
            previous_token_hash IS NOT NULL
            AND previous_token_hash = $2
            AND rotated_at IS NOT NULL
            AND rotated_at > NOW() - ($3 || ' seconds')::INTERVAL
          )
        )
    `,
    [id, refreshTokenHash, String(ROTATION_GRACE_SECONDS)]
  );

  const row = result.rows[0];

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    expires_at: row.expires_at,
    matchedPrevious: row.matched_previous === true && row.matched_current !== true
  };
}

/**
 * Rotates the stored token.
 *
 * `keepPreviousToken` is set when the caller presented the previous token from
 * inside the grace window, which happens when several requests refresh at once.
 * In that case the already-demoted hash is left in place rather than being
 * replaced, so the token the client is still holding stays acceptable for the
 * whole grace window instead of falling off the chain after two rotations.
 */
async function rotateSession(id, refreshTokenHash, expiresAt, { keepPreviousToken = false } = {}) {
  await getPool().query(
    `
      UPDATE auth_sessions
      SET previous_token_hash = CASE
            WHEN $4::BOOLEAN THEN previous_token_hash
            ELSE refresh_token_hash
          END,
          refresh_token_hash = $2,
          rotated_at = CASE
            WHEN $4::BOOLEAN THEN rotated_at
            ELSE NOW()
          END,
          expires_at = $3
      WHERE id = $1
        AND revoked_at IS NULL
    `,
    [id, refreshTokenHash, expiresAt, keepPreviousToken]
  );
}

/**
 * Validates and rotates a refresh session as one locked database operation.
 *
 * Without the row lock, several requests can all validate the same current
 * token before any of them updates the row. Each request then overwrites the
 * previous-token slot and the original token falls out of the grace window.
 * The lock makes exactly one request perform the rotation. Requests that were
 * already in flight are accepted through the short previous-token grace
 * window without changing the session again.
 */
async function rotateSessionAtomically(
  id,
  presentedTokenHash,
  nextRefreshTokenHash,
  expiresAt
) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        SELECT
          id,
          user_id,
          expires_at,
          revoked_at,
          (refresh_token_hash = $2) AS matched_current,
          (
            previous_token_hash IS NOT NULL
            AND previous_token_hash = $2
            AND rotated_at IS NOT NULL
            AND rotated_at > NOW() - ($3 || ' seconds')::INTERVAL
          ) AS matched_previous
        FROM auth_sessions
        WHERE id = $1
        FOR UPDATE
      `,
      [id, presentedTokenHash, String(ROTATION_GRACE_SECONDS)]
    );

    const row = result.rows[0];
    const sessionExpired = !row || new Date(row.expires_at).getTime() <= Date.now();

    if (!row || row.revoked_at || sessionExpired) {
      await client.query('COMMIT');
      return null;
    }

    const matchedCurrent = row.matched_current === true;
    const matchedPrevious = !matchedCurrent && row.matched_previous === true;

    if (!matchedCurrent && !matchedPrevious) {
      await client.query('COMMIT');
      return null;
    }

    if (matchedCurrent) {
      await client.query(
        `
          UPDATE auth_sessions
          SET previous_token_hash = refresh_token_hash,
              refresh_token_hash = $2,
              rotated_at = NOW(),
              expires_at = $3
          WHERE id = $1
        `,
        [id, nextRefreshTokenHash, expiresAt]
      );
    }

    await client.query('COMMIT');

    return {
      id: row.id,
      user_id: row.user_id,
      expires_at: matchedCurrent ? expiresAt : row.expires_at,
      matchedPrevious
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function revokeSession(id) {
  await getPool().query(
    `UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
    [id]
  );
}

module.exports = {
  ROTATION_GRACE_SECONDS,
  createSession,
  findValidSession,
  rotateSession,
  rotateSessionAtomically,
  revokeSession
};
