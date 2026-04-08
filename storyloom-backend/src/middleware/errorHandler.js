'use strict';

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
    console.log('[sentry] Error monitoring active');
  } catch {
    console.warn('[sentry] @sentry/node not installed — run: npm install @sentry/node');
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
    console.error(`[error] ${req.method} ${req.path}`, err);
    if (Sentry) Sentry.captureException(err);
  }

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
