'use strict';

const { Router } = require('express');
const { authLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');

const router = Router();

// ---- POST /auth/signup ----------------------------------------
// Email + password signup. The DB trigger handles:
//   - creating the public.users row
//   - logging the 100-credit signup bonus
// Google / Apple sign-ins are handled client-side via Supabase SDK
// and don't need a backend signup endpoint.
router.post('/signup', authLimiter, async (req, res, next) => {
  try {
    const { email, password, display_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    logger.info('[POST /auth/signup] Creating new user', { email });

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name: display_name ?? email.split('@')[0],
      },
      email_confirm: true, // skip email confirmation in dev; set to false for prod
    });

    if (error) {
      if (error.message?.toLowerCase().includes('already registered')) {
        logger.warn('[POST /auth/signup] Duplicate email', { email });
        return res.status(409).json({ error: 'Email already in use' });
      }
      logger.error('[POST /auth/signup] Supabase createUser error', { email, error: error.message });
      return res.status(400).json({ error: error.message });
    }

    logger.info('[POST /auth/signup] User created in Auth', { userId: data.user.id, email });

    // The trigger may take a moment — wait for the profile to appear
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('id, email, display_name, credit_balance, language, is_admin, created_at, flags')
      .eq('id', data.user.id)
      .single();

    logger.info('[POST /auth/signup] Signup complete', { userId: data.user.id, creditBalance: userRow?.credit_balance });

    res.status(201).json({ user: userRow ?? { id: data.user.id, email } });
  } catch (err) { next(err); }
});

// ---- POST /auth/login -----------------------------------------
// Email + password login. Returns a session (access_token + refresh_token).
// Google / Apple sessions are issued client-side and only the JWT is sent to
// this backend — no separate login endpoint is needed for those providers.
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    logger.info('[POST /auth/login] Login attempt', { email });

    const { supabaseAnon } = require('../config/supabase');
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error) {
      logger.warn('[POST /auth/login] Invalid credentials', { email });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('id, email, display_name, credit_balance, language, is_admin, created_at, flags')
      .eq('id', data.user.id)
      .single();

    logger.info('[POST /auth/login] Login successful', { userId: data.user.id, email });

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: userRow,
    });
  } catch (err) { next(err); }
});

// ---- POST /auth/logout ----------------------------------------
// Invalidates all sessions for the user on the Supabase Auth server.
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    logger.info('[POST /auth/logout] Logging out user', { userId: req.userId });
    // admin.signOut expects a user UUID and optional scope, not a JWT token
    await supabaseAdmin.auth.admin.signOut(req.userId, 'global');
    logger.info('[POST /auth/logout] Logout successful', { userId: req.userId });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
