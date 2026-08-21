const { pool } = require('../db/pool');

function getPool() {
  if (!pool) throw new Error('Database pool is not configured');
  return pool;
}

/*
 * Whether a record reaches a viewer standing in a given zone and ward.
 *
 * A direct match on either is obvious. The two bridged cases are the ones that
 * were missing: a record filed against a zone still reaches a resident whose
 * ward that zone covers, and a record filed against a ward still reaches a
 * resident whose zone covers it. Without the bridge a resident filtering by
 * ward cannot see a centre recorded with only a zone, even when the zone spans
 * their own ward.
 *
 * The officer side already reasons this way in jurisdiction.repository; this
 * brings the public side into line.
 */
function areaReachPredicate(alias, zoneParameter = 1, wardParameter = 2) {
  const zone = `$${zoneParameter}::UUID`;
  const ward = `$${wardParameter}::UUID`;

  return `
    (
      (${zone} IS NULL AND ${ward} IS NULL)
      OR ${alias}.zone_id = ${zone}
      OR ${alias}.ward_id = ${ward}
      OR (${ward} IS NOT NULL AND EXISTS (
        SELECT 1 FROM flood_zone_wards bridge
        WHERE bridge.zone_id = ${alias}.zone_id AND bridge.ward_id = ${ward}
      ))
      OR (${zone} IS NOT NULL AND EXISTS (
        SELECT 1 FROM flood_zone_wards bridge
        WHERE bridge.zone_id = ${zone} AND bridge.ward_id = ${alias}.ward_id
      ))
    )
  `;
}

/** The same reasoning for alerts, whose targets live in two join tables. */
function alertReachPredicate(alias, zoneParameter = 1, wardParameter = 2) {
  const zone = `$${zoneParameter}::UUID`;
  const ward = `$${wardParameter}::UUID`;

  return `
    (
      (${zone} IS NULL AND ${ward} IS NULL)
      OR EXISTS (
        SELECT 1 FROM alert_zones t WHERE t.alert_id = ${alias}.id AND t.zone_id = ${zone}
      )
      OR EXISTS (
        SELECT 1 FROM alert_wards t WHERE t.alert_id = ${alias}.id AND t.ward_id = ${ward}
      )
      OR EXISTS (
        SELECT 1 FROM alert_zones t
        INNER JOIN flood_zone_wards bridge ON bridge.zone_id = t.zone_id
        WHERE t.alert_id = ${alias}.id AND bridge.ward_id = ${ward}
      )
      OR EXISTS (
        SELECT 1 FROM alert_wards t
        INNER JOIN flood_zone_wards bridge ON bridge.ward_id = t.ward_id
        WHERE t.alert_id = ${alias}.id AND bridge.zone_id = ${zone}
      )
    )
  `;
}

/** A published alert is only live inside its own validity window. */
const ALERT_IS_LIVE = `
  a.status = 'PUBLISHED' AND a.valid_from <= NOW() AND a.expires_at > NOW()
`;

async function listActiveZones() {
  const result = await getPool().query(
    `SELECT id, code, name, locality, description, zone_type, is_demo_data
     FROM flood_zones WHERE is_active = TRUE ORDER BY name ASC`
  );
  return result.rows;
}

async function listActiveAlerts(zoneId, wardId) {
  const result = await getPool().query(
    `
      SELECT a.id, a.alert_ref, a.title, a.severity, a.warning_description,
             a.recommended_actions, a.valid_from, a.expires_at,
             COALESCE(JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', z.id, 'code', z.code, 'name', z.name))
               FILTER (WHERE z.id IS NOT NULL), '[]'::JSON) AS zones,
             COALESCE((
               SELECT JSON_AGG(JSONB_BUILD_OBJECT(
                 'id', w.id, 'number', w.ward_number, 'name', w.name,
                 'localLevel', ll.name, 'district', d.name, 'province', p.name
               ) ORDER BY p.name, d.name, ll.name, w.ward_number)
               FROM alert_wards aww
               INNER JOIN geo_wards w ON w.id = aww.ward_id
               INNER JOIN geo_local_levels ll ON ll.id = w.local_level_id
               INNER JOIN geo_districts d ON d.id = ll.district_id
               INNER JOIN geo_provinces p ON p.id = d.province_id
               WHERE aww.alert_id = a.id
             ), '[]'::JSON) AS wards
      FROM flood_alerts a
      LEFT JOIN alert_zones az ON az.alert_id = a.id
      LEFT JOIN flood_zones z ON z.id = az.zone_id
      WHERE ${ALERT_IS_LIVE}
        AND ${alertReachPredicate('a')}
      GROUP BY a.id
      ORDER BY a.severity DESC, a.valid_from DESC
    `,
    [zoneId || null, wardId || null]
  );

  /*
   * Counted without the area filter so a resident is never shown a bare "no
   * alerts" that they cannot tell apart from "all clear". The screen can say
   * how many are live elsewhere and offer to show them.
   */
  const total = await getPool().query(
    `SELECT COUNT(*)::INT AS total FROM flood_alerts a WHERE ${ALERT_IS_LIVE}`
  );

  const alerts = result.rows.map((row) => ({
    id: row.id,
    alertReference: row.alert_ref,
    title: row.title,
    severity: row.severity,
    warningDescription: row.warning_description,
    recommendedActions: row.recommended_actions,
    validFrom: row.valid_from,
    expiresAt: row.expires_at,
    zones: row.zones,
    wards: row.wards
  }));

  return { alerts, totalActive: total.rows[0].total };
}

async function listVerifiedIncidents(zoneId, wardId, limit) {
  const result = await getPool().query(
    `
      SELECT fr.report_ref, z.id AS zone_id, z.code AS zone_code, z.name AS zone_name,
             fr.ward_id, w.ward_number, w.name AS ward_name,
             ll.name AS local_level_name, d.name AS district_name, p.name AS province_name,
             fr.location_description, fr.observed_severity, fr.road_condition,
             fr.incident_description, fr.observed_at, fr.status
      FROM flood_reports fr
      LEFT JOIN flood_zones z ON z.id = fr.zone_id
      LEFT JOIN geo_wards w ON w.id = fr.ward_id
      LEFT JOIN geo_local_levels ll ON ll.id = w.local_level_id
      LEFT JOIN geo_districts d ON d.id = ll.district_id
      LEFT JOIN geo_provinces p ON p.id = d.province_id
      WHERE fr.status IN ('VERIFIED', 'CLOSED')
        AND ${areaReachPredicate('fr')}
      ORDER BY fr.observed_at DESC
      LIMIT $3
    `,
    [zoneId || null, wardId || null, limit]
  );

  return result.rows.map((row) => ({
    reportReference: row.report_ref,
    zone: row.zone_id ? { id: row.zone_id, code: row.zone_code, name: row.zone_name } : null,
    geography: row.ward_id ? {
      ward: { id: row.ward_id, number: row.ward_number, name: row.ward_name },
      localLevel: { name: row.local_level_name },
      district: { name: row.district_name },
      province: { name: row.province_name }
    } : null,
    locationDescription: row.location_description,
    observedSeverity: row.observed_severity,
    roadCondition: row.road_condition,
    incidentDescription: row.incident_description,
    observedAt: row.observed_at,
    status: row.status
  }));
}

async function listActiveCentres(zoneId, wardId) {
  const result = await getPool().query(
    `
      SELECT ec.id, ec.name, ec.location_description, ec.contact_phone,
             ec.maximum_capacity, ec.current_occupancy, ec.available_space,
             ec.operational_status, ec.ward_id, w.ward_number, w.name AS ward_name,
             ll.name AS local_level_name, d.name AS district_name, p.name AS province_name,
             z.id AS zone_id, z.code AS zone_code, z.name AS zone_name,
             COALESCE(JSON_AGG(DISTINCT JSONB_BUILD_OBJECT(
               'code', cft.code, 'name', cft.display_name, 'notes', cf.notes
             )) FILTER (WHERE cft.id IS NOT NULL), '[]'::JSON) AS facilities
      FROM evacuation_centres ec
      LEFT JOIN flood_zones z ON z.id = ec.zone_id
      LEFT JOIN geo_wards w ON w.id = ec.ward_id
      LEFT JOIN geo_local_levels ll ON ll.id = w.local_level_id
      LEFT JOIN geo_districts d ON d.id = ll.district_id
      LEFT JOIN geo_provinces p ON p.id = d.province_id
      LEFT JOIN centre_facilities cf ON cf.centre_id = ec.id
      LEFT JOIN centre_facility_types cft ON cft.id = cf.facility_type_id
      WHERE ec.is_active = TRUE
        AND ${areaReachPredicate('ec')}
      GROUP BY ec.id, z.id, w.id, ll.id, d.id, p.id
      -- Somewhere with room comes first. A resident looking for shelter should
      -- not have to read past centres that cannot take them.
      ORDER BY
        CASE ec.operational_status
          WHEN 'OPEN' THEN 1
          WHEN 'NEAR_CAPACITY' THEN 2
          WHEN 'FULL' THEN 3
          ELSE 4
        END,
        ec.available_space DESC NULLS LAST,
        COALESCE(p.name, ''), COALESCE(d.name, ''), ec.name ASC
    `,
    [zoneId || null, wardId || null]
  );

  const total = await getPool().query(
    'SELECT COUNT(*)::INT AS total FROM evacuation_centres WHERE is_active = TRUE'
  );

  const centres = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    locationDescription: row.location_description,
    contactPhone: row.contact_phone,
    maximumCapacity: row.maximum_capacity,
    currentOccupancy: row.current_occupancy,
    availableSpace: row.available_space,
    operationalStatus: row.operational_status,
    zone: row.zone_id ? { id: row.zone_id, code: row.zone_code, name: row.zone_name } : null,
    geography: row.ward_id ? {
      ward: { id: row.ward_id, number: row.ward_number, name: row.ward_name },
      localLevel: { name: row.local_level_name },
      district: { name: row.district_name },
      province: { name: row.province_name }
    } : null,
    facilities: row.facilities
  }));

  return { centres, totalActive: total.rows[0].total };
}

module.exports = { listActiveZones, listActiveAlerts, listVerifiedIncidents, listActiveCentres };
