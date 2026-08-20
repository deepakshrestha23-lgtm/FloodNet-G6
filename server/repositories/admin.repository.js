const { pool } = require('../db/pool');
const { insertAuditLog } = require('../utils/audit');

function getPool() {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  return pool;
}

/**
 * Administrative user listings never select password_hash. Only governance
 * fields are exposed.
 */
const adminUserSelect = `
  SELECT
    u.id,
    u.email,
    u.status,
    u.created_at,
    u.last_login_at,
    r.code AS role_code,
    r.display_name AS role_display_name,
    p.first_name,
    p.last_name,
    p.phone,
    z.id AS home_zone_id,
    z.name AS home_zone_name
  FROM users u
  INNER JOIN roles r ON r.id = u.role_id
  LEFT JOIN user_profiles p ON p.user_id = u.id
  LEFT JOIN flood_zones z ON z.id = p.home_zone_id
`;

function mapAdminUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    status: row.status,
    role: {
      code: row.role_code,
      displayName: row.role_display_name
    },
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    homeZone: row.home_zone_id ? { id: row.home_zone_id, name: row.home_zone_name } : null,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
}

async function listUsers({ search, roleCode, status, limit, offset }) {
  const parameters = [
    search ? `%${search}%` : null,
    roleCode || null,
    status || null,
    limit,
    offset
  ];

  const filterClause = `
    WHERE ($1::TEXT IS NULL OR
      u.email ILIKE $1 OR
      COALESCE(p.first_name, '') ILIKE $1 OR
      COALESCE(p.last_name, '') ILIKE $1)
      AND ($2::VARCHAR IS NULL OR r.code = $2)
      AND ($3::VARCHAR IS NULL OR u.status = $3)
  `;

  const result = await getPool().query(
    `
      ${adminUserSelect}
      ${filterClause}
      ORDER BY u.created_at DESC
      LIMIT $4 OFFSET $5
    `,
    parameters
  );

  const countResult = await getPool().query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      LEFT JOIN user_profiles p ON p.user_id = u.id
      ${filterClause}
    `,
    parameters.slice(0, 3)
  );

  return {
    users: result.rows.map(mapAdminUser),
    total: countResult.rows[0].total
  };
}

async function findUserById(userId) {
  const result = await getPool().query(
    `${adminUserSelect} WHERE u.id = $1`,
    [userId]
  );

  return mapAdminUser(result.rows[0]);
}

async function createStaffUser({
  actorId,
  email,
  passwordHash,
  roleCode,
  firstName,
  lastName,
  phone
}) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const roleResult = await client.query('SELECT id FROM roles WHERE code = $1', [roleCode]);

    if (roleResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return { outcome: 'INVALID_ROLE' };
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
        INSERT INTO user_profiles (user_id, first_name, last_name, phone)
        VALUES ($1, $2, $3, $4)
      `,
      [userId, firstName, lastName, phone || null]
    );

    await client.query('INSERT INTO notification_preferences (user_id) VALUES ($1)', [userId]);

    await insertAuditLog(client, {
      actorId,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: userId,
      metadata: { roleCode }
    });

    await client.query('COMMIT');
    return { outcome: 'CREATED', userId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateUserStatus({ actorId, userId, status }) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE users
        SET status = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [userId, status]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    // Deactivating an account must also end its active sessions, otherwise an
    // existing refresh token would keep the account usable.
    if (status === 'INACTIVE') {
      await client.query(
        'UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
        [userId]
      );
    }

    await insertAuditLog(client, {
      actorId,
      action: status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'USER',
      entityId: userId,
      metadata: { status }
    });

    await client.query('COMMIT');
    return findUserById(userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateUserRole({ actorId, userId, roleCode }) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const roleResult = await client.query('SELECT id FROM roles WHERE code = $1', [roleCode]);

    if (roleResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return { outcome: 'INVALID_ROLE' };
    }

    const currentResult = await client.query(
      `
        SELECT r.code AS role_code
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1
        FOR UPDATE OF u
      `,
      [userId]
    );

    if (currentResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return { outcome: 'NOT_FOUND' };
    }

    const previousRole = currentResult.rows[0].role_code;

    await client.query(
      'UPDATE users SET role_id = $2, updated_at = NOW() WHERE id = $1',
      [userId, roleResult.rows[0].id]
    );

    // A role change alters permissions, so existing sessions are ended and the
    // user must sign in again to receive a token carrying the new role.
    await client.query(
      'UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );

    await insertAuditLog(client, {
      actorId,
      action: 'USER_ROLE_CHANGED',
      entityType: 'USER',
      entityId: userId,
      metadata: { previousRole, newRole: roleCode }
    });

    await client.query('COMMIT');
    return { outcome: 'UPDATED' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function countActiveAdministrators(excludeUserId) {
  const result = await getPool().query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE r.code = 'ADMINISTRATOR'
        AND u.status = 'ACTIVE'
        AND ($1::UUID IS NULL OR u.id <> $1)
    `,
    [excludeUserId || null]
  );

  return result.rows[0].total;
}

async function listRoles() {
  const result = await getPool().query(
    'SELECT id, code, display_name FROM roles ORDER BY display_name ASC'
  );

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    displayName: row.display_name
  }));
}

async function listZones({ includeInactive }) {
  const result = await getPool().query(
    `
      SELECT
        z.id, z.code, z.name, z.locality, z.description, z.is_active,
        z.created_at, z.updated_at,
        (SELECT COUNT(*)::INTEGER FROM flood_reports fr WHERE fr.zone_id = z.id) AS report_count,
        (SELECT COUNT(*)::INTEGER FROM evacuation_centres ec
          WHERE ec.zone_id = z.id AND ec.is_active = TRUE) AS centre_count
      FROM flood_zones z
      WHERE ($1::BOOLEAN IS TRUE OR z.is_active = TRUE)
      ORDER BY z.name ASC
    `,
    [Boolean(includeInactive)]
  );

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    locality: row.locality,
    description: row.description,
    isActive: row.is_active,
    reportCount: row.report_count,
    centreCount: row.centre_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

async function createZone({ actorId, code, name, locality, description }) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        INSERT INTO flood_zones (code, name, locality, description, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [code, name, locality || null, description || null, actorId]
    );

    const zoneId = result.rows[0].id;

    await insertAuditLog(client, {
      actorId,
      action: 'ZONE_CREATED',
      entityType: 'FLOOD_ZONE',
      entityId: zoneId,
      metadata: { code, name }
    });

    await client.query('COMMIT');
    return zoneId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateZone({ actorId, zoneId, name, locality, description, isActive }) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE flood_zones
        SET name = $2,
            locality = $3,
            description = $4,
            is_active = $5,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [zoneId, name, locality || null, description || null, isActive]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await insertAuditLog(client, {
      actorId,
      action: isActive ? 'ZONE_UPDATED' : 'ZONE_DEACTIVATED',
      entityType: 'FLOOD_ZONE',
      entityId: zoneId,
      metadata: { name, isActive }
    });

    await client.query('COMMIT');
    return zoneId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findZoneById(zoneId) {
  const result = await getPool().query(
    'SELECT id, code, name, locality, description, is_active FROM flood_zones WHERE id = $1',
    [zoneId]
  );

  const row = result.rows[0];

  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    locality: row.locality,
    description: row.description,
    isActive: row.is_active
  };
}

async function countActiveCentresInZone(zoneId) {
  const result = await getPool().query(
    'SELECT COUNT(*)::INTEGER AS total FROM evacuation_centres WHERE zone_id = $1 AND is_active = TRUE',
    [zoneId]
  );

  return result.rows[0].total;
}

async function upsertFacilityType({ actorId, facilityTypeId, code, displayName, isActive }) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    let resolvedId = facilityTypeId;

    if (facilityTypeId) {
      const result = await client.query(
        `
          UPDATE centre_facility_types
          SET display_name = $2, is_active = $3
          WHERE id = $1
          RETURNING id
        `,
        [facilityTypeId, displayName, isActive]
      );

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }
    } else {
      const result = await client.query(
        `
          INSERT INTO centre_facility_types (code, display_name, is_active)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [code, displayName, isActive]
      );

      resolvedId = result.rows[0].id;
    }

    await insertAuditLog(client, {
      actorId,
      action: facilityTypeId ? 'FACILITY_TYPE_UPDATED' : 'FACILITY_TYPE_CREATED',
      entityType: 'CENTRE_FACILITY_TYPE',
      entityId: resolvedId,
      metadata: { displayName, isActive }
    });

    await client.query('COMMIT');
    return resolvedId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listAuditLogs({ actorId, action, entityType, from, to, limit, offset }) {
  const parameters = [
    actorId || null,
    action || null,
    entityType || null,
    from || null,
    to || null,
    limit,
    offset
  ];

  const filterClause = `
    WHERE ($1::UUID IS NULL OR a.actor_id = $1)
      AND ($2::VARCHAR IS NULL OR a.action = $2)
      AND ($3::VARCHAR IS NULL OR a.entity_type = $3)
      AND ($4::TIMESTAMPTZ IS NULL OR a.created_at >= $4)
      AND ($5::TIMESTAMPTZ IS NULL OR a.created_at <= $5)
  `;

  const result = await getPool().query(
    `
      SELECT
        a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
        a.actor_id,
        u.email AS actor_email,
        r.code AS actor_role,
        p.first_name AS actor_first_name,
        p.last_name AS actor_last_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN user_profiles p ON p.user_id = a.actor_id
      ${filterClause}
      ORDER BY a.created_at DESC
      LIMIT $6 OFFSET $7
    `,
    parameters
  );

  const countResult = await getPool().query(
    `SELECT COUNT(*)::INTEGER AS total FROM audit_logs a ${filterClause}`,
    parameters.slice(0, 5)
  );

  return {
    entries: result.rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata,
      actor: row.actor_id
        ? {
            id: row.actor_id,
            email: row.actor_email,
            role: row.actor_role,
            name: [row.actor_first_name, row.actor_last_name].filter(Boolean).join(' ') || null
          }
        : null,
      createdAt: row.created_at
    })),
    total: countResult.rows[0].total
  };
}

async function listAuditActions() {
  const result = await getPool().query(
    'SELECT DISTINCT action FROM audit_logs ORDER BY action ASC'
  );

  return result.rows.map((row) => row.action);
}

async function getAdminOverview() {
  const result = await getPool().query(
    `
      SELECT
        (SELECT COUNT(*)::INTEGER FROM users) AS total_users,
        (SELECT COUNT(*)::INTEGER FROM users WHERE status = 'ACTIVE') AS active_users,
        (SELECT COUNT(*)::INTEGER FROM users WHERE status = 'INACTIVE') AS inactive_users,
        (SELECT COUNT(*)::INTEGER FROM flood_zones WHERE is_active = TRUE) AS active_zones,
        (SELECT COUNT(*)::INTEGER FROM flood_zones WHERE is_active = FALSE) AS inactive_zones,
        (SELECT COUNT(*)::INTEGER FROM audit_logs
          WHERE created_at >= NOW() - INTERVAL '24 hours') AS audit_entries_today
    `
  );

  const byRoleResult = await getPool().query(
    `
      SELECT r.code, r.display_name, COUNT(u.id)::INTEGER AS total
      FROM roles r
      LEFT JOIN users u ON u.role_id = r.id
      GROUP BY r.id
      ORDER BY r.display_name ASC
    `
  );

  const row = result.rows[0];

  return {
    summary: {
      totalUsers: row.total_users,
      activeUsers: row.active_users,
      inactiveUsers: row.inactive_users,
      activeZones: row.active_zones,
      inactiveZones: row.inactive_zones,
      auditEntriesToday: row.audit_entries_today
    },
    usersByRole: byRoleResult.rows.map((r) => ({
      code: r.code,
      displayName: r.display_name,
      total: r.total
    }))
  };
}

module.exports = {
  listUsers,
  findUserById,
  createStaffUser,
  updateUserStatus,
  updateUserRole,
  countActiveAdministrators,
  listRoles,
  listZones,
  findZoneById,
  createZone,
  updateZone,
  countActiveCentresInZone,
  upsertFacilityType,
  listAuditLogs,
  listAuditActions,
  getAdminOverview
};
