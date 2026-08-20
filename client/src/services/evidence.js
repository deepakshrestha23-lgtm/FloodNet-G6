import { apiRequest } from './api';

export const MAX_EVIDENCE_FILES = 5;
export const MAX_EVIDENCE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_EVIDENCE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const evidenceApiBaseUrl = (import.meta.env.VITE_EVIDENCE_API_URL || '').replace(/\/$/, '');
const task2EvidenceEnabled = import.meta.env.VITE_TASK2_EVIDENCE_ENABLED === 'true';
const task1EvidenceEnabled = import.meta.env.VITE_EVIDENCE_ENABLED !== 'false';

export function getEvidenceMode() {
  if (task2EvidenceEnabled && evidenceApiBaseUrl) return 'task2';
  if (task1EvidenceEnabled) return 'task1';
  return 'disabled';
}

export function isEvidenceServiceConfigured() {
  return getEvidenceMode() !== 'disabled';
}

function getFileValidationError(file) {
  if (!ALLOWED_EVIDENCE_TYPES.has(file.type)) {
    return `${file.name}: only JPEG, PNG and WebP images are allowed.`;
  }
  if (file.size < 1 || file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    return `${file.name}: each image must be smaller than 5 MB.`;
  }
  return null;
}

export function validateEvidenceFiles(files) {
  if (files.length > MAX_EVIDENCE_FILES) {
    return `You can attach at most ${MAX_EVIDENCE_FILES} images.`;
  }

  for (const file of files) {
    const error = getFileValidationError(file);
    if (error) return error;
  }

  return '';
}

async function requestUploadUrl(reportId, file, uploadToken) {
  if (!isEvidenceServiceConfigured()) {
    throw new Error('Evidence uploads are not enabled for this environment.');
  }

  const response = await fetch(`${evidenceApiBaseUrl}/evidence/upload-url`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${uploadToken}`
    },
    body: JSON.stringify({
      reportId,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size
    })
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'The evidence upload URL could not be generated.');
  }

  return payload.data;
}

async function uploadViaExpress(reportId, files, onProgress) {
  const formData = new FormData();
  files.forEach((file) => formData.append('evidence', file, file.name));
  onProgress(0, files.length);

  const payload = await apiRequest(`/api/reports/${reportId}/evidence`, {
    method: 'POST',
    body: formData
  });

  onProgress(files.length, files.length);
  return payload.data.evidence;
}

export async function uploadEvidenceFiles(reportId, files, onProgress = () => {}) {
  const validationError = validateEvidenceFiles(files);
  if (validationError) throw new Error(validationError);

  if (getEvidenceMode() === 'task1') {
    return uploadViaExpress(reportId, files, onProgress);
  }

  const sessionPayload = await apiRequest(`/api/reports/${reportId}/evidence/session`, {
    method: 'POST'
  });
  const uploadToken = sessionPayload.data.uploadToken;

  const uploaded = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const uploadDetails = await requestUploadUrl(reportId, file, uploadToken);
    const uploadResponse = await fetch(uploadDetails.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error(`${file.name}: the direct S3 upload failed.`);
    }

    const completePayload = await apiRequest(`/api/reports/${reportId}/evidence/complete`, {
      method: 'POST',
      body: {
        objectKey: uploadDetails.objectKey,
        originalFilename: file.name,
        contentType: file.type,
        sizeBytes: file.size
      }
    });

    uploaded.push(completePayload.data.evidence);
    onProgress(index + 1, files.length);
  }

  return uploaded;
}

export async function getEvidenceAccessUrl(reportId, evidenceId) {
  const payload = await apiRequest(`/api/reports/${reportId}/evidence/${evidenceId}/url`);
  return payload.data;
}
