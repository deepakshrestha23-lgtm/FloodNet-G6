const { AppError } = require('../utils/http-error');
const {
  isUuid,
  checkString,
  checkEnum,
  checkUuid,
  checkDate,
  rejectUnknownFields
} = require('../utils/validation');

const REPORT_STATUSES = new Set([
  'PENDING_REVIEW',
  'MORE_INFORMATION_REQUIRED',
  'VERIFIED',
  'REJECTED',
  'CLOSED'
]);
const SEVERITIES = new Set(['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'UNKNOWN']);
const ALERT_SEVERITIES = new Set(['ADVISORY', 'WATCH', 'WARNING', 'EMERGENCY']);
const ALERT_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'EXPIRED', 'CANCELLED']);
const REVIEW_ACTIONS = new Set(['VERIFY', 'REJECT', 'MORE_INFORMATION_REQUIRED', 'CLOSE']);

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

function validateReportQueueQuery(request, _response, next) {
  const errors = [];
  const query = request.query;
  const { limit, offset } = parsePagination(query, errors);

  if (query.status && !REPORT_STATUSES.has(query.status)) {
    errors.push('The status filter is invalid');
  }

  if (query.zoneId && !isUuid(query.zoneId)) {
    errors.push('The zone filter must be a valid identifier');
  }

  for (const [field, label] of [
    ['provinceId', 'province'],
    ['districtId', 'district'],
    ['localLevelId', 'local-level'],
    ['wardId', 'ward']
  ]) {
    if (query[field] && !isUuid(query[field])) errors.push(`The ${label} filter must be a valid identifier`);
  }

  if (query.severity && !SEVERITIES.has(query.severity)) {
    errors.push('The severity filter is invalid');
  }

  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;

  if (query.from && Number.isNaN(from.getTime())) errors.push('The from date is invalid');
  if (query.to && Number.isNaN(to.getTime())) errors.push('The to date is invalid');

  if (from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from > to) {
    errors.push('The from date cannot be later than the to date');
  }

  if (query.sort && !['newest', 'oldest'].includes(query.sort)) {
    errors.push('Sort must be newest or oldest');
  }

  if (errors.length) return fail(next, errors);

  request.queueQuery = {
    status: query.status || undefined,
    zoneId: query.zoneId || undefined,
    provinceId: query.provinceId || undefined,
    districtId: query.districtId || undefined,
    localLevelId: query.localLevelId || undefined,
    wardId: query.wardId || undefined,
    severity: query.severity || undefined,
    from: from || undefined,
    to: to || undefined,
    sort: query.sort === 'oldest' ? 'oldest' : 'newest',
    limit,
    offset
  };

  return next();
}

function validateReviewDecision(request, _response, next) {
  const errors = [];
  const body = request.body || {};

  rejectUnknownFields(errors, body, ['action', 'notes']);
  checkEnum(errors, body.action, 'Review action', REVIEW_ACTIONS);

  if (body.notes !== undefined && body.notes !== null && body.notes !== '') {
    checkString(errors, body.notes, 'Review notes', { min: 3, max: 2000 });
  }

  if (errors.length) return fail(next, errors);

  return next();
}

function validateAlertBody(request, _response, next) {
  const errors = [];
  const body = request.body || {};

  rejectUnknownFields(errors, body, [
    'title',
    'severity',
    'warningDescription',
    'recommendedActions',
    'validFrom',
    'expiresAt',
    'zoneIds',
    'wardIds',
    'provinceIds',
    'districtIds',
    'localLevelIds'
  ]);

  const title = checkString(errors, body.title, 'Alert title', { min: 5, max: 180 });
  checkEnum(errors, body.severity, 'Alert severity', ALERT_SEVERITIES);
  const warningDescription = checkString(errors, body.warningDescription, 'Warning description', { min: 10, max: 4000 });
  const recommendedActions = checkString(errors, body.recommendedActions, 'Recommended actions', { min: 10, max: 4000 });
  const validFrom = checkDate(errors, body.validFrom, 'Valid from');
  const expiresAt = checkDate(errors, body.expiresAt, 'Expires at');

  /*
   * Targets may be given coarsely or precisely. A province, district or
   * municipality is expanded into its wards by the service before the alert is
   * stored, so an officer warning a whole district does not have to name its
   * wards one at a time. The limits below count selections, not the wards they
   * resolve to: a single province is one selection and several hundred wards.
   */
  const zoneIds = body.zoneIds || [];
  const wardIds = body.wardIds || [];
  const provinceIds = body.provinceIds || [];
  const districtIds = body.districtIds || [];
  const localLevelIds = body.localLevelIds || [];

  const areaLists = [
    [zoneIds, 'Affected risk area', 50, 'operational risk areas'],
    [wardIds, 'Affected ward', 200, 'administrative wards'],
    [provinceIds, 'Affected province', 7, 'provinces'],
    [districtIds, 'Affected district', 77, 'districts'],
    [localLevelIds, 'Affected municipality', 100, 'municipalities']
  ];

  const allArrays = areaLists.every(([list]) => Array.isArray(list));
  const totalSelections = allArrays
    ? areaLists.reduce((sum, [list]) => sum + list.length, 0)
    : 0;

  if (!allArrays) {
    errors.push('Alert targets must be provided as lists');
  } else if (totalSelections === 0) {
    errors.push('At least one affected area is required');
  } else {
    for (const [list, label, max, noun] of areaLists) {
      if (list.length > max) errors.push(`An alert cannot target more than ${max} ${noun}`);
      list.forEach((id) => checkUuid(errors, id, label));
    }
  }

  if (errors.length) return fail(next, errors);

  request.alertInput = {
    title,
    severity: body.severity,
    warningDescription,
    recommendedActions,
    validFrom,
    expiresAt,
    zoneIds: [...new Set(zoneIds)],
    wardIds: [...new Set(wardIds)],
    provinceIds: [...new Set(provinceIds)],
    districtIds: [...new Set(districtIds)],
    localLevelIds: [...new Set(localLevelIds)]
  };

  return next();
}

function validateAlertListQuery(request, _response, next) {
  const errors = [];
  const { limit, offset } = parsePagination(request.query, errors);

  if (request.query.status && !ALERT_STATUSES.has(request.query.status)) {
    errors.push('The alert status filter is invalid');
  }

  if (request.query.zoneId && !isUuid(request.query.zoneId)) {
    errors.push('The zone filter must be a valid identifier');
  }

  for (const [field, label] of [
    ['provinceId', 'province'],
    ['districtId', 'district'],
    ['localLevelId', 'local-level'],
    ['wardId', 'ward']
  ]) {
    if (request.query[field] && !isUuid(request.query[field])) errors.push(`The ${label} filter must be a valid identifier`);
  }

  if (errors.length) return fail(next, errors);

  request.alertQuery = {
    status: request.query.status || undefined,
    zoneId: request.query.zoneId || undefined,
    provinceId: request.query.provinceId || undefined,
    districtId: request.query.districtId || undefined,
    localLevelId: request.query.localLevelId || undefined,
    wardId: request.query.wardId || undefined,
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
  validateReportQueueQuery,
  validateReviewDecision,
  validateAlertBody,
  validateAlertListQuery,
  validateResourceId
};
