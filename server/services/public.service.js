const { AppError } = require('../utils/http-error');
const publicRepository = require('../repositories/public.repository');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUuidFilter(value, label) {
  if (value && !uuidPattern.test(value)) {
    throw new AppError(400, `INVALID_${label.toUpperCase()}_FILTER`, `The ${label} filter must be a valid UUID`);
  }
}

function validateZoneFilter(zoneId) {
  validateUuidFilter(zoneId, 'zone');
}

function validateWardFilter(wardId) {
  validateUuidFilter(wardId, 'ward');
}

function validateAreaFilters(zoneId, wardId) {
  validateZoneFilter(zoneId);
  validateWardFilter(wardId);
}

async function getAlerts(zoneId, wardId) {
  validateAreaFilters(zoneId, wardId);
  return publicRepository.listActiveAlerts(zoneId, wardId);
}

async function getIncidents(zoneId, wardId, limit = 50) {
  validateAreaFilters(zoneId, wardId);
  const parsedLimit = Number(limit);

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    throw new AppError(400, 'INVALID_LIMIT', 'The incident limit must be a positive integer');
  }

  return publicRepository.listVerifiedIncidents(zoneId, wardId, Math.min(parsedLimit, 100));
}

async function getCentres(zoneId, wardId) {
  validateAreaFilters(zoneId, wardId);
  return publicRepository.listActiveCentres(zoneId, wardId);
}

async function getZones() {
  return publicRepository.listActiveZones();
}

module.exports = { getAlerts, getIncidents, getCentres, getZones };
