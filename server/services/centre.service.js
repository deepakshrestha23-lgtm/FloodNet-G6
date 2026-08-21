const { AppError } = require('../utils/http-error');
const centreRepository = require('../repositories/centre.repository');
const dashboardRepository = require('../repositories/dashboard.repository');
const userRepository = require('../repositories/user.repository');
const jurisdictionService = require('./jurisdiction.service');
const jurisdictionRepository = require('../repositories/jurisdiction.repository');

const NEAR_CAPACITY_THRESHOLD = 0.85;

/**
 * Suggests an operational status from live occupancy. A centre an officer has
 * closed stays closed: a closed centre is an operational decision, not a
 * capacity calculation, so it is never reopened automatically.
 */
function suggestOperationalStatus({ currentOccupancy, maximumCapacity, currentStatus }) {
  if (currentStatus === 'CLOSED') return 'CLOSED';
  if (maximumCapacity === 0) return 'FULL';
  if (currentOccupancy >= maximumCapacity) return 'FULL';
  if (currentOccupancy / maximumCapacity >= NEAR_CAPACITY_THRESHOLD) return 'NEAR_CAPACITY';

  return 'OPEN';
}

async function assertZoneIsActive(zoneId) {
  if (!zoneId) return;
  const active = await userRepository.isActiveZone(zoneId);

  if (!active) {
    throw new AppError(400, 'INVALID_ZONE', 'The selected flood zone is invalid or inactive');
  }
}

async function assertLocationIsAllowed(officerId, { zoneId, wardId }) {
  await assertZoneIsActive(zoneId);

  if (wardId) {
    if (!(await userRepository.isActiveWard(wardId))) {
      throw new AppError(400, 'INVALID_WARD', 'The selected administrative ward is invalid or inactive');
    }
    if (!(await jurisdictionRepository.canAccessWard(officerId, wardId))) {
      throw new AppError(403, 'JURISDICTION_FORBIDDEN', 'The centre is outside your assigned jurisdiction');
    }
    if (zoneId && !(await jurisdictionRepository.canAccessZone(officerId, zoneId))) {
      throw new AppError(403, 'JURISDICTION_FORBIDDEN', 'The centre is outside your assigned jurisdiction');
    }
  } else if (!(await jurisdictionRepository.canAccessZone(officerId, zoneId))) {
    throw new AppError(403, 'JURISDICTION_FORBIDDEN', 'The centre is outside your assigned jurisdiction');
  }
}

async function assertCentreIsAllowed(officerId, centre) {
  if (centre.geography?.ward?.id) {
    if (!(await jurisdictionRepository.canAccessWard(officerId, centre.geography.ward.id))) {
      throw new AppError(403, 'JURISDICTION_FORBIDDEN', 'The centre is outside your assigned jurisdiction');
    }
    return;
  }

  if (!(await jurisdictionRepository.canAccessZone(officerId, centre.zone?.id))) {
    throw new AppError(403, 'JURISDICTION_FORBIDDEN', 'The centre is outside your assigned jurisdiction');
  }
}

async function resolveFacilities(facilities) {
  if (facilities.length === 0) return [];

  const requestedIds = facilities.map((facility) => facility.facilityTypeId);
  const validIds = await centreRepository.findFacilityTypeIds(requestedIds);
  const validIdSet = new Set(validIds);

  const invalid = requestedIds.filter((id) => !validIdSet.has(id));

  if (invalid.length) {
    throw new AppError(400, 'INVALID_FACILITY_TYPE', 'One or more selected facilities are invalid or inactive');
  }

  return facilities;
}

async function listCentres(query) {
  return centreRepository.listCentres(query);
}

async function getCentre(centreId) {
  const centre = await centreRepository.findCentreById(centreId);

  if (!centre) {
    throw new AppError(404, 'CENTRE_NOT_FOUND', 'The requested evacuation centre was not found');
  }

  return centre;
}

async function createCentre(officer, input) {
  await jurisdictionService.requireAssignment(officer.id);
  await assertLocationIsAllowed(officer.id, input);
  const facilities = await resolveFacilities(input.facilities);

  if (input.currentOccupancy > input.maximumCapacity) {
    throw new AppError(
      400,
      'OCCUPANCY_EXCEEDS_CAPACITY',
      'Current occupancy cannot be greater than the maximum capacity'
    );
  }

  const operationalStatus = suggestOperationalStatus({
    currentOccupancy: input.currentOccupancy,
    maximumCapacity: input.maximumCapacity,
    currentStatus: input.operationalStatus
  });

  return centreRepository.createCentre({
    actorId: officer.id,
    zoneId: input.zoneId,
    wardId: input.wardId,
    locality: input.locality,
    nearestLandmark: input.nearestLandmark,
    latitude: input.latitude,
    longitude: input.longitude,
    name: input.name,
    locationDescription: input.locationDescription,
    contactPhone: input.contactPhone,
    maximumCapacity: input.maximumCapacity,
    currentOccupancy: input.currentOccupancy,
    operationalStatus,
    facilities
  });
}

/**
 * Capacity may be reduced, but not below the people currently recorded as being
 * in the centre. The officer is told to update occupancy first rather than
 * being shown a database constraint error.
 */
async function updateCentre(officer, centreId, input) {
  const existing = await getCentre(centreId);
  await jurisdictionService.requireAssignment(officer.id);
  await assertCentreIsAllowed(officer.id, existing);

  if (!existing.isActive) {
    throw new AppError(409, 'CENTRE_ARCHIVED', 'An archived evacuation centre cannot be edited');
  }

  await assertLocationIsAllowed(officer.id, input);
  const facilities = await resolveFacilities(input.facilities);

  if (input.maximumCapacity < existing.currentOccupancy) {
    throw new AppError(
      409,
      'CAPACITY_BELOW_OCCUPANCY',
      `Maximum capacity cannot be set below the current occupancy of ${existing.currentOccupancy}. Reduce the recorded occupancy first.`
    );
  }

  const operationalStatus = suggestOperationalStatus({
    currentOccupancy: existing.currentOccupancy,
    maximumCapacity: input.maximumCapacity,
    currentStatus: input.operationalStatus || existing.operationalStatus
  });

  const centre = await centreRepository.updateCentre({
    centreId,
    actorId: officer.id,
    zoneId: input.zoneId,
    wardId: input.wardId,
    locality: input.locality,
    nearestLandmark: input.nearestLandmark,
    latitude: input.latitude,
    longitude: input.longitude,
    name: input.name,
    locationDescription: input.locationDescription,
    contactPhone: input.contactPhone,
    maximumCapacity: input.maximumCapacity,
    operationalStatus,
    facilities
  });

  if (!centre) {
    throw new AppError(409, 'CENTRE_ARCHIVED', 'An archived evacuation centre cannot be edited');
  }

  return centre;
}

async function updateOccupancy(officer, centreId, currentOccupancy) {
  const existing = await getCentre(centreId);
  await jurisdictionService.requireAssignment(officer.id);
  await assertCentreIsAllowed(officer.id, existing);

  if (!existing.isActive) {
    throw new AppError(409, 'CENTRE_ARCHIVED', 'An archived evacuation centre cannot be updated');
  }

  const operationalStatus = suggestOperationalStatus({
    currentOccupancy,
    maximumCapacity: existing.maximumCapacity,
    currentStatus: existing.operationalStatus
  });

  const result = await centreRepository.updateOccupancy({
    centreId,
    actorId: officer.id,
    currentOccupancy,
    operationalStatus
  });

  if (result.outcome === 'NOT_FOUND') {
    throw new AppError(404, 'CENTRE_NOT_FOUND', 'The requested evacuation centre was not found');
  }

  if (result.outcome === 'OVER_CAPACITY') {
    throw new AppError(
      400,
      'OCCUPANCY_EXCEEDS_CAPACITY',
      `Occupancy cannot exceed the maximum capacity of ${result.maximumCapacity}`
    );
  }

  return centreRepository.findCentreById(centreId);
}

async function updateStatus(officer, centreId, operationalStatus) {
  await jurisdictionService.requireAssignment(officer.id);
  const existing = await getCentre(centreId);
  if (!existing) throw new AppError(404, 'CENTRE_NOT_FOUND', 'The requested evacuation centre was not found');
  await assertCentreIsAllowed(officer.id, existing);
  const centre = await centreRepository.updateStatus({
    centreId,
    actorId: officer.id,
    operationalStatus
  });

  if (!centre) {
    throw new AppError(404, 'CENTRE_NOT_FOUND', 'The requested evacuation centre was not found');
  }

  return centre;
}

async function archiveCentre(officer, centreId) {
  await jurisdictionService.requireAssignment(officer.id);
  const existing = await getCentre(centreId);
  if (!existing) throw new AppError(404, 'CENTRE_NOT_FOUND', 'The requested evacuation centre was not found');
  await assertCentreIsAllowed(officer.id, existing);
  const centre = await centreRepository.archiveCentre({ centreId, actorId: officer.id });

  if (!centre) {
    throw new AppError(404, 'CENTRE_NOT_FOUND', 'The requested active evacuation centre was not found');
  }

  return centre;
}

async function listFacilityTypes() {
  return centreRepository.listFacilityTypes();
}

async function getDashboard(officer, geographyQuery) {
  await jurisdictionService.requireAssignment(officer.id);
  return dashboardRepository.getEvacuationDashboard(officer.id, geographyQuery);
}

module.exports = {
  NEAR_CAPACITY_THRESHOLD,
  suggestOperationalStatus,
  listCentres,
  getCentre,
  createCentre,
  updateCentre,
  updateOccupancy,
  updateStatus,
  archiveCentre,
  listFacilityTypes,
  getDashboard
};
