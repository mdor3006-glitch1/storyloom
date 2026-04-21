'use strict';

const rateLimit = require('express-rate-limit');

// 200 requests per minute per user (keyed by IP)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// Dev-loose auth limit: 100 attempts per 1 second (effectively unlimited)
const authLimiter = rateLimit({
  windowMs: 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later.' },
});

module.exports = { apiLimiter, authLimiter };
