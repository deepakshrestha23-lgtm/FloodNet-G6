const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const env = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const reportRoutes = require('./routes/report.routes');
const publicRoutes = require('./routes/public.routes');
const evidenceRoutes = require('./routes/evidence.routes');
const officerRoutes = require('./routes/officer.routes');
const centreRoutes = require('./routes/centre.routes');
const adminRoutes = require('./routes/admin.routes');
const geographyRoutes = require('./routes/geography.routes');
const { AppError } = require('./utils/http-error');

const app = express();

// Elastic Beanstalk terminates TLS at a load balancer, so the client IP used by
// rate limiting and audit logging comes from the first proxy hop.
app.set('trust proxy', 1);

/*
 * Evidence photographs are held in a private S3 bucket and delivered to the
 * browser through short-lived presigned URLs, which are a different origin from
 * the application. Helmet's default policy is `img-src 'self' data:`, so the
 * bucket origin has to be allowed explicitly or every evidence image is blocked
 * by the browser even though the API returned a valid URL. Only the configured
 * bucket is allowed, and only when one is configured.
 */
const evidenceOrigins = env.evidenceBucketName
  ? [
      `https://${env.evidenceBucketName}.s3.${env.awsRegion}.amazonaws.com`,
      `https://${env.evidenceBucketName}.s3.amazonaws.com`
    ]
  : [];

// The current Elastic Beanstalk staging endpoint is HTTP-only. Helmet's
// default CSP includes `upgrade-insecure-requests`, which would make a
// browser request the React assets over HTTPS and leave the page blank when
// HTTPS is not configured yet. Keep HTTPS enforcement and HSTS aligned with
// the configured public origin so the policy becomes strict automatically
// when the application is later placed behind an HTTPS endpoint.
const publicOriginUsesHttps = env.clientOrigin.startsWith('https://');

app.use(helmet({
  strictTransportSecurity: publicOriginUsesHttps,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', ...evidenceOrigins],
      // connect-src covers the Task 2 browser-to-S3 presigned upload without
      // changing the Task 1 upload path, which still goes through Express.
      'connect-src': ["'self'", ...evidenceOrigins],
      'upgrade-insecure-requests': publicOriginUsesHttps ? [] : null
    }
  }
}));
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/geography', geographyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reports', evidenceRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/centres', centreRoutes);
app.use('/api/admin', adminRoutes);

const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');

if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api')) {
      return next();
    }

    return response.sendFile(clientIndexPath);
  });
}

app.use((_request, response) => {
  response.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found'
    }
  });
});

app.use((error, request, response, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const code = error instanceof AppError ? error.code : 'INTERNAL_SERVER_ERROR';
  const message = error instanceof AppError
    ? error.message
    : 'An unexpected server error occurred';

  const logPayload = {
    code,
    message,
    method: request.method,
    path: request.path
  };

  if (statusCode >= 500) {
    console.error('[UnhandledError]', {
      ...logPayload,
      stack: env.nodeEnv === 'development' ? error.stack : undefined
    });
  } else {
    console.warn('[ClientError]', logPayload);
  }

  response.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(error instanceof AppError && error.details ? { details: error.details } : {})
    }
  });
});

module.exports = app;
