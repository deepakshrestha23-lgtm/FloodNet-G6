const { AppError } = require('../utils/http-error');
const publicRepository = require('../repositories/public.repository');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateZoneFilter(zoneId) {
  if (zoneId && !uuidPattern.test(zoneId)) {
    throw new AppError(400, 'INVALID_ZONE', 'The zone filter must be a valid UUID');
  }
}

async function getAlerts(zoneId) {
  validateZoneFilter(zoneId);
  return publicRepository.listActiveAlerts(zoneId);
}

async function getIncidents(zoneId, limit = 50) {
  validateZoneFilter(zoneId);
  const parsedLimit = Number(limit);

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    throw new AppError(400, 'INVALID_LIMIT', 'The incident limit must be a positive integer');
  }

  return publicRepository.listVerifiedIncidents(zoneId, Math.min(parsedLimit, 100));
}

async function getCentres(zoneId) {
  validateZoneFilter(zoneId);
  return publicRepository.listActiveCentres(zoneId);
}

async function getZones() {
  return publicRepository.listActiveZones();
}

module.exports = { getAlerts, getIncidents, getCentres, getZones };
