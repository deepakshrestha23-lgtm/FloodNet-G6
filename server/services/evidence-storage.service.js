const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');
const { AppError } = require('../utils/http-error');

const s3Client = new S3Client({ region: env.awsRegion });

function assertStorageConfigured() {
  if (env.evidenceStorageMode !== 's3' || !env.evidenceBucketName) {
    throw new AppError(503, 'EVIDENCE_SERVICE_NOT_CONFIGURED', 'Evidence storage is not configured for this environment');
  }
}

async function putEvidenceObject({ objectKey, body, contentType }) {
  if (env.evidenceStorageMode === 'mock') {
    return {
      contentType,
      contentLength: body.length,
      etag: null
    };
  }

  assertStorageConfigured();

  try {
    const result = await s3Client.send(new PutObjectCommand({
      Bucket: env.evidenceBucketName,
      Key: objectKey,
      Body: body,
      ContentLength: body.length,
      ContentType: contentType
    }));

    return {
      contentType,
      contentLength: body.length,
      etag: result.ETag || null
    };
  } catch (_error) {
    throw new AppError(502, 'EVIDENCE_STORAGE_ERROR', 'Evidence image could not be stored');
  }
}

async function deleteEvidenceObjects(objectKeys) {
  if (env.evidenceStorageMode !== 's3' || !env.evidenceBucketName || objectKeys.length === 0) {
    return;
  }

  await Promise.allSettled(objectKeys.map((objectKey) => s3Client.send(new DeleteObjectCommand({
    Bucket: env.evidenceBucketName,
    Key: objectKey
  }))));
}

async function createEvidenceDownloadUrl({ objectKey, contentType, originalFilename }) {
  assertStorageConfigured();

  const safeFilename = originalFilename.replace(/[\r\n"]+/g, '_');
  const command = new GetObjectCommand({
    Bucket: env.evidenceBucketName,
    Key: objectKey,
    ResponseContentType: contentType,
    ResponseContentDisposition: `inline; filename="${safeFilename}"`
  });

  try {
    return await getSignedUrl(s3Client, command, { expiresIn: env.evidenceUrlExpiresSeconds });
  } catch (_error) {
    throw new AppError(502, 'EVIDENCE_STORAGE_ERROR', 'Evidence access could not be generated');
  }
}

async function verifyUploadedObject(objectKey) {
  if (env.evidenceStorageMode === 'mock') {
    return null;
  }

  assertStorageConfigured();

  try {
    const result = await s3Client.send(new HeadObjectCommand({
      Bucket: env.evidenceBucketName,
      Key: objectKey
    }));

    return {
      contentType: result.ContentType,
      contentLength: result.ContentLength
    };
  } catch (error) {
    if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
      throw new AppError(400, 'EVIDENCE_OBJECT_NOT_FOUND', 'The uploaded evidence object could not be found');
    }

    throw new AppError(502, 'EVIDENCE_STORAGE_ERROR', 'Evidence storage could not be verified');
  }
}

module.exports = {
  putEvidenceObject,
  deleteEvidenceObjects,
  createEvidenceDownloadUrl,
  verifyUploadedObject
};
