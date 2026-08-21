const { pool } = require('../db/pool');
const { insertAuditLog } = require('../utils/audit');
const { alertPredicate, alertGeographyPredicate } = require('./jurisdiction.repository');

function getPool() {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  return pool;
}

/**
 * is_active is derived from status and the validity window on every read so an
 * expired alert can never linger as active because of a stale flag.
 */
const alertSelect = `
  SELECT
    a.id,
    a.alert_ref,
    a.title,
    a.severity,
    a.warning_description,
    a.recommended_actions,
    a.valid_from,
    a.expires_at,
    a.status,
    a.published_at,
    a.cancelled_at,
    a.created_at,
    a.updated_at,
    (a.status = 'PUBLISHED' AND a.valid_from <= NOW() AND a.expires_at > NOW()) AS is_active,
    COALESCE(
      JSON_AGG(
        DISTINCT JSONB_BUILD_OBJECT('id', z.id, 'code', z.code, 'name', z.name)
      ) FILTER (WHERE z.id IS NOT NULL),
      '[]'::JSON
    ) AS zones,
    COALESCE((
      SELECT JSON_AGG(
        JSONB_BUILD_OBJECT('id', w.id, 'number', w.ward_number, 'name', w.name,
          'localLevel', ll.name, 'district', d.name, 'province', p.name)
        ORDER BY p.name, d.name, ll.name, w.ward_number
      )
      FROM alert_wards aw
      INNER JOIN geo_wards w ON w.id = aw.ward_id
      INNER JOIN geo_local_levels ll ON ll.id = w.local_level_id
      INNER JOIN geo_districts d ON d.id = ll.district_id
      INNER JOIN geo_provinces p ON p.id = d.province_id
      WHERE aw.alert_id = a.id
    ), '[]'::JSON) AS wards
  FROM flood_alerts a
  LEFT JOIN alert_zones az ON az.alert_id = a.id
  LEFT JOIN flood_zones z ON z.id = az.zone_id
`;

function mapAlert(row) {
  if (!row) return null;

  return {
    id: row.id,
    alertReference: row.alert_ref,
    title: row.title,
    severity: row.severity,
    warningDescription: row.warning_description,
    recommendedActions: row.recommended_actions,
    validFrom: row.valid_from,
    expiresAt: row.expires_at,
    status: row.status,
    isActive: row.is_active,
    publishedAt: row.published_at,
    cancelledAt: row.cancelled_at,
    zones: row.zones,
    wards: row.wards,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findAlertById(alertId, officerId) {
  const parameters = [alertId];
  const authorization = officerId ? ` AND ${alertPredicate('a', 2)}` : '';
  if (officerId) parameters.push(officerId);
  const result = await getPool().query(
    `${alertSelect} WHERE a.id = $1${authorization} GROUP BY a.id`,
    parameters
  );

  return mapAlert(result.rows[0]);
}

async function listAlerts({
  officerId,
  status,
  zoneId,
  provinceId,
  districtId,
  localLevelId,
  wardId,
  limit,
  offset
}) {
  const parameters = [
    officerId,
    status || null,
    zoneId || null,
    provinceId || null,
    districtId || null,
    localLevelId || null,
    wardId || null,
    limit,
    offset
  ];

  const filterClause = `
    WHERE ${alertPredicate('a', 1)}
      AND ($2::VARCHAR IS NULL OR a.status = $2)
      AND ($3::UUID IS NULL OR EXISTS (
        SELECT 1 FROM alert_zones f WHERE f.alert_id = a.id AND f.zone_id = $3
      ))
      AND ${alertGeographyPredicate('a', {
        provinceParameter: 4,
        districtParameter: 5,
        localLevelParameter: 6,
        wardParameter: 7
      })}
  `;

  const result = await getPool().query(
    `
      ${alertSelect}
      ${filterClause}
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT $8 OFFSET $9
    `,
    parameters
  );

  const countResult = await getPool().query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM flood_alerts a
      ${filterClause}
    `,
    parameters.slice(0, 7)
  );

  return {
    alerts: result.rows.map(mapAlert),
    total: countResult.rows[0].total
  };
}

/**
 * Live alerts inside an officer's own jurisdiction, read only.
 *
 * Evacuation officers decide when to open a shelter, so they need to see the
 * warning that makes that necessary. They cannot create, edit or publish one:
 * that separation stays with the monitoring officer.
 *
 * The validity window is applied here as well as the status, because expiry is
 * an explicit officer action and a published alert can sit past its own
 * expires_at until someone performs it.
 */
async function listActiveAlertsInJurisdiction(officerId, limit = 50) {
  const result = await getPool().query(
    `
      ${alertSelect}
      WHERE a.status = 'PUBLISHED'
        AND a.valid_from <= NOW()
        AND a.expires_at > NOW()
        AND ${alertPredicate('a', 2)}
      GROUP BY a.id
      ORDER BY
        CASE a.severity
          WHEN 'EMERGENCY' THEN 1
          WHEN 'WARNING' THEN 2
          WHEN 'WATCH' THEN 3
          ELSE 4
        END,
        a.valid_from DESC
      LIMIT $1
    `,
    [limit, officerId]
  );

  return result.rows.map(mapAlert);
}

async function replaceAlertTargets(client, alertId, zoneIds, wardIds) {
  await client.query('DELETE FROM alert_zones WHERE alert_id = $1', [alertId]);
  await client.query('DELETE FROM alert_wards WHERE alert_id = $1', [alertId]);

  for (const zoneId of zoneIds) {
    await client.query(
      'INSERT INTO alert_zones (alert_id, zone_id) VALUES ($1, $2)',
      [alertId, zoneId]
    );
  }

  for (const wardId of wardIds) {
    await client.query(
      'INSERT INTO alert_wards (alert_id, ward_id) VALUES ($1, $2)',
      [alertId, wardId]
    );
  }
}

async function createAlert({
  alertReference,
  createdBy,
  title,
  severity,
  warningDescription,
  recommendedActions,
  validFrom,
  expiresAt,
  zoneIds = [],
  wardIds = []
}) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const alertResult = await client.query(
      `
        INSERT INTO flood_alerts (
          alert_ref, created_by, title, severity,
          warning_description, recommended_actions, valid_from, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        alertReference,
        createdBy,
        title,
        severity,
        warningDescription,
        recommendedActions,
        validFrom,
        expiresAt
      ]
    );

    const alertId = alertResult.rows[0].id;
    await replaceAlertTargets(client, alertId, zoneIds, wardIds);

    await insertAuditLog(client, {
      actorId: createdBy,
      action: 'ALERT_CREATED',
      entityType: 'FLOOD_ALERT',
      entityId: alertId,
      metadata: { severity, zoneCount: zoneIds.length, wardCount: wardIds.length }
    });

    await client.query('COMMIT');
    return findAlertById(alertId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Draft and published alerts stay editable so wording can be corrected during an
 * incident. Cancelled and expired alerts are immutable history.
 */
async function updateAlert({
  alertId,
  actorId,
  title,
  severity,
  warningDescription,
  recommendedActions,
  validFrom,
  expiresAt,
  zoneIds = [],
  wardIds = []
}) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `
        UPDATE flood_alerts
        SET title = $2,
            severity = $3,
            warning_description = $4,
            recommended_actions = $5,
            valid_from = $6,
            expires_at = $7,
            updated_at = NOW()
        WHERE id = $1
          AND status IN ('DRAFT', 'PUBLISHED')
        RETURNING id
      `,
      [alertId, title, severity, warningDescription, recommendedActions, validFrom, expiresAt]
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await replaceAlertTargets(client, alertId, zoneIds, wardIds);

    await insertAuditLog(client, {
      actorId,
      action: 'ALERT_UPDATED',
      entityType: 'FLOOD_ALERT',
      entityId: alertId,
      metadata: { severity, zoneCount: zoneIds.length, wardCount: wardIds.length }
    });

    await client.query('COMMIT');
    return findAlertById(alertId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Moves an alert into a published or terminal state. Allowed source states are
 * checked under a row lock so two officers cannot both publish the same draft.
 */
async function transitionAlert({ alertId, actorId, newStatus, allowedFromStatuses, auditAction, officerId }) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const currentResult = await client.query(
      `SELECT status FROM flood_alerts a
       WHERE a.id = $1 AND ${alertPredicate('a', 2)}
       FOR UPDATE`,
      [alertId, officerId]
    );

    if (currentResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return { outcome: 'NOT_FOUND' };
    }

    const oldStatus = currentResult.rows[0].status;

    if (!allowedFromStatuses.includes(oldStatus)) {
      await client.query('ROLLBACK');
      return { outcome: 'INVALID_TRANSITION', oldStatus };
    }

    if (newStatus === 'PUBLISHED') {
      const targetCheck = await client.query(
        `SELECT (
          (SELECT COUNT(*) FROM alert_zones WHERE alert_id = $1) +
          (SELECT COUNT(*) FROM alert_wards WHERE alert_id = $1)
        )::INTEGER AS total`,
        [alertId]
      );

      if (targetCheck.rows[0].total === 0) {
        await client.query('ROLLBACK');
        return { outcome: 'NO_ZONES' };
      }
    }

    await client.query(
      `
        UPDATE flood_alerts
        SET status = $2::VARCHAR,
            published_by = CASE WHEN $2::VARCHAR = 'PUBLISHED' THEN $3::UUID ELSE published_by END,
            published_at = CASE WHEN $2::VARCHAR = 'PUBLISHED' THEN NOW() ELSE published_at END,
            cancelled_at = CASE WHEN $2::VARCHAR = 'CANCELLED' THEN NOW() ELSE cancelled_at END,
            updated_at = NOW()
        WHERE id = $1
      `,
      [alertId, newStatus, actorId]
    );

    await insertAuditLog(client, {
      actorId,
      action: auditAction,
      entityType: 'FLOOD_ALERT',
      entityId: alertId,
      metadata: { oldStatus, newStatus }
    });

    await client.query('COMMIT');
    return { outcome: 'APPLIED', oldStatus };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listActiveAlertsInJurisdiction,
  findAlertById,
  listAlerts,
  createAlert,
  updateAlert,
  transitionAlert
};
