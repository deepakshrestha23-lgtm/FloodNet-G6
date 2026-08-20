const { pool } = require('../db/pool');
const { insertAuditLog } = require('../utils/audit');

function getPool() {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  return pool;
}

const officerReportSelect = `
  SELECT
    fr.id,
    fr.report_ref,
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
    z.locality AS zone_locality,
    fr.resident_id,
    p.first_name AS resident_first_name,
    p.last_name AS resident_last_name,
    u.email AS resident_email,
    p.phone AS resident_phone,
    (SELECT COUNT(*)::INTEGER FROM flood_evidence_metadata e
      WHERE e.report_id = fr.id AND e.upload_status = 'UPLOADED') AS evidence_count
  FROM flood_reports fr
  INNER JOIN flood_zones z ON z.id = fr.zone_id
  INNER JOIN users u ON u.id = fr.resident_id
  LEFT JOIN user_profiles p ON p.user_id = fr.resident_id
`;

function mapOfficerReport(row) {
  if (!row) return null;

  return {
    id: row.id,
    reportReference: row.report_ref,
    zone: {
      id: row.zone_id,
      code: row.zone_code,
      name: row.zone_name,
      locality: row.zone_locality
    },
    reporter: {
      id: row.resident_id,
      firstName: row.resident_first_name,
      lastName: row.resident_last_name,
      email: row.resident_email,
      phone: row.resident_phone
    },
    locationDescription: row.location_description,
    observedSeverity: row.observed_severity,
    roadCondition: row.road_condition,
    incidentDescription: row.incident_description,
    observedAt: row.observed_at,
    status: row.status,
    evidenceCount: row.evidence_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listReports({ status, zoneId, severity, from, to, sort, limit, offset }) {
  const parameters = [
    status || null,
    zoneId || null,
    severity || null,
    from || null,
    to || null,
    limit,
    offset
  ];

  const filterClause = `
    WHERE ($1::VARCHAR IS NULL OR fr.status = $1)
      AND ($2::UUID IS NULL OR fr.zone_id = $2)
      AND ($3::VARCHAR IS NULL OR fr.observed_severity = $3)
      AND ($4::TIMESTAMPTZ IS NULL OR fr.observed_at >= $4)
      AND ($5::TIMESTAMPTZ IS NULL OR fr.observed_at <= $5)
  `;

  const result = await getPool().query(
    `
      ${officerReportSelect}
      ${filterClause}
      ORDER BY fr.created_at ${sort === 'oldest' ? 'ASC' : 'DESC'}
      LIMIT $6 OFFSET $7
    `,
    parameters
  );

  const countResult = await getPool().query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM flood_reports fr
      ${filterClause}
    `,
    parameters.slice(0, 5)
  );

  return {
    reports: result.rows.map(mapOfficerReport),
    total: countResult.rows[0].total
  };
}

async function findReportById(reportId) {
  const result = await getPool().query(
    `${officerReportSelect} WHERE fr.id = $1`,
    [reportId]
  );

  return mapOfficerReport(result.rows[0]);
}

async function getReportDossier(reportId) {
  const report = await findReportById(reportId);

  if (!report) return null;

  const statusResult = await getPool().query(
    `
      SELECT h.old_status, h.new_status, h.reason, h.created_at, r.code AS changed_by_role
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
      SELECT rv.action, rv.review_notes, rv.created_at,
             p.first_name AS reviewer_first_name,
             p.last_name AS reviewer_last_name
      FROM flood_report_reviews rv
      LEFT JOIN user_profiles p ON p.user_id = rv.reviewer_id
      WHERE rv.report_id = $1
      ORDER BY rv.created_at ASC
    `,
    [reportId]
  );

  const evidenceResult = await getPool().query(
    `
      SELECT id, original_filename, content_type, size_bytes, created_at
      FROM flood_evidence_metadata
      WHERE report_id = $1 AND upload_status = 'UPLOADED'
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
      reviewerName: [row.reviewer_first_name, row.reviewer_last_name].filter(Boolean).join(' ') || null,
      createdAt: row.created_at
    })),
    evidence: evidenceResult.rows.map((row) => ({
      id: row.id,
      originalFilename: row.original_filename,
      contentType: row.content_type,
      sizeBytes: Number(row.size_bytes),
      createdAt: row.created_at
    }))
  };
}

/**
 * Applies an officer review decision. The review record, the report status,
 * the status history entry and the audit entry all commit together.
 * `allowedFromStatuses` is enforced in SQL so concurrent reviews cannot race.
 */
async function applyReview({ reportId, reviewerId, action, newStatus, notes, allowedFromStatuses }) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const currentResult = await client.query(
      'SELECT status FROM flood_reports WHERE id = $1 FOR UPDATE',
      [reportId]
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

    await client.query(
      `
        INSERT INTO flood_report_reviews (report_id, reviewer_id, action, review_notes)
        VALUES ($1, $2, $3, $4)
      `,
      [reportId, reviewerId, action, notes || null]
    );

    await client.query(
      'UPDATE flood_reports SET status = $2, updated_at = NOW() WHERE id = $1',
      [reportId, newStatus]
    );

    await client.query(
      `
        INSERT INTO flood_report_status_history (report_id, old_status, new_status, changed_by, reason)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [reportId, oldStatus, newStatus, reviewerId, notes || `Report ${action.toLowerCase()} by flood monitoring officer`]
    );

    await insertAuditLog(client, {
      actorId: reviewerId,
      action: `REPORT_${action}`,
      entityType: 'FLOOD_REPORT',
      entityId: reportId,
      metadata: { oldStatus, newStatus }
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

module.exports = {
  listReports,
  findReportById,
  getReportDossier,
  applyReview
};
