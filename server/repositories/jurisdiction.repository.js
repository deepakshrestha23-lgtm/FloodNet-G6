const { pool } = require('../db/pool');

function getPool() {
  if (!pool) throw new Error('Database pool is not configured');
  return pool;
}

async function findForUser(userId) {
  const result = await getPool().query(
    `
      SELECT uj.user_id, uj.scope_level,
             p.id AS province_id, p.code AS province_code, p.name AS province_name,
             d.id AS district_id, d.code AS district_code, d.name AS district_name,
             ll.id AS local_level_id, ll.code AS local_level_code, ll.name AS local_level_name,
             w.id AS ward_id, w.ward_number, w.name AS ward_name
      FROM user_jurisdictions uj
      LEFT JOIN geo_wards w ON w.id = uj.ward_id
      LEFT JOIN geo_local_levels ll ON ll.id = COALESCE(uj.local_level_id, w.local_level_id)
      LEFT JOIN geo_districts d ON d.id = COALESCE(uj.district_id, ll.district_id)
      LEFT JOIN geo_provinces p ON p.id = COALESCE(uj.province_id, d.province_id)
      WHERE uj.user_id = $1
    `,
    [userId]
  );
  return result.rows[0] || null;
}

/*
 * SQL predicate for a report/centre row alias. The first parameter is the
 * one-based PostgreSQL placeholder used for userId. A legacy zone without a
 * ward is authorized through the zone-to-ward association table.
 */
function entityPredicate(alias, userParameter) {
  const targetWard = `${alias}.ward_id`;
  const targetZone = `${alias}.zone_id`;
  const wardScope = (wardExpression) => `
    EXISTS (
      SELECT 1
      FROM geo_wards jw
      INNER JOIN geo_local_levels jll ON jll.id = jw.local_level_id
      INNER JOIN geo_districts jd ON jd.id = jll.district_id
      INNER JOIN geo_provinces jp ON jp.id = jd.province_id
      WHERE jw.id = ${wardExpression}
        AND (
          (uj.scope_level = 'PROVINCE' AND jp.id = uj.province_id)
          OR (uj.scope_level = 'DISTRICT' AND jd.id = uj.district_id)
          OR (uj.scope_level = 'LOCAL_LEVEL' AND jll.id = uj.local_level_id)
          OR (uj.scope_level = 'WARD' AND jw.id = uj.ward_id)
        )
    )
  `;

  return `
    EXISTS (
      SELECT 1
      FROM user_jurisdictions uj
      WHERE uj.user_id = $${userParameter}::UUID
        AND (
          uj.scope_level = 'NATIONAL'
          OR ${wardScope(targetWard)}
          OR (
            ${targetWard} IS NULL AND ${targetZone} IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM flood_zone_wards fzw
              WHERE fzw.zone_id = ${targetZone}
                AND ${wardScope('fzw.ward_id')}
            )
          )
        )
    )
  `;
}

function alertPredicate(alertAlias, userParameter) {
  return `
    EXISTS (
      SELECT 1
      FROM user_jurisdictions uj
      WHERE uj.user_id = $${userParameter}::UUID
        AND (
          uj.scope_level = 'NATIONAL'
          OR EXISTS (
            SELECT 1
            FROM alert_wards aww
            ${wardJoin('aww.ward_id')}
            WHERE aww.alert_id = ${alertAlias}.id
              AND ${jurisdictionMatch()}
          )
          OR EXISTS (
            SELECT 1
            FROM alert_zones azz
            INNER JOIN flood_zone_wards fzw ON fzw.zone_id = azz.zone_id
            ${wardJoin('fzw.ward_id')}
            WHERE azz.alert_id = ${alertAlias}.id
              AND ${jurisdictionMatch()}
          )
        )
    )
  `;

  function wardJoin(wardExpression) {
    return `
      INNER JOIN geo_wards jw ON jw.id = ${wardExpression}
      INNER JOIN geo_local_levels jll ON jll.id = jw.local_level_id
      INNER JOIN geo_districts jd ON jd.id = jll.district_id
      INNER JOIN geo_provinces jp ON jp.id = jd.province_id
    `;
  }

  function jurisdictionMatch() {
    return `
      (uj.scope_level = 'PROVINCE' AND jp.id = uj.province_id)
      OR (uj.scope_level = 'DISTRICT' AND jd.id = uj.district_id)
      OR (uj.scope_level = 'LOCAL_LEVEL' AND jll.id = uj.local_level_id)
      OR (uj.scope_level = 'WARD' AND jw.id = uj.ward_id)
    `;
  }
}

/**
 * Optional administrative filter used by operational dashboards and queues.
 * A ward is the canonical filterable unit. Legacy records that only contain a
 * flood zone are resolved through the zone-to-ward association table so they
 * remain visible under the correct Nepal geography.
 */
function geographyPredicate(alias, {
  provinceParameter = 2,
  districtParameter = 3,
  localLevelParameter = 4,
  wardParameter = 5
} = {}) {
  return `
    (
      ($${provinceParameter}::UUID IS NULL
        AND $${districtParameter}::UUID IS NULL
        AND $${localLevelParameter}::UUID IS NULL
        AND $${wardParameter}::UUID IS NULL)
      OR EXISTS (
        SELECT 1
        FROM geo_wards fg_w
        INNER JOIN geo_local_levels fg_ll ON fg_ll.id = fg_w.local_level_id
        INNER JOIN geo_districts fg_d ON fg_d.id = fg_ll.district_id
        INNER JOIN geo_provinces fg_p ON fg_p.id = fg_d.province_id
        WHERE (
          fg_w.id = ${alias}.ward_id
          OR (
            ${alias}.ward_id IS NULL
            AND EXISTS (
              SELECT 1
              FROM flood_zone_wards fg_zw
              WHERE fg_zw.zone_id = ${alias}.zone_id
                AND fg_zw.ward_id = fg_w.id
            )
          )
        )
        AND ($${provinceParameter}::UUID IS NULL OR fg_p.id = $${provinceParameter}::UUID)
        AND ($${districtParameter}::UUID IS NULL OR fg_d.id = $${districtParameter}::UUID)
        AND ($${localLevelParameter}::UUID IS NULL OR fg_ll.id = $${localLevelParameter}::UUID)
        AND ($${wardParameter}::UUID IS NULL OR fg_w.id = $${wardParameter}::UUID)
      )
    )
  `;
}

function alertGeographyPredicate(alias, {
  provinceParameter = 2,
  districtParameter = 3,
  localLevelParameter = 4,
  wardParameter = 5
} = {}) {
  return `
    (
      ($${provinceParameter}::UUID IS NULL
        AND $${districtParameter}::UUID IS NULL
        AND $${localLevelParameter}::UUID IS NULL
        AND $${wardParameter}::UUID IS NULL)
      OR EXISTS (
        SELECT 1
        FROM (
          SELECT aw.alert_id, aw.ward_id
          FROM alert_wards aw
          UNION ALL
          SELECT az.alert_id, fzw.ward_id
          FROM alert_zones az
          INNER JOIN flood_zone_wards fzw ON fzw.zone_id = az.zone_id
        ) AS filtered_alert_targets
        INNER JOIN geo_wards fg_w ON fg_w.id = filtered_alert_targets.ward_id
        INNER JOIN geo_local_levels fg_ll ON fg_ll.id = fg_w.local_level_id
        INNER JOIN geo_districts fg_d ON fg_d.id = fg_ll.district_id
        INNER JOIN geo_provinces fg_p ON fg_p.id = fg_d.province_id
        WHERE filtered_alert_targets.alert_id = ${alias}.id
          AND ($${provinceParameter}::UUID IS NULL OR fg_p.id = $${provinceParameter}::UUID)
          AND ($${districtParameter}::UUID IS NULL OR fg_d.id = $${districtParameter}::UUID)
          AND ($${localLevelParameter}::UUID IS NULL OR fg_ll.id = $${localLevelParameter}::UUID)
          AND ($${wardParameter}::UUID IS NULL OR fg_w.id = $${wardParameter}::UUID)
      )
    )
  `;
}

async function upsertForUser({ userId, scopeLevel, provinceId, districtId, localLevelId, wardId, assignedBy }) {
  const result = await getPool().query(
    `
      INSERT INTO user_jurisdictions (
        user_id, scope_level, province_id, district_id, local_level_id, ward_id, assigned_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO UPDATE
      SET scope_level = EXCLUDED.scope_level,
          province_id = EXCLUDED.province_id,
          district_id = EXCLUDED.district_id,
          local_level_id = EXCLUDED.local_level_id,
          ward_id = EXCLUDED.ward_id,
          assigned_by = EXCLUDED.assigned_by,
          updated_at = NOW()
      RETURNING user_id
    `,
    [userId, scopeLevel, provinceId || null, districtId || null, localLevelId || null, wardId || null, assignedBy || null]
  );
  return result.rowCount > 0;
}

async function removeForUser(userId) {
  await getPool().query('DELETE FROM user_jurisdictions WHERE user_id = $1', [userId]);
}

async function canAccessWard(userId, wardId) {
  const result = await getPool().query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM user_jurisdictions uj
        INNER JOIN geo_wards w ON w.id = $2
        INNER JOIN geo_local_levels ll ON ll.id = w.local_level_id
        INNER JOIN geo_districts d ON d.id = ll.district_id
        WHERE uj.user_id = $1
          AND (
            uj.scope_level = 'NATIONAL'
            OR (uj.scope_level = 'PROVINCE' AND uj.province_id = d.province_id)
            OR (uj.scope_level = 'DISTRICT' AND uj.district_id = d.id)
            OR (uj.scope_level = 'LOCAL_LEVEL' AND uj.local_level_id = ll.id)
            OR (uj.scope_level = 'WARD' AND uj.ward_id = w.id)
          )
      ) AS allowed
    `,
    [userId, wardId]
  );
  return result.rows[0].allowed;
}

/**
 * Wards in the set that fall outside the officer's jurisdiction.
 *
 * Answered in one query rather than one per ward: a district-wide alert can
 * carry seventy wards and a province-wide one over a thousand, and checking
 * them individually would not survive that.
 */
async function findWardsOutsideJurisdiction(userId, wardIds) {
  if (!wardIds.length) return [];

  const result = await getPool().query(
    `
      SELECT w.id
      FROM geo_wards w
      INNER JOIN geo_local_levels ll ON ll.id = w.local_level_id
      INNER JOIN geo_districts d ON d.id = ll.district_id
      WHERE w.id = ANY($2::UUID[])
        AND NOT EXISTS (
          SELECT 1
          FROM user_jurisdictions uj
          WHERE uj.user_id = $1
            AND (
              uj.scope_level = 'NATIONAL'
              OR (uj.scope_level = 'PROVINCE' AND uj.province_id = d.province_id)
              OR (uj.scope_level = 'DISTRICT' AND uj.district_id = d.id)
              OR (uj.scope_level = 'LOCAL_LEVEL' AND uj.local_level_id = ll.id)
              OR (uj.scope_level = 'WARD' AND uj.ward_id = w.id)
            )
        )
      LIMIT 5
    `,
    [userId, wardIds]
  );

  return result.rows.map((row) => row.id);
}

async function canAccessZone(userId, zoneId) {
  const result = await getPool().query(
    `
      SELECT EXISTS (
        SELECT 1 FROM user_jurisdictions uj
        WHERE uj.user_id = $1 AND uj.scope_level = 'NATIONAL'
      )
      OR EXISTS (
        SELECT 1
        FROM flood_zone_wards fzw
        INNER JOIN geo_wards w ON w.id = fzw.ward_id
        INNER JOIN geo_local_levels ll ON ll.id = w.local_level_id
        INNER JOIN geo_districts d ON d.id = ll.district_id
        INNER JOIN user_jurisdictions uj ON uj.user_id = $1
        WHERE fzw.zone_id = $2
          AND (
            (uj.scope_level = 'PROVINCE' AND uj.province_id = d.province_id)
            OR (uj.scope_level = 'DISTRICT' AND uj.district_id = d.id)
            OR (uj.scope_level = 'LOCAL_LEVEL' AND uj.local_level_id = ll.id)
            OR (uj.scope_level = 'WARD' AND uj.ward_id = w.id)
          )
      ) AS allowed
    `,
    [userId, zoneId]
  );
  return result.rows[0].allowed;
}

async function isValidScopeTarget(scopeLevel, targetId) {
  if (scopeLevel === 'NATIONAL') return true;
  const queries = {
    PROVINCE: 'SELECT 1 FROM geo_provinces WHERE id = $1 AND is_active = TRUE',
    DISTRICT: 'SELECT 1 FROM geo_districts WHERE id = $1 AND is_active = TRUE',
    LOCAL_LEVEL: 'SELECT 1 FROM geo_local_levels WHERE id = $1 AND is_active = TRUE',
    WARD: 'SELECT 1 FROM geo_wards WHERE id = $1 AND is_active = TRUE'
  };
  const query = queries[scopeLevel];
  if (!query) return false;
  const result = await getPool().query(query, [targetId]);
  return result.rowCount > 0;
}

module.exports = {
  findForUser,
  entityPredicate,
  alertPredicate,
  geographyPredicate,
  alertGeographyPredicate,
  upsertForUser,
  removeForUser,
  canAccessWard,
  findWardsOutsideJurisdiction,
  canAccessZone,
  isValidScopeTarget
};
