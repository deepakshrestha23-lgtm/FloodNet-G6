const { AppError } = require('../utils/http-error');
const { isUuid } = require('../utils/validation');

const GEOGRAPHY_FILTER_FIELDS = ['provinceId', 'districtId', 'localLevelId', 'wardId'];

function validateGeographyQuery(request, _response, next) {
  const errors = [];

  for (const field of GEOGRAPHY_FILTER_FIELDS) {
    if (request.query[field] && !isUuid(request.query[field])) {
      errors.push(`The ${field} filter must be a valid identifier`);
    }
  }

  if (errors.length) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'The geographic filters are invalid', errors));
  }

  request.geographyQuery = Object.fromEntries(
    GEOGRAPHY_FILTER_FIELDS.map((field) => [field, request.query[field] || undefined])
  );
  return next();
}

module.exports = { validateGeographyQuery };
