/**
 * Writes an audit entry using the caller's transaction client so the audit
 * record commits or rolls back together with the state change it describes.
 */
async function insertAuditLog(client, { actorId, action, entityType, entityId, metadata = {} }) {
  await client.query(
    `
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
      VALUES ($1, $2, $3, $4, $5::JSONB)
    `,
    [actorId, action, entityType, entityId, JSON.stringify(metadata)]
  );
}

module.exports = { insertAuditLog };
