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
    'zoneIds'
  ]);

  const title = checkString(errors, body.title, 'Alert title', { min: 5, max: 180 });
  checkEnum(errors, body.severity, 'Alert severity', ALERT_SEVERITIES);
  const warningDescription = checkString(errors, body.warningDescription, 'Warning description', { min: 10, max: 4000 });
  const recommendedActions = checkString(errors, body.recommendedActions, 'Recommended actions', { min: 10, max: 4000 });
  const validFrom = checkDate(errors, body.validFrom, 'Valid from');
  const expiresAt = checkDate(errors, body.expiresAt, 'Expires at');

  if (!Array.isArray(body.zoneIds) || body.zoneIds.length === 0) {
    errors.push('At least one affected flood zone is required');
  } else if (body.zoneIds.length > 50) {
    errors.push('An alert cannot target more than 50 zones');
  } else {
    body.zoneIds.forEach((zoneId) => checkUuid(errors, zoneId, 'Affected zone'));
  }

  if (errors.length) return fail(next, errors);

  request.alertInput = {
    title,
    severity: body.severity,
    warningDescription,
    recommendedActions,
    validFrom,
    expiresAt,
    zoneIds: [...new Set(body.zoneIds)]
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

  if (errors.length) return fail(next, errors);

  request.alertQuery = {
    status: request.query.status || undefined,
    zoneId: request.query.zoneId || undefined,
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
