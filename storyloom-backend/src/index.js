'use strict';

const os = require('os');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const logger = require('./config/logger');
const { apiLimiter } = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const storiesRoutes = require('./routes/stories');
const charactersRoutes = require('./routes/characters');
const creditsRoutes = require('./routes/credits');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const subscriptionsRoutes = require('./routes/subscriptions');

const app = express();

// ---- Security ------------------------------------------------
app.use(helmet());
app.use(cors({
  origin: true,          // tighten to specific origins in production
  credentials: true,
}));

// ---- HTTP request logging (pipe morgan into winston) ----------
const morganFormat = env.nodeEnv === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ---- Body parsing -----------------------------------------
// Note: /credits/webhook uses express.raw() inside the route — must come BEFORE this
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ---- Rate limiting (global) -------------------------------
app.use(apiLimiter);

// ---- Health check -----------------------------------------
app.get('/health', (_req, res) => {
  logger.debug('[server] Health check hit');
  res.json({ status: 'ok', env: env.nodeEnv });
});

// ---- Routes -----------------------------------------------
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/stories', storiesRoutes);
app.use('/characters', charactersRoutes);
app.use('/credits', creditsRoutes);
app.use('/reports', reportsRoutes);
app.use('/admin', adminRoutes);
app.use('/subscriptions', subscriptionsRoutes);

// ---- 404 --------------------------------------------------
app.use((req, res) => {
  logger.warn('[server] 404 Not Found', { method: req.method, path: req.path });
  res.status(404).json({ error: 'Not found' });
});

// ---- Global error handler (must be last) ------------------
app.use(errorHandler);

// ---- STAGE v2: start pregen cleanup cron ------------------
const { startCleanupCron } = require('./services/PregenerationService');
startCleanupCron();

// ---- Start ------------------------------------------------
app.listen(env.port, '0.0.0.0', () => {
  // Resolve every non-internal IPv4 address so it's easy to verify
  // which address the phone should connect to.
  const networkIPs = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${env.port}`);

  logger.info(`[server] StoryLoom API listening on 0.0.0.0:${env.port} (${env.nodeEnv})`);
  logger.info(`[server] Reachable at: ${networkIPs.join('  |  ') || '(no external interfaces found)'}`);
  logger.info(`[server] Health check: ${networkIPs[0] ?? `http://localhost:${env.port}`}/health`);
});

module.exports = app;
