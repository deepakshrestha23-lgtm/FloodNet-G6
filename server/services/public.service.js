const { AppError } = require('../utils/http-error');
const publicRepository = require('../repositories/public.repository');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUuidFilter(value, label) {
  if (value && !uuidPattern.test(value)) {
    const codeLabel = label.toUpperCase().replace(/\s+/g, '_');
    throw new AppError(400, `INVALID_${codeLabel}_FILTER`, `The ${label} filter must be a valid UUID`);
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

/**
 * Administrative filters, validated the same way the officer queues validate
 * theirs. Any level may be supplied on its own: choosing a district returns
 * everything inside it without naming a ward.
 */
function parseArea(query = {}) {
  for (const [field, label] of [
    ['provinceId', 'province'],
    ['districtId', 'district'],
    ['localLevelId', 'local level']
  ]) {
    validateUuidFilter(query[field], label);
  }

  return {
    provinceId: query.provinceId || undefined,
    districtId: query.districtId || undefined,
    localLevelId: query.localLevelId || undefined
  };
}

function parseCoordinates(query = {}) {
  const hasLatitude = query.latitude !== undefined && query.latitude !== '';
  const hasLongitude = query.longitude !== undefined && query.longitude !== '';

  if (hasLatitude !== hasLongitude) {
    throw new AppError(400, 'INVALID_COORDINATES', 'Latitude and longitude must be provided together');
  }

  if (!hasLatitude) return {};

  const latitude = Number(query.latitude);
  const longitude = Number(query.longitude);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new AppError(400, 'INVALID_COORDINATES', 'Latitude must be a number between -90 and 90');
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new AppError(400, 'INVALID_COORDINATES', 'Longitude must be a number between -180 and 180');
  }

  return { latitude, longitude };
}

async function getAlerts(zoneId, wardId, area) {
  validateAreaFilters(zoneId, wardId);
  return publicRepository.listActiveAlerts(zoneId, wardId, parseArea(area));
}

async function getIncidents(zoneId, wardId, limit = 50, area) {
  validateAreaFilters(zoneId, wardId);
  const parsedArea = parseArea(area);
  const parsedLimit = Number(limit);

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    throw new AppError(400, 'INVALID_LIMIT', 'The incident limit must be a positive integer');
  }

  return publicRepository.listVerifiedIncidents(zoneId, wardId, Math.min(parsedLimit, 100), parsedArea);
}

async function getCentres(zoneId, wardId, area) {
  validateAreaFilters(zoneId, wardId);
  return publicRepository.listActiveCentres(
    zoneId,
    wardId,
    parseArea(area),
    parseCoordinates(area)
  );
}

async function getZones() {
  return publicRepository.listActiveZones();
}

module.exports = { getAlerts, getIncidents, getCentres, getZones };
