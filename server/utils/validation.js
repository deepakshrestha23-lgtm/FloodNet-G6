const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Validates a trimmed string field and pushes a readable message when invalid.
 * Returns the trimmed value so callers can reuse it without trimming twice.
 */
function checkString(errors, value, label, { min = 1, max = 255, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) errors.push(`${label} is required`);
    return null;
  }

  if (typeof value !== 'string') {
    errors.push(`${label} must be text`);
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length < min || trimmed.length > max) {
    errors.push(`${label} must be between ${min} and ${max} characters`);
    return null;
  }

  return trimmed;
}

function checkEnum(errors, value, label, allowed) {
  if (!allowed.has(value)) {
    errors.push(`${label} must be one of: ${[...allowed].join(', ')}`);
    return null;
  }

  return value;
}

function checkInteger(errors, value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    errors.push(`${label} must be a whole number between ${min} and ${max}`);
    return null;
  }

  return parsed;
}

function checkUuid(errors, value, label) {
  if (!isUuid(value)) {
    errors.push(`${label} must be a valid identifier`);
    return null;
  }

  return value;
}

function checkDate(errors, value, label, { allowFuture = true } = {}) {
  const parsed = typeof value === 'string' ? new Date(value) : null;

  if (!parsed || Number.isNaN(parsed.getTime())) {
    errors.push(`${label} must be a valid date and time`);
    return null;
  }

  if (!allowFuture && parsed.getTime() > Date.now()) {
    errors.push(`${label} cannot be in the future`);
    return null;
  }

  return parsed;
}

function rejectUnknownFields(errors, body, allowedFields) {
  const unknown = Object.keys(body).filter((field) => !allowedFields.includes(field));

  if (unknown.length) {
    errors.push(`Unknown fields: ${unknown.join(', ')}`);
  }
}

module.exports = {
  UUID_PATTERN,
  isUuid,
  checkString,
  checkEnum,
  checkInteger,
  checkUuid,
  checkDate,
  rejectUnknownFields
};
