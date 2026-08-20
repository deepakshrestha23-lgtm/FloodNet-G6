const { pool } = require('../db/pool');

function getPool() {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  return pool;
}

async function listActiveZones() {
  const result = await getPool().query(
    `
      SELECT id, code, name, locality, description
      FROM flood_zones
      WHERE is_active = TRUE
      ORDER BY name ASC
    `
  );

  return result.rows;
}

async function listActiveAlerts(zoneId) {
  const result = await getPool().query(
    `
      SELECT
        a.id,
        a.alert_ref,
        a.title,
        a.severity,
        a.warning_description,
        a.recommended_actions,
        a.valid_from,
        a.expires_at,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT('id', z.id, 'code', z.code, 'name', z.name)
          ) FILTER (WHERE z.id IS NOT NULL),
          '[]'::JSON
        ) AS zones
      FROM flood_alerts a
      LEFT JOIN alert_zones az ON az.alert_id = a.id
      LEFT JOIN flood_zones z ON z.id = az.zone_id
      WHERE a.status = 'PUBLISHED'
        AND a.valid_from <= NOW()
        AND a.expires_at > NOW()
        AND ($1::UUID IS NULL OR EXISTS (
          SELECT 1 FROM alert_zones filtered_az
          WHERE filtered_az.alert_id = a.id AND filtered_az.zone_id = $1
        ))
      GROUP BY a.id
      ORDER BY a.severity DESC, a.valid_from DESC
    `,
    [zoneId || null]
  );

  return result.rows.map((row) => ({
    id: row.id,
    alertReference: row.alert_ref,
    title: row.title,
    severity: row.severity,
    warningDescription: row.warning_description,
    recommendedActions: row.recommended_actions,
    validFrom: row.valid_from,
    expiresAt: row.expires_at,
    zones: row.zones
  }));
}

async function listVerifiedIncidents(zoneId, limit) {
  const result = await getPool().query(
    `
      SELECT
        fr.report_ref,
        z.id AS zone_id,
        z.code AS zone_code,
        z.name AS zone_name,
        fr.location_description,
        fr.observed_severity,
        fr.road_condition,
        fr.incident_description,
        fr.observed_at,
        fr.status
      FROM flood_reports fr
      INNER JOIN flood_zones z ON z.id = fr.zone_id
      WHERE fr.status IN ('VERIFIED', 'CLOSED')
        AND ($1::UUID IS NULL OR fr.zone_id = $1)
      ORDER BY fr.observed_at DESC
      LIMIT $2
    `,
    [zoneId || null, limit]
  );

  return result.rows.map((row) => ({
    reportReference: row.report_ref,
    zone: {
      id: row.zone_id,
      code: row.zone_code,
      name: row.zone_name
    },
    locationDescription: row.location_description,
    observedSeverity: row.observed_severity,
    roadCondition: row.road_condition,
    incidentDescription: row.incident_description,
    observedAt: row.observed_at,
    status: row.status
  }));
}

async function listActiveCentres(zoneId) {
  const result = await getPool().query(
    `
      SELECT
        ec.id,
        ec.name,
        ec.location_description,
        ec.contact_phone,
        ec.maximum_capacity,
        ec.current_occupancy,
        ec.available_space,
        ec.operational_status,
        z.id AS zone_id,
        z.code AS zone_code,
        z.name AS zone_name,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT('code', cft.code, 'name', cft.display_name, 'notes', cf.notes)
          ) FILTER (WHERE cft.id IS NOT NULL),
          '[]'::JSON
        ) AS facilities
      FROM evacuation_centres ec
      INNER JOIN flood_zones z ON z.id = ec.zone_id
      LEFT JOIN centre_facilities cf ON cf.centre_id = ec.id
      LEFT JOIN centre_facility_types cft ON cft.id = cf.facility_type_id
      WHERE ec.is_active = TRUE
        AND ($1::UUID IS NULL OR ec.zone_id = $1)
      GROUP BY ec.id, z.id
      ORDER BY z.name ASC, ec.name ASC
    `,
    [zoneId || null]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    locationDescription: row.location_description,
    contactPhone: row.contact_phone,
    maximumCapacity: row.maximum_capacity,
    currentOccupancy: row.current_occupancy,
    availableSpace: row.available_space,
    operationalStatus: row.operational_status,
    zone: {
      id: row.zone_id,
      code: row.zone_code,
      name: row.zone_name
    },
    facilities: row.facilities
  }));
}

module.exports = {
  listActiveZones,
  listActiveAlerts,
  listVerifiedIncidents,
  listActiveCentres
};
