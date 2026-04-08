'use strict';

const logger = require('../config/logger');

// Optional Sentry integration — enabled when SENTRY_DSN is set (Task 6.9)
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.1,
    });
    logger.info('[sentry] Error monitoring active');
  } catch {
    logger.warn('[sentry] @sentry/node not installed — run: npm install @sentry/node');
  }
}

/**
 * Global error handler — must be registered last in Express.
 * Catches any error passed to next(err).
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? 'Internal server error';

  if (status >= 500) {
    logger.error('[error] Unhandled server error', {
      method: req.method,
      path: req.path,
      status,
      message,
      stack: err.stack,
    });
    if (Sentry) Sentry.captureException(err);
  } else {
    logger.warn('[error] Client error', {
      method: req.method,
      path: req.path,
      status,
      message,
    });
  }

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
