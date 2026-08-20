const crypto = require('crypto');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_URL_EXPIRY_SECONDS = 900;
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1'
});

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'Content-Type,Authorization'
    },
    body: JSON.stringify(body)
  };
}

function getAuthContext(event) {
  const authorizer = event.requestContext?.authorizer || {};
  return {
    userId: authorizer.lambda?.userId
      || authorizer.userId
      || authorizer.principalId
      || authorizer.jwt?.claims?.sub
      || null,
    reportId: authorizer.lambda?.reportId
      || authorizer.reportId
      || authorizer.jwt?.claims?.rid
      || null,
    scope: authorizer.lambda?.scope
      || authorizer.scope
      || authorizer.jwt?.claims?.scope
      || null
  };
}

function parseBody(event) {
  if (!event.body) return {};
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return JSON.parse(rawBody);
}

function validateBody(body) {
  const errors = [];
  const allowedFields = ['reportId', 'fileName', 'contentType', 'sizeBytes'];
  const unknownFields = Object.keys(body).filter((field) => !allowedFields.includes(field));

  if (unknownFields.length) errors.push(`Unknown fields: ${unknownFields.join(', ')}`);
  if (!uuidPattern.test(body.reportId || '')) errors.push('reportId must be a valid UUID');
  if (typeof body.fileName !== 'string' || body.fileName.trim().length < 1 || body.fileName.length > 255 || /[\\/]/.test(body.fileName)) {
    errors.push('fileName is invalid');
  }
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, body.contentType)) errors.push('contentType is not allowed');
  if (!Number.isInteger(body.sizeBytes) || body.sizeBytes < 1 || body.sizeBytes > MAX_FILE_SIZE_BYTES) {
    errors.push('sizeBytes is invalid');
  }

  return errors;
}

async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const rawPath = event.rawPath || event.path || '';

  if (method === 'OPTIONS') {
    return response(204, {});
  }

  if (method !== 'POST' || !rawPath.endsWith('/upload-url')) {
    return response(404, {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Evidence endpoint not found' }
    });
  }

  const authContext = getAuthContext(event);
  if (!authContext.userId || !uuidPattern.test(authContext.userId)) {
    return response(401, {
      success: false,
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'A verified user context is required' }
    });
  }

  let body;
  try {
    body = parseBody(event);
  } catch (_error) {
    return response(400, {
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' }
    });
  }

  const errors = validateBody(body);
  if (errors.length) {
    return response(400, {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Evidence upload request is invalid', details: errors }
    });
  }

  if (
    authContext.scope !== 'evidence:upload' ||
    authContext.reportId !== body.reportId
  ) {
    return response(403, {
      success: false,
      error: { code: 'EVIDENCE_SCOPE_FORBIDDEN', message: 'The upload session is not valid for this report' }
    });
  }

  const bucketName = process.env.EVIDENCE_BUCKET_NAME;
  if (!bucketName) {
    return response(503, {
      success: false,
      error: { code: 'EVIDENCE_SERVICE_NOT_CONFIGURED', message: 'Evidence storage is not configured' }
    });
  }

  const extension = ALLOWED_TYPES[body.contentType];
  const objectKey = `reports/${authContext.userId}/${body.reportId}/${crypto.randomUUID()}.${extension}`;
  const expiresIn = Math.min(
    Math.max(Number(process.env.EVIDENCE_URL_EXPIRES_SECONDS || 300), 60),
    MAX_URL_EXPIRY_SECONDS
  );

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ContentType: body.contentType
  });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });

  return response(200, {
    success: true,
    data: {
      uploadUrl,
      objectKey,
      contentType: body.contentType,
      expiresIn,
      maxFileSizeBytes: MAX_FILE_SIZE_BYTES
    },
    message: 'Evidence upload URL generated'
  });
}

module.exports = { handler, validateBody };
