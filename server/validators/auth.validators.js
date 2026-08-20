const { AppError } = require('../utils/http-error');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rejectUnknownFields(body, allowedFields) {
  return Object.keys(body).filter((field) => !allowedFields.includes(field));
}

function validateRegister(request, _response, next) {
  const body = request.body || {};
  const errors = [];
  const unknownFields = rejectUnknownFields(body, [
    'email', 'password', 'firstName', 'lastName', 'phone', 'homeZoneId'
  ]);

  if (unknownFields.length) errors.push(`Unknown fields: ${unknownFields.join(', ')}`);
  if (typeof body.email !== 'string' || !emailPattern.test(body.email.trim())) {
    errors.push('A valid email address is required');
  }
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 72) {
    errors.push('Password must be between 8 and 72 characters');
  } else if (!/[A-Z]/.test(body.password) || !/[a-z]/.test(body.password) || !/[0-9]/.test(body.password)) {
    errors.push('Password must contain uppercase, lowercase and numeric characters');
  }
  if (typeof body.firstName !== 'string' || body.firstName.trim().length < 1 || body.firstName.trim().length > 100) {
    errors.push('First name is required and must be at most 100 characters');
  }
  if (typeof body.lastName !== 'string' || body.lastName.trim().length < 1 || body.lastName.trim().length > 100) {
    errors.push('Last name is required and must be at most 100 characters');
  }
  if (body.phone !== undefined && body.phone !== null && (typeof body.phone !== 'string' || body.phone.length > 40)) {
    errors.push('Phone number must be at most 40 characters');
  }
  if (body.homeZoneId !== undefined && body.homeZoneId !== null && !uuidPattern.test(body.homeZoneId)) {
    errors.push('Home zone ID must be a valid UUID');
  }

  if (errors.length) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Registration data is invalid', errors));
  }

  return next();
}

function validateLogin(request, _response, next) {
  const body = request.body || {};
  const errors = [];

  if (typeof body.email !== 'string' || !emailPattern.test(body.email.trim())) {
    errors.push('A valid email address is required');
  }
  if (typeof body.password !== 'string' || body.password.length === 0) {
    errors.push('Password is required');
  }

  if (errors.length) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Login data is invalid', errors));
  }

  return next();
}

function validateProfileUpdate(request, _response, next) {
  const body = request.body || {};
  const errors = [];
  const unknownFields = rejectUnknownFields(body, [
    'firstName', 'lastName', 'phone', 'homeZoneId'
  ]);

  if (unknownFields.length) errors.push(`Unknown fields: ${unknownFields.join(', ')}`);
  if (typeof body.firstName !== 'string' || body.firstName.trim().length < 1 || body.firstName.trim().length > 100) {
    errors.push('First name is required and must be at most 100 characters');
  }
  if (typeof body.lastName !== 'string' || body.lastName.trim().length < 1 || body.lastName.trim().length > 100) {
    errors.push('Last name is required and must be at most 100 characters');
  }
  if (body.phone !== undefined && body.phone !== null && (typeof body.phone !== 'string' || body.phone.length > 40)) {
    errors.push('Phone number must be at most 40 characters');
  }
  if (body.homeZoneId !== undefined && body.homeZoneId !== null && !uuidPattern.test(body.homeZoneId)) {
    errors.push('Home zone ID must be a valid UUID');
  }

  if (errors.length) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Profile data is invalid', errors));
  }

  return next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileUpdate
};
