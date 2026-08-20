const { AppError } = require('../utils/http-error');
const {
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  ALLOWED_EVIDENCE_TYPES
} = require('../config/evidence');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const objectKeyPattern = /^reports\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

function validateEvidenceComplete(request, _response, next) {
  const body = request.body || {};
  const errors = [];

  if (!objectKeyPattern.test(body.objectKey || '')) errors.push('Evidence object key is invalid');
  if (typeof body.originalFilename !== 'string' || body.originalFilename.trim().length < 1 || body.originalFilename.length > 255 || /[\\/]/.test(body.originalFilename)) {
    errors.push('Original filename is invalid');
  }
  if (!ALLOWED_EVIDENCE_TYPES.has(body.contentType)) errors.push('Evidence file type is not allowed');
  if (!Number.isInteger(body.sizeBytes) || body.sizeBytes < 1 || body.sizeBytes > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    errors.push('Evidence file size is invalid');
  }
  if (body.checksum !== undefined && body.checksum !== null && (typeof body.checksum !== 'string' || body.checksum.length > 255)) {
    errors.push('Evidence checksum is invalid');
  }

  if (errors.length) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Evidence metadata is invalid', errors));
  }

  return next();
}

function validateEvidenceReportId(request, _response, next) {
  if (!uuidPattern.test(request.params.id || '')) {
    return next(new AppError(400, 'INVALID_REPORT_ID', 'The report ID must be a valid UUID'));
  }

  return next();
}

function validateEvidenceId(request, _response, next) {
  if (!uuidPattern.test(request.params.evidenceId || '')) {
    return next(new AppError(400, 'INVALID_EVIDENCE_ID', 'The evidence ID must be a valid UUID'));
  }

  return next();
}

module.exports = { validateEvidenceComplete, validateEvidenceReportId, validateEvidenceId };
