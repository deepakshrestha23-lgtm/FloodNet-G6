const crypto = require('crypto');
const { AppError } = require('../utils/http-error');
const env = require('../config/env');
const { createEvidenceUploadToken, EVIDENCE_UPLOAD_TOKEN_MAX_AGE_SECONDS } = require('../utils/jwt');
const {
  MAX_EVIDENCE_FILES,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  ALLOWED_EVIDENCE_TYPES,
  CONTENT_TYPE_EXTENSIONS,
  hasValidImageSignature
} = require('../config/evidence');
const reportRepository = require('../repositories/report.repository');
const evidenceRepository = require('../repositories/evidence.repository');
const {
  putEvidenceObject,
  deleteEvidenceObjects,
  createEvidenceDownloadUrl,
  verifyUploadedObject
} = require('./evidence-storage.service');

async function assertReportCanReceiveEvidence(reportId, residentId) {
  const report = await reportRepository.findReportForResident(reportId, residentId);

  if (!report) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'The requested report was not found');
  }

  if (!['PENDING_REVIEW', 'MORE_INFORMATION_REQUIRED'].includes(report.status)) {
    throw new AppError(409, 'REPORT_EVIDENCE_LOCKED', 'Evidence can only be added while the report is awaiting review');
  }

  return report;
}

async function completeUpload(residentId, reportId, input) {
  await assertReportCanReceiveEvidence(reportId, residentId);

  const currentCount = await evidenceRepository.countEvidenceForReport(reportId);
  if (currentCount >= MAX_EVIDENCE_FILES) {
    throw new AppError(409, 'EVIDENCE_LIMIT_REACHED', `A report can contain at most ${MAX_EVIDENCE_FILES} evidence files`);
  }

  if (!ALLOWED_EVIDENCE_TYPES.has(input.contentType) || input.sizeBytes > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    throw new AppError(400, 'INVALID_EVIDENCE', 'The evidence file does not meet the upload rules');
  }

  const expectedPrefix = `reports/${residentId}/${reportId}/`;
  if (!input.objectKey.startsWith(expectedPrefix)) {
    throw new AppError(403, 'EVIDENCE_KEY_FORBIDDEN', 'The evidence object does not belong to this report');
  }

  const expectedExtension = CONTENT_TYPE_EXTENSIONS[input.contentType];
  if (!input.objectKey.endsWith(`.${expectedExtension}`)) {
    throw new AppError(400, 'EVIDENCE_EXTENSION_MISMATCH', 'The evidence object extension does not match its content type');
  }

  const uploadedObject = await verifyUploadedObject(input.objectKey);
  if (uploadedObject) {
    if (uploadedObject.contentLength !== input.sizeBytes) {
      throw new AppError(400, 'EVIDENCE_SIZE_MISMATCH', 'Uploaded evidence size does not match the submitted metadata');
    }

    if (uploadedObject.contentType && uploadedObject.contentType !== input.contentType) {
      throw new AppError(400, 'EVIDENCE_TYPE_MISMATCH', 'Uploaded evidence type does not match the submitted metadata');
    }
  }

  const evidence = await evidenceRepository.createEvidenceMetadata({
    reportId,
    uploadedBy: residentId,
    ...input
  });

  return evidence;
}

function validateOriginalFilename(filename) {
  return typeof filename === 'string'
    && filename.trim().length >= 1
    && filename.length <= 255
    && !/[\\/\r\n\0]/.test(filename);
}

function validateMultipartFile(file) {
  if (!ALLOWED_EVIDENCE_TYPES.has(file.mimetype)) {
    throw new AppError(400, 'INVALID_EVIDENCE_TYPE', 'Only JPEG, PNG and WebP images are allowed');
  }

  if (!Number.isInteger(file.size) || file.size < 1 || file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    throw new AppError(400, 'INVALID_EVIDENCE_SIZE', `Each evidence image must be smaller than ${MAX_EVIDENCE_FILE_SIZE_BYTES / (1024 * 1024)} MB`);
  }

  if (!validateOriginalFilename(file.originalname)) {
    throw new AppError(400, 'INVALID_EVIDENCE_FILENAME', 'An evidence filename is invalid');
  }

  if (!hasValidImageSignature(file.buffer, file.mimetype)) {
    throw new AppError(400, 'INVALID_EVIDENCE_CONTENT', 'The evidence file content does not match its image type');
  }
}

async function uploadMultipartFiles(residentId, reportId, files) {
  await assertReportCanReceiveEvidence(reportId, residentId);

  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError(400, 'EVIDENCE_FILES_REQUIRED', 'Select at least one evidence image to upload');
  }

  const currentCount = await evidenceRepository.countEvidenceForReport(reportId);
  if (currentCount + files.length > MAX_EVIDENCE_FILES) {
    throw new AppError(409, 'EVIDENCE_LIMIT_REACHED', `A report can contain at most ${MAX_EVIDENCE_FILES} evidence files`);
  }

  files.forEach(validateMultipartFile);

  const uploadedObjects = [];
  try {
    for (const file of files) {
      const contentType = file.mimetype;
      const extension = CONTENT_TYPE_EXTENSIONS[contentType];
      const objectKey = `reports/${residentId}/${reportId}/${crypto.randomUUID()}.${extension}`;
      const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

      await putEvidenceObject({
        objectKey,
        body: file.buffer,
        contentType
      });

      uploadedObjects.push({
        objectKey,
        originalFilename: file.originalname.trim(),
        contentType,
        sizeBytes: file.size,
        checksum
      });
    }

    return evidenceRepository.createEvidenceMetadataBatch({
      reportId,
      uploadedBy: residentId,
      evidence: uploadedObjects
    });
  } catch (error) {
    await deleteEvidenceObjects(uploadedObjects.map((item) => item.objectKey));
    throw error;
  }
}

async function createUploadSession(residentId, reportId) {
  await assertReportCanReceiveEvidence(reportId, residentId);

  const currentCount = await evidenceRepository.countEvidenceForReport(reportId);
  if (currentCount >= MAX_EVIDENCE_FILES) {
    throw new AppError(409, 'EVIDENCE_LIMIT_REACHED', `A report can contain at most ${MAX_EVIDENCE_FILES} evidence files`);
  }

  if (!env.evidenceUploadSecret) {
    throw new AppError(503, 'EVIDENCE_SERVICE_NOT_CONFIGURED', 'Evidence upload authorization is not configured');
  }

  return {
    uploadToken: createEvidenceUploadToken(residentId, reportId),
    expiresIn: EVIDENCE_UPLOAD_TOKEN_MAX_AGE_SECONDS
  };
}

async function listForResident(residentId, reportId) {
  const report = await reportRepository.findReportForResident(reportId, residentId);
  if (!report) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'The requested report was not found');
  }

  return evidenceRepository.listEvidenceForReport(reportId, residentId);
}

async function getDownloadUrl(residentId, reportId, evidenceId) {
  const report = await reportRepository.findReportForResident(reportId, residentId);
  if (!report) {
    throw new AppError(404, 'REPORT_NOT_FOUND', 'The requested report was not found');
  }

  const evidence = await evidenceRepository.findEvidenceForResident(evidenceId, reportId, residentId);
  if (!evidence) {
    throw new AppError(404, 'EVIDENCE_NOT_FOUND', 'The requested evidence file was not found');
  }

  const downloadUrl = await createEvidenceDownloadUrl({
    objectKey: evidence.objectKey,
    contentType: evidence.contentType,
    originalFilename: evidence.originalFilename
  });

  return {
    downloadUrl,
    expiresIn: env.evidenceUrlExpiresSeconds,
    evidence
  };
}

/**
 * Evidence access for a reviewing Flood Monitoring Officer. Officers review
 * reports from every resident, so this is not ownership-scoped; the officer-only
 * route is what authorizes it. The image itself is never proxied through the
 * API: the caller receives a short-lived presigned URL to the private bucket.
 */
async function getDownloadUrlForOfficer(reportId, evidenceId) {
  const evidence = await evidenceRepository.findEvidenceForReport(evidenceId, reportId);

  if (!evidence) {
    throw new AppError(404, 'EVIDENCE_NOT_FOUND', 'The requested evidence file was not found');
  }

  const downloadUrl = await createEvidenceDownloadUrl({
    objectKey: evidence.objectKey,
    contentType: evidence.contentType,
    originalFilename: evidence.originalFilename
  });

  return {
    downloadUrl,
    expiresIn: env.evidenceUrlExpiresSeconds,
    evidence
  };
}

module.exports = {
  createUploadSession,
  completeUpload,
  uploadMultipartFiles,
  listForResident,
  getDownloadUrl,
  getDownloadUrlForOfficer
};
