const { pool } = require('../db/pool');
const { insertAuditLog } = require('../utils/audit');
const { entityPredicate, geographyPredicate } = require('./jurisdiction.repository');

function getPool() {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  return pool;
}

const centreSelect = `
  SELECT
    ec.id,
    ec.name,
    ec.location_description,
    ec.contact_phone,
    ec.maximum_capacity,
    ec.current_occupancy,
    ec.available_space,
    ec.operational_status,
    ec.is_active,
    ec.created_at,
    ec.updated_at,
    z.id AS zone_id,
    z.code AS zone_code,
    z.name AS zone_name,
    ec.ward_id,
    ec.locality,
    ec.nearest_landmark,
    ec.latitude,
    ec.longitude,
    w.ward_number,
    w.name AS ward_name,
    ll.id AS local_level_id,
    ll.code AS local_level_code,
    ll.name AS local_level_name,
    d.id AS district_id,
    d.code AS district_code,
    d.name AS district_name,
    gp.id AS province_id,
    gp.code AS province_code,
    gp.name AS province_name,
    COALESCE(
      JSON_AGG(
        DISTINCT JSONB_BUILD_OBJECT(
          'id', cft.id, 'code', cft.code, 'name', cft.display_name, 'notes', cf.notes
        )
      ) FILTER (WHERE cft.id IS NOT NULL),
      '[]'::JSON
    ) AS facilities
  FROM evacuation_centres ec
  LEFT JOIN flood_zones z ON z.id = ec.zone_id
  LEFT JOIN geo_wards w ON w.id = ec.ward_id
  LEFT JOIN geo_local_levels ll ON ll.id = w.local_level_id
  LEFT JOIN geo_districts d ON d.id = ll.district_id
  LEFT JOIN geo_provinces gp ON gp.id = d.province_id
  LEFT JOIN centre_facilities cf ON cf.centre_id = ec.id
  LEFT JOIN centre_facility_types cft ON cft.id = cf.facility_type_id
`;

function mapCentre(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    locationDescription: row.location_description,
    contactPhone: row.contact_phone,
    maximumCapacity: row.maximum_capacity,
    currentOccupancy: row.current_occupancy,
    availableSpace: row.available_space,
    operationalStatus: row.operational_status,
    isActive: row.is_active,
    zone: row.zone_id ? {
      id: row.zone_id,
      code: row.zone_code,
      name: row.zone_name
    } : null,
    geography: row.ward_id ? {
      province: { id: row.province_id, code: row.province_code, name: row.province_name },
      district: { id: row.district_id, code: row.district_code, name: row.district_name },
      localLevel: { id: row.local_level_id, code: row.local_level_code, name: row.local_level_name },
      ward: { id: row.ward_id, number: row.ward_number, name: row.ward_name }
    } : null,
    locality: row.locality,
    nearestLandmark: row.nearest_landmark,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    facilities: row.facilities,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findCentreById(centreId) {
  const result = await getPool().query(
    `${centreSelect} WHERE ec.id = $1 GROUP BY ec.id, z.id, w.id, ll.id, d.id, gp.id`,
    [centreId]
  );

  return mapCentre(result.rows[0]);
}

async function listCentres({ zoneId, status, includeArchived, provinceId, districtId, localLevelId, wardId }) {
  const result = await getPool().query(
    `
      ${centreSelect}
      WHERE ($1::UUID IS NULL OR ec.zone_id = $1)
        AND ($2::VARCHAR IS NULL OR ec.operational_status = $2)
        AND ($3::BOOLEAN IS TRUE OR ec.is_active = TRUE)
        AND ${geographyPredicate('ec', {
          provinceParameter: 4,
          districtParameter: 5,
          localLevelParameter: 6,
          wardParameter: 7
        })}
      GROUP BY ec.id, z.id, w.id, ll.id, d.id, gp.id
      ORDER BY COALESCE(gp.name, '') ASC, COALESCE(d.name, '') ASC, ec.name ASC
    `,
    [
      zoneId || null,
      status || null,
      Boolean(includeArchived),
      provinceId || null,
      districtId || null,
      localLevelId || null,
      wardId || null
    ]
  );

  return result.rows.map(mapCentre);
}

/**
 * Verified community observations an evacuation officer may use for situational
 * awareness. The projection deliberately excludes reporter identity, evidence
 * and review notes; those belong to the monitoring workflow.
 */
async function listVerifiedIncidentsInJurisdiction(officerId) {
  const result = await getPool().query(
    `
      SELECT fr.report_ref, fr.location_description, fr.incident_description,
             fr.observed_severity, fr.road_condition, fr.observed_at, fr.status,
             fr.ward_id, w.ward_number, w.name AS ward_name,
             ll.id AS local_level_id, ll.name AS local_level_name,
             d.id AS district_id, d.name AS district_name,
             gp.id AS province_id, gp.name AS province_name,
             z.id AS zone_id, z.code AS zone_code, z.name AS zone_name
      FROM flood_reports fr
      LEFT JOIN flood_zones z ON z.id = fr.zone_id
      LEFT JOIN geo_wards w ON w.id = fr.ward_id
      LEFT JOIN geo_local_levels ll ON ll.id = w.local_level_id
      LEFT JOIN geo_districts d ON d.id = ll.district_id
      LEFT JOIN geo_provinces gp ON gp.id = d.province_id
      WHERE fr.status IN ('VERIFIED', 'CLOSED')
        AND ${entityPredicate('fr', 1)}
      ORDER BY
        CASE fr.observed_severity
          WHEN 'SEVERE' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MODERATE' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END,
        fr.observed_at DESC
      LIMIT 100
    `,
    [officerId]
  );

  return result.rows.map((row) => ({
    reportReference: row.report_ref,
    locationDescription: row.location_description,
    incidentDescription: row.incident_description,
    observedSeverity: row.observed_severity,
    roadCondition: row.road_condition,
    observedAt: row.observed_at,
    status: row.status,
    zone: row.zone_id ? { id: row.zone_id, code: row.zone_code, name: row.zone_name } : null,
    geography: row.ward_id ? {
      ward: { id: row.ward_id, number: row.ward_number, name: row.ward_name },
      localLevel: { id: row.local_level_id, name: row.local_level_name },
      district: { id: row.district_id, name: row.district_name },
      province: { id: row.province_id, name: row.province_name }
    } : null
  }));
}

async function replaceFacilities(client, centreId, facilities) {
  await client.query('DELETE FROM centre_facilities WHERE centre_id = $1', [centreId]);

  for (const facility of facilities) {
    await client.query(
      `
        INSERT INTO centre_facilities (centre_id, facility_type_id, notes)
        VALUES ($1, $2, $3)
      `,
      [centreId, facility.facilityTypeId, facility.notes || null]
    );
  }
}

async function createCentre({
  actorId,
  zoneId,
  wardId,
  locality,
  nearestLandmark,
  latitude,
  longitude,
  name,
  locationDescription,
  contactPhone,
  maximumCapacity,
  currentOccupancy,
  operationalStatus,
  facilities
}) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        INSERT INTO evacuation_centres (
          zone_id, ward_id, locality, nearest_landmark, latitude, longitude,
          name, location_description, contact_phone,
          maximum_capacity, current_occupancy, operational_status, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `,
      [
        zoneId,
        wardId,
        locality,
        nearestLandmark,
        latitude,
        longitude,
        name,
        locationDescription,
        contactPhone,
        maximumCapacity,
        currentOccupancy,
        operationalStatus,
        actorId
      ]
    );

    const centreId = result.rows[0].id;
    await replaceFacilities(client, centreId, facilities);

    await insertAuditLog(client, {
      actorId,
      action: 'CENTRE_CREATED',
      entityType: 'EVACUATION_CENTRE',
      entityId: centreId,
      metadata: { name, maximumCapacity }
    });

    await client.query('COMMIT');
    return findCentreById(centreId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateCentre({
  centreId,
  actorId,
  zoneId,
  wardId,
  locality,
  nearestLandmark,
  latitude,
  longitude,
  name,
  locationDescription,
  contactPhone,
  maximumCapacity,
  operationalStatus,
  facilities
}) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE evacuation_centres
        SET zone_id = $2,
            ward_id = $3,
            locality = $4,
            nearest_landmark = $5,
            latitude = $6,
            longitude = $7,
            name = $8,
            location_description = $9,
            contact_phone = $10,
            maximum_capacity = $11,
            operational_status = $12,
            updated_by = $13,
            updated_at = NOW()
        WHERE id = $1 AND is_active = TRUE
        RETURNING id
      `,
      [
        centreId,
        zoneId,
        wardId,
        locality,
        nearestLandmark,
        latitude,
        longitude,
        name,
        locationDescription,
        contactPhone,
        maximumCapacity,
        operationalStatus,
        actorId
      ]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await replaceFacilities(client, centreId, facilities);

    await insertAuditLog(client, {
      actorId,
      action: 'CENTRE_UPDATED',
      entityType: 'EVACUATION_CENTRE',
      entityId: centreId,
      metadata: { name, maximumCapacity }
    });

    await client.query('COMMIT');
    return findCentreById(centreId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Occupancy and the derived operational status are written together under a row
 * lock so a concurrent update cannot leave the status inconsistent with the
 * recorded occupancy. available_space is a generated column and never written.
 */
async function updateOccupancy({ centreId, actorId, currentOccupancy, operationalStatus }) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const currentResult = await client.query(
      'SELECT current_occupancy, maximum_capacity FROM evacuation_centres WHERE id = $1 AND is_active = TRUE FOR UPDATE',
      [centreId]
    );

    if (currentResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return { outcome: 'NOT_FOUND' };
    }

    const { maximum_capacity: maximumCapacity, current_occupancy: previousOccupancy } = currentResult.rows[0];

    if (currentOccupancy > maximumCapacity) {
      await client.query('ROLLBACK');
      return { outcome: 'OVER_CAPACITY', maximumCapacity };
    }

    await client.query(
      `
        UPDATE evacuation_centres
        SET current_occupancy = $2,
            operational_status = $3,
            updated_by = $4,
            updated_at = NOW()
        WHERE id = $1
      `,
      [centreId, currentOccupancy, operationalStatus, actorId]
    );

    await insertAuditLog(client, {
      actorId,
      action: 'CENTRE_OCCUPANCY_UPDATED',
      entityType: 'EVACUATION_CENTRE',
      entityId: centreId,
      metadata: { previousOccupancy, currentOccupancy, operationalStatus }
    });

    await client.query('COMMIT');
    return { outcome: 'APPLIED' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateStatus({ centreId, actorId, operationalStatus }) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE evacuation_centres
        SET operational_status = $2, updated_by = $3, updated_at = NOW()
        WHERE id = $1 AND is_active = TRUE
        RETURNING id
      `,
      [centreId, operationalStatus, actorId]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await insertAuditLog(client, {
      actorId,
      action: 'CENTRE_STATUS_UPDATED',
      entityType: 'EVACUATION_CENTRE',
      entityId: centreId,
      metadata: { operationalStatus }
    });

    await client.query('COMMIT');
    return findCentreById(centreId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Centres are archived rather than deleted so historical reports, audit entries
 * and occupancy history remain meaningful.
 */
async function archiveCentre({ centreId, actorId }) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
        UPDATE evacuation_centres
        SET is_active = FALSE,
            operational_status = 'CLOSED',
            updated_by = $2,
            updated_at = NOW()
        WHERE id = $1 AND is_active = TRUE
        RETURNING id
      `,
      [centreId, actorId]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await insertAuditLog(client, {
      actorId,
      action: 'CENTRE_ARCHIVED',
      entityType: 'EVACUATION_CENTRE',
      entityId: centreId,
      metadata: {}
    });

    await client.query('COMMIT');
    return findCentreById(centreId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listFacilityTypes({ includeInactive = false } = {}) {
  const result = await getPool().query(
    `
      SELECT id, code, display_name, is_active
      FROM centre_facility_types
      WHERE ($1::BOOLEAN IS TRUE OR is_active = TRUE)
      ORDER BY display_name ASC
    `,
    [includeInactive]
  );

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.display_name,
    isActive: row.is_active
  }));
}

async function findFacilityTypeIds(ids) {
  if (ids.length === 0) return [];

  const result = await getPool().query(
    'SELECT id FROM centre_facility_types WHERE id = ANY($1::UUID[]) AND is_active = TRUE',
    [ids]
  );

  return result.rows.map((row) => row.id);
}

module.exports = {
  listVerifiedIncidentsInJurisdiction,
  findCentreById,
  listCentres,
  createCentre,
  updateCentre,
  updateOccupancy,
  updateStatus,
  archiveCentre,
  listFacilityTypes,
  findFacilityTypeIds
};
