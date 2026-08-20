const { pool } = require('../db/pool');

function getPool() {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  return pool;
}

const reportSelect = `
  SELECT
    fr.id,
    fr.report_ref,
    fr.resident_id,
    fr.zone_id,
    fr.location_description,
    fr.observed_severity,
    fr.road_condition,
    fr.incident_description,
    fr.observed_at,
    fr.status,
    fr.created_at,
    fr.updated_at,
    z.code AS zone_code,
    z.name AS zone_name,
    z.locality AS zone_locality
  FROM flood_reports fr
  INNER JOIN flood_zones z ON z.id = fr.zone_id
`;

function mapReport(row) {
  if (!row) return null;

  return {
    id: row.id,
    reportReference: row.report_ref,
    residentId: row.resident_id,
    zone: {
      id: row.zone_id,
      code: row.zone_code,
      name: row.zone_name,
      locality: row.zone_locality
    },
    locationDescription: row.location_description,
    observedSeverity: row.observed_severity,
    roadCondition: row.road_condition,
    incidentDescription: row.incident_description,
    observedAt: row.observed_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function createReport({
  reportReference,
  residentId,
  zoneId,
  locationDescription,
  observedSeverity,
  roadCondition,
  incidentDescription,
  observedAt
}) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const reportResult = await client.query(
      `
        INSERT INTO flood_reports (
          report_ref,
          resident_id,
          zone_id,
          location_description,
          observed_severity,
          road_condition,
          incident_description,
          observed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        reportReference,
        residentId,
        zoneId,
        locationDescription,
        observedSeverity,
        roadCondition,
        incidentDescription,
        observedAt
      ]
    );

    const reportId = reportResult.rows[0].id;

    await client.query(
      `
        INSERT INTO flood_report_status_history (report_id, old_status, new_status, changed_by, reason)
        VALUES ($1, NULL, 'PENDING_REVIEW', $2, 'Report submitted by resident')
      `,
      [reportId, residentId]
    );

    await client.query(
      `
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES ($1, 'REPORT_SUBMITTED', 'FLOOD_REPORT', $2, '{}'::JSONB)
      `,
      [residentId, reportId]
    );

    await client.query('COMMIT');
    return findReportForResident(reportId, residentId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findReportForResident(reportId, residentId) {
  const result = await getPool().query(
    `${reportSelect} WHERE fr.id = $1 AND fr.resident_id = $2`,
    [reportId, residentId]
  );
  return mapReport(result.rows[0]);
}

async function listReportsForResident(residentId, { status, limit, offset }) {
  const result = await getPool().query(
    `
      ${reportSelect}
      WHERE fr.resident_id = $1
        AND ($2::VARCHAR IS NULL OR fr.status = $2)
      ORDER BY fr.created_at DESC
      LIMIT $3 OFFSET $4
    `,
    [residentId, status || null, limit, offset]
  );

  const countResult = await getPool().query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM flood_reports
      WHERE resident_id = $1
        AND ($2::VARCHAR IS NULL OR status = $2)
    `,
    [residentId, status || null]
  );

  return {
    reports: result.rows.map(mapReport),
    total: countResult.rows[0].total
  };
}

async function getReportHistory(reportId, residentId) {
  const report = await findReportForResident(reportId, residentId);

  if (!report) return null;

  const statusResult = await getPool().query(
    `
      SELECT
        h.old_status,
        h.new_status,
        h.reason,
        h.created_at,
        r.code AS changed_by_role
      FROM flood_report_status_history h
      INNER JOIN users u ON u.id = h.changed_by
      INNER JOIN roles r ON r.id = u.role_id
      WHERE h.report_id = $1
      ORDER BY h.created_at ASC
    `,
    [reportId]
  );

  const reviewResult = await getPool().query(
    `
      SELECT action, review_notes, created_at
      FROM flood_report_reviews
      WHERE report_id = $1
      ORDER BY created_at ASC
    `,
    [reportId]
  );

  return {
    report,
    statusHistory: statusResult.rows.map((row) => ({
      oldStatus: row.old_status,
      newStatus: row.new_status,
      reason: row.reason,
      changedByRole: row.changed_by_role,
      createdAt: row.created_at
    })),
    reviews: reviewResult.rows.map((row) => ({
      action: row.action,
      notes: row.review_notes,
      createdAt: row.created_at
    }))
  };
}

async function updateReportForMoreInformation({
  reportId,
  residentId,
  locationDescription,
  observedSeverity,
  roadCondition,
  incidentDescription,
  observedAt
}) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `
        UPDATE flood_reports
        SET location_description = $3,
            observed_severity = $4,
            road_condition = $5,
            incident_description = $6,
            observed_at = $7,
            status = 'PENDING_REVIEW',
            updated_at = NOW()
        WHERE id = $1
          AND resident_id = $2
          AND status = 'MORE_INFORMATION_REQUIRED'
        RETURNING id
      `,
      [
        reportId,
        residentId,
        locationDescription,
        observedSeverity,
        roadCondition,
        incidentDescription,
        observedAt
      ]
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `
        INSERT INTO flood_report_status_history (report_id, old_status, new_status, changed_by, reason)
        VALUES ($1, 'MORE_INFORMATION_REQUIRED', 'PENDING_REVIEW', $2, 'Additional information submitted by resident')
      `,
      [reportId, residentId]
    );

    await client.query(
      `
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES ($1, 'REPORT_INFORMATION_UPDATED', 'FLOOD_REPORT', $2, '{}'::JSONB)
      `,
      [residentId, reportId]
    );

    await client.query('COMMIT');
    return findReportForResident(reportId, residentId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createReport,
  findReportForResident,
  listReportsForResident,
  getReportHistory,
  updateReportForMoreInformation
};
