const { AppError } = require('../utils/http-error');
const { checkPassword } = require('../utils/validation');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function rejectUnknownFields(body, allowedFields) {
  return Object.keys(body).filter((field) => !allowedFields.includes(field));
}

function validateRegister(request, _response, next) {
  const body = request.body || {};
  const errors = [];
  const unknownFields = rejectUnknownFields(body, [
    'email', 'password', 'firstName', 'lastName', 'phone', 'homeZoneId', 'homeWardId'
  ]);

  if (unknownFields.length) errors.push(`Unknown fields: ${unknownFields.join(', ')}`);
  if (typeof body.email !== 'string' || !emailPattern.test(body.email.trim())) {
    errors.push('A valid email address is required');
  }
  checkPassword(errors, body.password);
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
  if (body.homeWardId !== undefined && body.homeWardId !== null && !uuidPattern.test(body.homeWardId)) {
    errors.push('Home ward ID must be a valid UUID');
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

/**
 * Changing a password requires the current one even though the caller is
 * already authenticated. An access token alone must not be enough to take
 * permanent ownership of an account.
 */
function validatePasswordChange(request, _response, next) {
  const body = request.body || {};
  const errors = [];
  const unknownFields = rejectUnknownFields(body, ['currentPassword', 'newPassword']);

  if (unknownFields.length) errors.push(`Unknown fields: ${unknownFields.join(', ')}`);
  if (typeof body.currentPassword !== 'string' || body.currentPassword.length === 0) {
    errors.push('Your current password is required');
  }

  checkPassword(errors, body.newPassword, 'New password');

  if (typeof body.newPassword === 'string' && body.newPassword === body.currentPassword) {
    errors.push('The new password must be different from your current password');
  }

  if (errors.length) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Password data is invalid', errors));
  }

  request.passwordChangeInput = {
    currentPassword: body.currentPassword,
    newPassword: body.newPassword
  };

  return next();
}

function validateProfileUpdate(request, _response, next) {
  const body = request.body || {};
  const errors = [];
  const unknownFields = rejectUnknownFields(body, [
    'firstName', 'lastName', 'phone', 'homeZoneId', 'homeWardId'
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
  if (body.homeWardId !== undefined && body.homeWardId !== null && !uuidPattern.test(body.homeWardId)) {
    errors.push('Home ward ID must be a valid UUID');
  }

  if (errors.length) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Profile data is invalid', errors));
  }

  return next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validatePasswordChange
};
