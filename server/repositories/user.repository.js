const { pool } = require('../db/pool');

function getPool() {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  return pool;
}

const userSelect = `
  SELECT
    u.id,
    u.email,
    u.password_hash,
    u.status,
    u.created_at,
    u.updated_at,
    u.last_login_at,
    r.code AS role_code,
    r.display_name AS role_display_name,
    p.first_name,
    p.last_name,
    p.phone,
    p.home_zone_id
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
  LEFT JOIN user_profiles p ON p.user_id = u.id
`;

function mapUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    roleCode: row.role_code,
    roleDisplayName: row.role_display_name,
    profile: {
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      homeZoneId: row.home_zone_id
    }
  };
}

async function findUserByEmail(email) {
  const result = await getPool().query(
    `${userSelect} WHERE LOWER(u.email) = LOWER($1)`,
    [email]
  );
  return mapUser(result.rows[0]);
}

async function findUserById(id) {
  const result = await getPool().query(
    `${userSelect} WHERE u.id = $1`,
    [id]
  );
  return mapUser(result.rows[0]);
}

async function createResident({
  email,
  passwordHash,
  firstName,
  lastName,
  phone,
  homeZoneId
}) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const roleResult = await client.query(
      `SELECT id FROM roles WHERE code = 'RESIDENT'`
    );

    if (roleResult.rowCount === 0) {
      throw new Error('RESIDENT role is missing from the database');
    }

    if (homeZoneId) {
      const zoneResult = await client.query(
        'SELECT 1 FROM flood_zones WHERE id = $1 AND is_active = TRUE',
        [homeZoneId]
      );

      if (zoneResult.rowCount === 0) {
        const error = new Error('The selected home zone is invalid or inactive');
        error.code = 'INVALID_HOME_ZONE';
        throw error;
      }
    }

    const userResult = await client.query(
      `
        INSERT INTO users (role_id, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [roleResult.rows[0].id, email, passwordHash]
    );

    const userId = userResult.rows[0].id;

    await client.query(
      `
        INSERT INTO user_profiles (user_id, first_name, last_name, phone, home_zone_id)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [userId, firstName, lastName, phone || null, homeZoneId || null]
    );

    await client.query(
      `INSERT INTO notification_preferences (user_id) VALUES ($1)`,
      [userId]
    );

    await client.query(
      `
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES ($1, 'USER_REGISTERED', 'USER', $1, '{}'::JSONB)
      `,
      [userId]
    );

    await client.query('COMMIT');
    return findUserById(userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateLastLogin(userId) {
  await getPool().query(
    'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
    [userId]
  );
}

async function isActiveZone(zoneId) {
  const result = await getPool().query(
    'SELECT 1 FROM flood_zones WHERE id = $1 AND is_active = TRUE',
    [zoneId]
  );

  return result.rowCount > 0;
}

async function updateProfile(userId, {
  firstName,
  lastName,
  phone,
  homeZoneId
}) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE user_profiles
        SET first_name = $2,
            last_name = $3,
            phone = $4,
            home_zone_id = $5,
            updated_at = NOW()
        WHERE user_id = $1
        RETURNING user_id
      `,
      [userId, firstName, lastName, phone || null, homeZoneId || null]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES ($1, 'PROFILE_UPDATED', 'USER', $1, '{}'::JSONB)
      `,
      [userId]
    );

    await client.query('COMMIT');
    return findUserById(userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  findUserByEmail,
  findUserById,
  createResident,
  updateLastLogin,
  isActiveZone,
  updateProfile
};
