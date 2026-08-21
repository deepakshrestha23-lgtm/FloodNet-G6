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
    p.home_zone_id,
    p.home_ward_id,
    hw.ward_number AS home_ward_number,
    hw.name AS home_ward_name,
    hll.id AS home_local_level_id,
    hll.name AS home_local_level_name,
    hd.id AS home_district_id,
    hd.name AS home_district_name,
    hp.id AS home_province_id,
    hp.name AS home_province_name
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
  LEFT JOIN user_profiles p ON p.user_id = u.id
  LEFT JOIN geo_wards hw ON hw.id = p.home_ward_id
  LEFT JOIN geo_local_levels hll ON hll.id = hw.local_level_id
  LEFT JOIN geo_districts hd ON hd.id = hll.district_id
  LEFT JOIN geo_provinces hp ON hp.id = hd.province_id
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
      homeZoneId: row.home_zone_id,
      homeWardId: row.home_ward_id,
      // The identifiers are repeated here so the profile form can repopulate
      // the cascading province/district/local-level selector directly.
      homeWard: row.home_ward_id ? {
        id: row.home_ward_id,
        number: row.home_ward_number,
        name: row.home_ward_name,
        localLevel: { id: row.home_local_level_id, name: row.home_local_level_name },
        district: { id: row.home_district_id, name: row.home_district_name },
        province: { id: row.home_province_id, name: row.home_province_name }
      } : null
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
  homeZoneId,
  homeWardId
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

    if (homeWardId) {
      const wardResult = await client.query(
        `
          SELECT 1
          FROM geo_wards w
          INNER JOIN geo_local_levels ll ON ll.id = w.local_level_id
          INNER JOIN geo_districts d ON d.id = ll.district_id
          INNER JOIN geo_provinces p ON p.id = d.province_id
          WHERE w.id = $1 AND w.is_active = TRUE AND ll.is_active = TRUE
            AND d.is_active = TRUE AND p.is_active = TRUE
        `,
        [homeWardId]
      );

      if (wardResult.rowCount === 0) {
        const error = new Error('The selected home ward is invalid or inactive');
        error.code = 'INVALID_HOME_WARD';
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
        INSERT INTO user_profiles (user_id, first_name, last_name, phone, home_zone_id, home_ward_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [userId, firstName, lastName, phone || null, homeZoneId || null, homeWardId || null]
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

async function isActiveWard(wardId) {
  const result = await getPool().query(
    `
      SELECT 1
      FROM geo_wards w
      INNER JOIN geo_local_levels ll ON ll.id = w.local_level_id
      INNER JOIN geo_districts d ON d.id = ll.district_id
      INNER JOIN geo_provinces p ON p.id = d.province_id
      WHERE w.id = $1 AND w.is_active = TRUE AND ll.is_active = TRUE
        AND d.is_active = TRUE AND p.is_active = TRUE
    `,
    [wardId]
  );

  return result.rowCount > 0;
}

async function updateProfile(userId, {
  firstName,
  lastName,
  phone,
  homeZoneId,
  homeWardId
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
            home_ward_id = $6,
            updated_at = NOW()
        WHERE user_id = $1
        RETURNING user_id
      `,
      [userId, firstName, lastName, phone || null, homeZoneId || null, homeWardId || null]
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

/**
 * Replaces the password and ends every other session the account has open.
 *
 * The session the caller is using is kept alive so changing a password does
 * not sign you out of the browser you are sitting in front of, while a stolen
 * refresh token held anywhere else stops working immediately.
 */
async function updatePassword(userId, passwordHash, { keepSessionId = null } = {}) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE users
        SET password_hash = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [userId, passwordHash]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const revoked = await client.query(
      `
        UPDATE auth_sessions
        SET revoked_at = NOW()
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND ($2::UUID IS NULL OR id <> $2::UUID)
        RETURNING id
      `,
      [userId, keepSessionId]
    );

    await client.query(
      `
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES ($1, 'USER_PASSWORD_CHANGED', 'USER', $1, $2::JSONB)
      `,
      [userId, JSON.stringify({ revokedSessions: revoked.rowCount })]
    );

    await client.query('COMMIT');
    return true;
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
  updatePassword,
  isActiveZone,
  isActiveWard,
  updateProfile
};
