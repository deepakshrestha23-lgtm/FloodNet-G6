const { AppError } = require('../utils/http-error');
const {
  isUuid,
  checkString,
  checkEnum,
  checkInteger,
  checkUuid,
  rejectUnknownFields
} = require('../utils/validation');

const OPERATIONAL_STATUSES = new Set(['OPEN', 'NEAR_CAPACITY', 'FULL', 'CLOSED']);
const MAX_REASONABLE_CAPACITY = 100000;

function fail(next, errors) {
  return next(new AppError(400, 'VALIDATION_ERROR', 'The submitted data is invalid', errors));
}

function parseFacilities(errors, rawFacilities) {
  if (rawFacilities === undefined) return [];

  if (!Array.isArray(rawFacilities)) {
    errors.push('Facilities must be a list');
    return [];
  }

  if (rawFacilities.length > 30) {
    errors.push('A centre cannot record more than 30 facilities');
    return [];
  }

  return rawFacilities.map((facility) => {
    if (!facility || typeof facility !== 'object') {
      errors.push('Each facility must include a facility type');
      return null;
    }

    checkUuid(errors, facility.facilityTypeId, 'Facility type');

    let notes = null;
    if (facility.notes !== undefined && facility.notes !== null && facility.notes !== '') {
      notes = checkString(errors, facility.notes, 'Facility notes', { min: 1, max: 300 });
    }

    return { facilityTypeId: facility.facilityTypeId, notes };
  }).filter(Boolean);
}

function validateCentreBody(request, _response, next) {
  const errors = [];
  const body = request.body || {};
  const isCreate = request.method === 'POST';

  rejectUnknownFields(errors, body, [
    'zoneId',
    'name',
    'locationDescription',
    'contactPhone',
    'maximumCapacity',
    'currentOccupancy',
    'operationalStatus',
    'facilities'
  ]);

  checkUuid(errors, body.zoneId, 'Flood zone');
  const name = checkString(errors, body.name, 'Centre name', { min: 3, max: 160 });
  const locationDescription = checkString(errors, body.locationDescription, 'Location description', { min: 3, max: 500 });

  let contactPhone = null;
  if (body.contactPhone !== undefined && body.contactPhone !== null && body.contactPhone !== '') {
    contactPhone = checkString(errors, body.contactPhone, 'Contact phone', { min: 3, max: 40 });
  }

  const maximumCapacity = checkInteger(errors, body.maximumCapacity, 'Maximum capacity', {
    min: 0,
    max: MAX_REASONABLE_CAPACITY
  });

  // Occupancy is only accepted when a centre is first recorded. Afterwards it
  // changes through the dedicated occupancy endpoint so every movement of
  // people is audited on its own.
  let currentOccupancy = 0;
  if (isCreate && body.currentOccupancy !== undefined) {
    currentOccupancy = checkInteger(errors, body.currentOccupancy, 'Current occupancy', {
      min: 0,
      max: MAX_REASONABLE_CAPACITY
    });
  } else if (!isCreate && body.currentOccupancy !== undefined) {
    errors.push('Current occupancy is updated through the occupancy endpoint');
  }

  if (body.operationalStatus !== undefined) {
    checkEnum(errors, body.operationalStatus, 'Operational status', OPERATIONAL_STATUSES);
  }

  const facilities = parseFacilities(errors, body.facilities);

  if (errors.length) return fail(next, errors);

  request.centreInput = {
    zoneId: body.zoneId,
    name,
    locationDescription,
    contactPhone,
    maximumCapacity,
    currentOccupancy: currentOccupancy ?? 0,
    operationalStatus: body.operationalStatus,
    facilities
  };

  return next();
}

function validateOccupancyBody(request, _response, next) {
  const errors = [];
  const body = request.body || {};

  rejectUnknownFields(errors, body, ['currentOccupancy']);
  const currentOccupancy = checkInteger(errors, body.currentOccupancy, 'Current occupancy', {
    min: 0,
    max: MAX_REASONABLE_CAPACITY
  });

  if (errors.length) return fail(next, errors);

  request.occupancyInput = { currentOccupancy };
  return next();
}

function validateStatusBody(request, _response, next) {
  const errors = [];
  const body = request.body || {};

  rejectUnknownFields(errors, body, ['operationalStatus']);
  checkEnum(errors, body.operationalStatus, 'Operational status', OPERATIONAL_STATUSES);

  if (errors.length) return fail(next, errors);

  request.statusInput = { operationalStatus: body.operationalStatus };
  return next();
}

function validateCentreListQuery(request, _response, next) {
  const errors = [];
  const query = request.query;

  if (query.zoneId && !isUuid(query.zoneId)) {
    errors.push('The zone filter must be a valid identifier');
  }

  if (query.status && !OPERATIONAL_STATUSES.has(query.status)) {
    errors.push('The status filter is invalid');
  }

  if (errors.length) return fail(next, errors);

  request.centreQuery = {
    zoneId: query.zoneId || undefined,
    status: query.status || undefined,
    includeArchived: query.includeArchived === 'true'
  };

  return next();
}

function validateCentreId(request, _response, next) {
  if (!isUuid(request.params.id)) {
    return next(new AppError(400, 'INVALID_IDENTIFIER', 'The centre identifier must be a valid identifier'));
  }

  return next();
}

module.exports = {
  validateCentreBody,
  validateOccupancyBody,
  validateStatusBody,
  validateCentreListQuery,
  validateCentreId
};
