const { AppError } = require('../utils/http-error');
const {
  isUuid,
  checkString,
  checkEnum,
  checkUuid,
  checkPassword,
  rejectUnknownFields
} = require('../utils/validation');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZONE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,39}$/;
const FACILITY_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_]{1,49}$/;

const ROLE_CODES = new Set([
  'RESIDENT',
  'FLOOD_MONITORING_OFFICER',
  'EVACUATION_OFFICER',
  'ADMINISTRATOR'
]);
const USER_STATUSES = new Set(['ACTIVE', 'INACTIVE']);
const JURISDICTION_LEVELS = new Set(['NATIONAL', 'PROVINCE', 'DISTRICT', 'LOCAL_LEVEL', 'WARD']);
const ZONE_TYPES = new Set(['RIVER_CORRIDOR', 'FLOODPLAIN', 'URBAN_DRAINAGE', 'FLASH_FLOOD_AREA', 'OTHER']);

function fail(next, errors) {
  return next(new AppError(400, 'VALIDATION_ERROR', 'The submitted data is invalid', errors));
}

function parsePagination(query, errors) {
  const limit = Number(query.limit || 20);
  const offset = Number(query.offset || 0);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    errors.push('Limit must be a whole number between 1 and 100');
  }

  if (!Number.isInteger(offset) || offset < 0) {
    errors.push('Offset must be zero or greater');
  }

  return { limit, offset };
}

function parseJurisdiction(errors, rawJurisdiction, { optional = true } = {}) {
  if (rawJurisdiction === undefined || rawJurisdiction === null) {
    if (optional) return null;
    errors.push('A geographic jurisdiction is required for an operational officer');
    return null;
  }

  if (!rawJurisdiction || typeof rawJurisdiction !== 'object' || Array.isArray(rawJurisdiction)) {
    errors.push('Jurisdiction must be an object');
    return null;
  }

  rejectUnknownFields(errors, rawJurisdiction, ['scopeLevel', 'provinceId', 'districtId', 'localLevelId', 'wardId']);
  checkEnum(errors, rawJurisdiction.scopeLevel, 'Jurisdiction level', JURISDICTION_LEVELS);

  const fields = {
    PROVINCE: 'provinceId',
    DISTRICT: 'districtId',
    LOCAL_LEVEL: 'localLevelId',
    WARD: 'wardId'
  };
  const expectedField = fields[rawJurisdiction.scopeLevel];
  const idFields = ['provinceId', 'districtId', 'localLevelId', 'wardId'];

  idFields.forEach((field) => {
    if (rawJurisdiction[field] !== undefined && rawJurisdiction[field] !== null) checkUuid(errors, rawJurisdiction[field], field);
    if (field !== expectedField && rawJurisdiction[field] !== undefined && rawJurisdiction[field] !== null) {
      errors.push(`${field} is not valid for ${rawJurisdiction.scopeLevel || 'this jurisdiction'}`);
    }
  });

  if (rawJurisdiction.scopeLevel !== 'NATIONAL' && !rawJurisdiction[expectedField]) {
    errors.push(`${expectedField} is required for ${rawJurisdiction.scopeLevel || 'this jurisdiction'}`);
  }
  if (rawJurisdiction.scopeLevel === 'NATIONAL' && idFields.some((field) => rawJurisdiction[field])) {
    errors.push('A national jurisdiction cannot include a narrower geographic ID');
  }

  if (errors.length) return null;
  return {
    scopeLevel: rawJurisdiction.scopeLevel,
    provinceId: rawJurisdiction.provinceId,
    districtId: rawJurisdiction.districtId,
    localLevelId: rawJurisdiction.localLevelId,
    wardId: rawJurisdiction.wardId
  };
}

function validateUserListQuery(request, _response, next) {
  const errors = [];
  const { limit, offset } = parsePagination(request.query, errors);

  if (request.query.role && !ROLE_CODES.has(request.query.role)) {
    errors.push('The role filter is invalid');
  }

  if (request.query.status && !USER_STATUSES.has(request.query.status)) {
    errors.push('The status filter is invalid');
  }

  let search;
  if (request.query.search) {
    search = checkString(errors, request.query.search, 'Search term', { min: 1, max: 100 });
  }

  if (errors.length) return fail(next, errors);

  request.userQuery = {
    search,
    roleCode: request.query.role || undefined,
    status: request.query.status || undefined,
    limit,
    offset
  };

  return next();
}

function validateStaffUserBody(request, _response, next) {
  const errors = [];
  const body = request.body || {};

  rejectUnknownFields(errors, body, [
    'email', 'password', 'roleCode', 'firstName', 'lastName', 'phone', 'jurisdiction'
  ]);

  if (typeof body.email !== 'string' || !EMAIL_PATTERN.test(body.email.trim())) {
    errors.push('A valid email address is required');
  }

  checkPassword(errors, body.password);
  checkEnum(errors, body.roleCode, 'Role', ROLE_CODES);

  const firstName = checkString(errors, body.firstName, 'First name', { min: 1, max: 100 });
  const lastName = checkString(errors, body.lastName, 'Last name', { min: 1, max: 100 });

  let phone = null;
  if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
    phone = checkString(errors, body.phone, 'Phone number', { min: 3, max: 40 });
  }

  const jurisdiction = parseJurisdiction(errors, body.jurisdiction);

  if (errors.length) return fail(next, errors);

  request.staffUserInput = {
    email: body.email.trim().toLowerCase(),
    password: body.password,
    roleCode: body.roleCode,
    firstName,
    lastName,
    phone,
    jurisdiction
  };

  return next();
}

function validateJurisdictionBody(request, _response, next) {
  const errors = [];
  const jurisdiction = parseJurisdiction(errors, request.body || {}, { optional: false });
  if (errors.length) return fail(next, errors);
  request.jurisdictionInput = jurisdiction;
  return next();
}

/**
 * An administrator supplies the replacement password directly. The reset is
 * recorded in the audit log and ends every session the account has open, so a
 * password the administrator knows cannot be used silently alongside the owner.
 */
function validatePasswordResetBody(request, _response, next) {
  const errors = [];
  const body = request.body || {};

  rejectUnknownFields(errors, body, ['newPassword']);
  checkPassword(errors, body.newPassword, 'New password');

  if (errors.length) return fail(next, errors);

  request.passwordResetInput = { newPassword: body.newPassword };
  return next();
}

function validateUserStatusBody(request, _response, next) {
  const errors = [];
  const body = request.body || {};

  rejectUnknownFields(errors, body, ['status']);
  checkEnum(errors, body.status, 'Status', USER_STATUSES);

  if (errors.length) return fail(next, errors);

  request.statusInput = { status: body.status };
  return next();
}

function validateUserRoleBody(request, _response, next) {
  const errors = [];
  const body = request.body || {};

  rejectUnknownFields(errors, body, ['roleCode']);
  checkEnum(errors, body.roleCode, 'Role', ROLE_CODES);

  if (errors.length) return fail(next, errors);

  request.roleInput = { roleCode: body.roleCode };
  return next();
}

function validateZoneBody(request, _response, next) {
  const errors = [];
  const body = request.body || {};
  const isCreate = request.method === 'POST';

  rejectUnknownFields(errors, body, ['code', 'name', 'locality', 'description', 'zoneType', 'isActive']);

  // A zone code is permanent identity used across reports, alerts and centres,
  // so it is set at creation only.
  if (isCreate) {
    if (typeof body.code !== 'string' || !ZONE_CODE_PATTERN.test(body.code.trim().toUpperCase())) {
      errors.push('Zone code must be 2 to 40 uppercase letters, numbers or hyphens');
    }
  } else if (body.code !== undefined) {
    errors.push('A zone code cannot be changed after creation');
  }

  const name = checkString(errors, body.name, 'Zone name', { min: 2, max: 120 });

  let locality = null;
  if (body.locality !== undefined && body.locality !== null && body.locality !== '') {
    locality = checkString(errors, body.locality, 'Locality', { min: 2, max: 120 });
  }

  let description = null;
  if (body.description !== undefined && body.description !== null && body.description !== '') {
    description = checkString(errors, body.description, 'Description', { min: 2, max: 2000 });
  }

  const zoneType = body.zoneType || (isCreate ? 'OTHER' : undefined);
  if (zoneType !== undefined) checkEnum(errors, zoneType, 'Risk-area type', ZONE_TYPES);

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Active state must be true or false');
  }

  if (errors.length) return fail(next, errors);

  request.zoneInput = {
    code: isCreate ? body.code.trim().toUpperCase() : undefined,
    name,
    locality,
    description,
    zoneType,
    isActive: body.isActive === undefined ? true : body.isActive
  };

  return next();
}

function validateFacilityTypeBody(request, _response, next) {
  const errors = [];
  const body = request.body || {};

  rejectUnknownFields(errors, body, ['facilityTypeId', 'code', 'displayName', 'isActive']);

  const isUpdate = body.facilityTypeId !== undefined && body.facilityTypeId !== null;

  if (isUpdate) {
    checkUuid(errors, body.facilityTypeId, 'Facility type');

    if (body.code !== undefined) {
      errors.push('A facility type code cannot be changed after creation');
    }
  } else if (typeof body.code !== 'string' || !FACILITY_CODE_PATTERN.test(body.code.trim().toUpperCase())) {
    errors.push('Facility code must be 2 to 50 uppercase letters, numbers or underscores');
  }

  const displayName = checkString(errors, body.displayName, 'Display name', { min: 2, max: 100 });

  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
    errors.push('Active state must be true or false');
  }

  if (errors.length) return fail(next, errors);

  request.facilityTypeInput = {
    facilityTypeId: isUpdate ? body.facilityTypeId : undefined,
    code: isUpdate ? undefined : body.code.trim().toUpperCase(),
    displayName,
    isActive: body.isActive === undefined ? true : body.isActive
  };

  return next();
}

function validateAuditQuery(request, _response, next) {
  const errors = [];
  const query = request.query;
  const { limit, offset } = parsePagination(query, errors);

  if (query.actorId && !isUuid(query.actorId)) {
    errors.push('The actor filter must be a valid identifier');
  }

  let action;
  if (query.action) {
    action = checkString(errors, query.action, 'Action filter', { min: 2, max: 100 });
  }

  let entityType;
  if (query.entityType) {
    entityType = checkString(errors, query.entityType, 'Entity type filter', { min: 2, max: 80 });
  }

  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;

  if (query.from && Number.isNaN(from.getTime())) errors.push('The from date is invalid');
  if (query.to && Number.isNaN(to.getTime())) errors.push('The to date is invalid');

  if (errors.length) return fail(next, errors);

  request.auditQuery = {
    actorId: query.actorId || undefined,
    action,
    entityType,
    from: from || undefined,
    to: to || undefined,
    limit,
    offset
  };

  return next();
}

function validateResourceId(paramName, label) {
  return (request, _response, next) => {
    if (!isUuid(request.params[paramName])) {
      return next(new AppError(400, 'INVALID_IDENTIFIER', `The ${label} must be a valid identifier`));
    }

    return next();
  };
}

module.exports = {
  validateUserListQuery,
  validateStaffUserBody,
  validatePasswordResetBody,
  validateJurisdictionBody,
  validateUserStatusBody,
  validateUserRoleBody,
  validateZoneBody,
  validateFacilityTypeBody,
  validateAuditQuery,
  validateResourceId
};
