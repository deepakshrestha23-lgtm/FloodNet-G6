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
  jwtRefreshSecret: requiredInProduction('JWT_REFRESH_SECRET'),
  /*
   * River and rainfall conditions from Open-Meteo.
   *
   * Defaults to 'disabled' everywhere, so the application behaves exactly as
   * it would without the integration until an operator opts in. 'mock' returns
   * deterministic values for tests and offline development; only 'live' reaches
   * the network. Open-Meteo needs no API key, so there is no credential here.
   */
  weatherMode: ['disabled', 'mock', 'live'].includes(process.env.WEATHER_MODE)
    ? process.env.WEATHER_MODE
    : 'disabled',
  // River discharge is a daily forecast, so an hour-old reading is still current.
  weatherCacheTtlSeconds: Math.min(
    Math.max(Number(process.env.WEATHER_CACHE_TTL_SECONDS || 3600), 60),
    86_400
  ),
  // Short enough that a slow upstream never holds an officer's page open.
  weatherTimeoutMs: Math.min(
    Math.max(Number(process.env.WEATHER_TIMEOUT_MS || 4000), 1000),
    15_000
  )
};
