'use strict';

const { Router } = require('express');
const { authLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

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

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name: display_name ?? email.split('@')[0],
      },
      email_confirm: true, // skip email confirmation in dev; set to false for prod
    });

    if (error) {
      // Surface duplicate-email as a 409 rather than 500
      if (error.message?.toLowerCase().includes('already registered')) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      return res.status(400).json({ error: error.message });
    }

    // The trigger may take a moment — wait for the profile to appear
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('id, email, display_name, credit_balance, language, is_admin, created_at')
      .eq('id', data.user.id)
      .single();

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

    // Sign in via the anon client (uses user credentials, not service role)
    const { supabaseAnon } = require('../config/supabase');
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('id, email, display_name, credit_balance, language, is_admin, created_at')
      .eq('id', data.user.id)
      .single();

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: userRow,
    });
  } catch (err) { next(err); }
});

// ---- POST /auth/logout ----------------------------------------
// Invalidates the user's current session on the Supabase Auth server.
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const token = req.headers.authorization.slice(7);
    // Sign out using the user's own token
    const { supabaseAnon } = require('../config/supabase');
    const client = supabaseAnon;
    await client.auth.admin; // no-op — we use admin signOut below
    await supabaseAdmin.auth.admin.signOut(token);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
