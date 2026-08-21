require('dotenv').config();

function requiredInProduction(name) {
  const value = process.env[name];

  if (process.env.NODE_ENV === 'production' && !value) {
    throw new Error(`${name} must be configured in production`);
  }

  return value;
}

const evidenceStorageMode = process.env.EVIDENCE_STORAGE_MODE
  || (process.env.NODE_ENV === 'production' ? 's3' : 'disabled');

if (process.env.NODE_ENV === 'production' && evidenceStorageMode !== 's3') {
  throw new Error('EVIDENCE_STORAGE_MODE must be s3 in production');
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  awsRegion: process.env.AWS_REGION || 'ap-southeast-1',
  evidenceBucketName: requiredInProduction('EVIDENCE_BUCKET_NAME') || '',
  evidenceStorageMode,
  evidenceUrlExpiresSeconds: Math.min(
    Math.max(Number(process.env.EVIDENCE_URL_EXPIRES_SECONDS || 300), 60),
    900
  ),
  evidenceUploadSecret: process.env.EVIDENCE_UPLOAD_SECRET || '',
  database: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true'
  },
  jwtAccessSecret: requiredInProduction('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: requiredInProduction('JWT_REFRESH_SECRET')
};
