const { AppError } = require('../utils/http-error');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const severities = new Set(['LOW', 'MODERATE', 'HIGH', 'SEVERE', 'UNKNOWN']);
const roadConditions = new Set(['CLEAR', 'RESTRICTED', 'BLOCKED', 'UNKNOWN']);

function validateReportFields(body, { allowZone }) {
  const errors = [];
  const allowedFields = allowZone
    ? ['zoneId', 'locationDescription', 'observedSeverity', 'roadCondition', 'incidentDescription', 'observedAt']
    : ['locationDescription', 'observedSeverity', 'roadCondition', 'incidentDescription', 'observedAt'];
  const unknownFields = Object.keys(body).filter((field) => !allowedFields.includes(field));

  if (unknownFields.length) errors.push(`Unknown fields: ${unknownFields.join(', ')}`);
  if (allowZone && (!uuidPattern.test(body.zoneId || ''))) errors.push('A valid zone ID is required');
  if (typeof body.locationDescription !== 'string' || body.locationDescription.trim().length < 3 || body.locationDescription.trim().length > 500) {
    errors.push('Location description must be between 3 and 500 characters');
  }
  if (!severities.has(body.observedSeverity)) errors.push('Observed severity is invalid');
  if (!roadConditions.has(body.roadCondition)) errors.push('Road condition is invalid');
  if (typeof body.incidentDescription !== 'string' || body.incidentDescription.trim().length < 3 || body.incidentDescription.trim().length > 2000) {
    errors.push('Incident description must be between 3 and 2000 characters');
  }

  const observedAt = typeof body.observedAt === 'string' ? new Date(body.observedAt) : null;
  if (!observedAt || Number.isNaN(observedAt.getTime())) {
    errors.push('A valid observation date and time is required');
  } else if (observedAt.getTime() > Date.now()) {
    errors.push('Observation time cannot be in the future');
  }

  return errors;
}

function validateCreateReport(request, _response, next) {
  const errors = validateReportFields(request.body || {}, { allowZone: true });

  if (errors.length) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Flood report data is invalid', errors));
  }

  return next();
}

function validateUpdateReport(request, _response, next) {
  const errors = validateReportFields(request.body || {}, { allowZone: false });

  if (errors.length) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Flood report data is invalid', errors));
  }

  return next();
}

function validateReportListQuery(request, _response, next) {
  const limit = Number(request.query.limit || 20);
  const offset = Number(request.query.offset || 0);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Pagination values are invalid'));
  }

  request.reportQuery = {
    status: request.query.status || undefined,
    limit,
    offset
  };

  return next();
}

function validateReportId(request, _response, next) {
  if (!uuidPattern.test(request.params.id || '')) {
    return next(new AppError(400, 'INVALID_REPORT_ID', 'The report ID must be a valid UUID'));
  }

  return next();
}

module.exports = {
  validateCreateReport,
  validateUpdateReport,
  validateReportListQuery,
  validateReportId
};
