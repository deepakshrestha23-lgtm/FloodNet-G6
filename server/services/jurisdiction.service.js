const { AppError } = require('../utils/http-error');
const jurisdictionRepository = require('../repositories/jurisdiction.repository');

async function requireAssignment(userId) {
  const jurisdiction = await jurisdictionRepository.findForUser(userId);
  if (!jurisdiction) {
    throw new AppError(
      403,
      'JURISDICTION_NOT_ASSIGNED',
      'This operational account has no assigned geographic jurisdiction'
    );
  }
  return jurisdiction;
}

function mapJurisdiction(row) {
  if (!row) return null;
  return {
    scopeLevel: row.scope_level,
    province: row.province_id ? { id: row.province_id, code: row.province_code, name: row.province_name } : null,
    district: row.district_id ? { id: row.district_id, code: row.district_code, name: row.district_name } : null,
    localLevel: row.local_level_id ? { id: row.local_level_id, code: row.local_level_code, name: row.local_level_name } : null,
    ward: row.ward_id ? { id: row.ward_id, number: row.ward_number, name: row.ward_name } : null
  };
}

module.exports = { requireAssignment, mapJurisdiction };
