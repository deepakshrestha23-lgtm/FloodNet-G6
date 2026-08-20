const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '30d';
const EVIDENCE_UPLOAD_TOKEN_EXPIRES_IN = '5m';
const EVIDENCE_UPLOAD_TOKEN_MAX_AGE_SECONDS = 300;
const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function requireSecret(secret, name) {
  if (!secret) {
    throw new Error(`${name} is not configured`);
  }

  return secret;
}

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.roleCode,
      type: 'access'
    },
    requireSecret(env.jwtAccessSecret, 'JWT_ACCESS_SECRET'),
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

function createRefreshToken(userId, sessionId) {
  return jwt.sign(
    {
      sub: userId,
      sid: sessionId,
      jti: crypto.randomUUID(),
      type: 'refresh'
    },
    requireSecret(env.jwtRefreshSecret, 'JWT_REFRESH_SECRET'),
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(
    token,
    requireSecret(env.jwtAccessSecret, 'JWT_ACCESS_SECRET')
  );
}

function verifyRefreshToken(token) {
  return jwt.verify(
    token,
    requireSecret(env.jwtRefreshSecret, 'JWT_REFRESH_SECRET')
  );
}

function createEvidenceUploadToken(userId, reportId) {
  return jwt.sign(
    {
      sub: userId,
      rid: reportId,
      scope: 'evidence:upload',
      type: 'evidence-upload',
      jti: crypto.randomUUID()
    },
    requireSecret(env.evidenceUploadSecret, 'EVIDENCE_UPLOAD_SECRET'),
    { expiresIn: EVIDENCE_UPLOAD_TOKEN_EXPIRES_IN }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_MAX_AGE_MS,
  EVIDENCE_UPLOAD_TOKEN_MAX_AGE_SECONDS,
  createAccessToken,
  createRefreshToken,
  createEvidenceUploadToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken
};
