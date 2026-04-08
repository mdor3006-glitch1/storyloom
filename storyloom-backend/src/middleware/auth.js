'use strict';

const { supabaseAdmin } = require('../config/supabase');

/**
 * Validates the Supabase JWT from the Authorization header.
 * On success, attaches req.user (public.users row) and req.userId.
 * Also updates last_active_at asynchronously (fire-and-forget).
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = header.slice(7);

  // Validate the JWT via Supabase Auth (handles expiry, signature, revocation)
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Fetch the public.users profile (contains credit_balance, is_admin, etc.)
  const { data: userRow, error: dbError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (dbError || !userRow) {
    // User authenticated but profile missing — trigger may not have fired yet
    return res.status(401).json({ error: 'User profile not found' });
  }

  req.user = userRow;
  req.userId = userRow.id;

  // Fire-and-forget: keep last_active_at current
  supabaseAdmin
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userRow.id)
    .then(() => {}) // intentionally swallow
    .catch(() => {});

  next();
}

/**
 * Requires is_admin = true. Must be used AFTER requireAuth.
 */
function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
