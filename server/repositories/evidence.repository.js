const { pool } = require('../db/pool');

function getPool() {
  if (!pool) {
    throw new Error('Database pool is not configured');
  }

  return pool;
}

async function countEvidenceForReport(reportId) {
  const result = await getPool().query(
    'SELECT COUNT(*)::INTEGER AS count FROM flood_evidence_metadata WHERE report_id = $1',
    [reportId]
  );
  return result.rows[0].count;
}

async function createEvidenceMetadata({
  reportId,
  uploadedBy,
  objectKey,
  originalFilename,
  contentType,
  sizeBytes,
  checksum
}) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `
        INSERT INTO flood_evidence_metadata (
          report_id,
          uploaded_by,
          object_key,
          original_filename,
          content_type,
          size_bytes,
          upload_status,
          checksum
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'UPLOADED', $7)
        RETURNING id, report_id, object_key, original_filename, content_type, size_bytes, upload_status, checksum, created_at
      `,
      [reportId, uploadedBy, objectKey, originalFilename, contentType, sizeBytes, checksum || null]
    );

    await client.query(
      `
        INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES ($1, 'EVIDENCE_ATTACHED', 'FLOOD_REPORT', $2, $3::JSONB)
      `,
      [uploadedBy, reportId, JSON.stringify({ contentType, sizeBytes })]
    );

    await client.query('COMMIT');
    return mapEvidence(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createEvidenceMetadataBatch({ reportId, uploadedBy, evidence }) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const savedEvidence = [];

    for (const item of evidence) {
      const result = await client.query(
        `
          INSERT INTO flood_evidence_metadata (
            report_id,
            uploaded_by,
            object_key,
            original_filename,
            content_type,
            size_bytes,
            upload_status,
            checksum
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'UPLOADED', $7)
          RETURNING id, report_id, object_key, original_filename, content_type, size_bytes, upload_status, checksum, created_at
        `,
        [
          reportId,
          uploadedBy,
          item.objectKey,
          item.originalFilename,
          item.contentType,
          item.sizeBytes,
          item.checksum || null
        ]
      );

      await client.query(
        `
          INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
          VALUES ($1, 'EVIDENCE_ATTACHED', 'FLOOD_REPORT', $2, $3::JSONB)
        `,
        [uploadedBy, reportId, JSON.stringify({ contentType: item.contentType, sizeBytes: item.sizeBytes })]
      );

      savedEvidence.push(mapEvidence(result.rows[0]));
    }

    await client.query('COMMIT');
    return savedEvidence;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listEvidenceForReport(reportId, uploadedBy) {
  const result = await getPool().query(
    `
      SELECT id, report_id, object_key, original_filename, content_type, size_bytes, upload_status, checksum, created_at
      FROM flood_evidence_metadata
      WHERE report_id = $1 AND uploaded_by = $2
      ORDER BY created_at ASC
    `,
    [reportId, uploadedBy]
  );

  return result.rows.map(mapEvidence);
}

async function findEvidenceForResident(evidenceId, reportId, uploadedBy) {
  const result = await getPool().query(
    `
      SELECT id, report_id, object_key, original_filename, content_type, size_bytes, upload_status, checksum, created_at
      FROM flood_evidence_metadata
      WHERE id = $1 AND report_id = $2 AND uploaded_by = $3
    `,
    [evidenceId, reportId, uploadedBy]
  );

  return result.rows[0] ? mapEvidence(result.rows[0]) : null;
}

/**
 * Officer-scoped lookup. A Flood Monitoring Officer reviews reports submitted by
 * any resident, so this is deliberately not filtered by uploader. Authorization
 * is enforced by the officer-only route that reaches it.
 */
async function findEvidenceForReport(evidenceId, reportId) {
  const result = await getPool().query(
    `
      SELECT id, report_id, object_key, original_filename, content_type, size_bytes, upload_status, checksum, created_at
      FROM flood_evidence_metadata
      WHERE id = $1 AND report_id = $2 AND upload_status = 'UPLOADED'
    `,
    [evidenceId, reportId]
  );

  return result.rows[0] ? mapEvidence(result.rows[0]) : null;
}

function mapEvidence(row) {
  return {
    id: row.id,
    reportId: row.report_id,
    objectKey: row.object_key,
    originalFilename: row.original_filename,
    contentType: row.content_type,
    // size_bytes is BIGINT, which node-postgres returns as a string.
    sizeBytes: Number(row.size_bytes),
    uploadStatus: row.upload_status,
    checksum: row.checksum,
    createdAt: row.created_at
  };
}

module.exports = {
  countEvidenceForReport,
  createEvidenceMetadata,
  createEvidenceMetadataBatch,
  findEvidenceForResident,
  findEvidenceForReport,
  listEvidenceForReport
};
