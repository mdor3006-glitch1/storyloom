'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const storiesRoutes = require('./routes/stories');
const charactersRoutes = require('./routes/characters');
const creditsRoutes = require('./routes/credits');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');

const app = express();

// ---- Security & logging -----------------------------------
app.use(helmet());
app.use(cors({
  origin: true,          // tighten to specific origins in production
  credentials: true,
}));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// ---- Body parsing -----------------------------------------
// Note: /credits/webhook uses express.raw() inside the route — must come BEFORE this
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ---- Rate limiting (global) -------------------------------
app.use(apiLimiter);

// ---- Health check -----------------------------------------
app.get('/health', (_req, res) => {
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

// ---- 404 --------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---- Global error handler (must be last) ------------------
app.use(errorHandler);

// ---- Start ------------------------------------------------
app.listen(env.port, () => {
  console.log(`[server] StoryLoom API running on port ${env.port} (${env.nodeEnv})`);
});

module.exports = app;
