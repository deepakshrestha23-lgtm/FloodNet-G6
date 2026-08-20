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
const { AppError } = require('./utils/http-error');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reports', evidenceRoutes);

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
