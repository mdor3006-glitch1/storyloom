'use strict';

const { createLogger, format, transports } = require('winston');

const { combine, timestamp, colorize, printf, json, errors } = format;

const isProd = process.env.NODE_ENV === 'production';

// ── Dev format: human-readable colored lines ──────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss.SSS' }),
  errors({ stack: true }),
  printf(({ timestamp: ts, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? ' ' + JSON.stringify(meta)
      : '';
    return `${ts} ${level}: ${message}${metaStr}${stack ? '\n' + stack : ''}`;
  })
);

// ── Prod format: structured JSON for log aggregators ──────────
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// Add 'http' level between warn and info for morgan HTTP logs
const levels = {
  error: 0,
  warn:  1,
  info:  2,
  http:  3,
  debug: 4,
};

const logger = createLogger({
  levels,
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'http'),
  format: isProd ? prodFormat : devFormat,
  transports: [
    new transports.Console(),
    ...(isProd
      ? [
          new transports.File({ filename: 'logs/error.log', level: 'error' }),
          new transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
});

module.exports = logger;
