const { AppError } = require('../utils/http-error');

function validateConditionsQuery(request, _response, next) {
  const errors = [];
  const latitude = Number(request.query.latitude);
  const longitude = Number(request.query.longitude);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.push('Latitude must be a number between -90 and 90');
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.push('Longitude must be a number between -180 and 180');
  }

  if (errors.length) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Coordinates are invalid', errors));
  }

  request.conditionsQuery = { latitude, longitude };
  return next();
}

module.exports = { validateConditionsQuery };
