'use strict';

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

const router = Router();

// ---- GET /users/me --------------------------------------------
router.get('/me', requireAuth, (req, res) => {
  // req.user is already populated by requireAuth
  const { id, email, display_name, avatar_url, credit_balance, language, is_admin, created_at, last_active_at, flags } = req.user;
  res.json({ id, email, display_name, avatar_url, credit_balance, language, is_admin, created_at, last_active_at, flags: flags ?? {} });
});

// ---- PATCH /users/me ------------------------------------------
// Allows updating display_name, language, avatar_url only.
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const allowed = ['display_name', 'language', 'avatar_url'];
    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    if (updates.language && !['en', 'he'].includes(updates.language)) {
      return res.status(400).json({ error: 'language must be "en" or "he"' });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.userId)
      .select('id, email, display_name, avatar_url, credit_balance, language, is_admin')
      .single();

    if (error) return next(error);
    res.json(data);
  } catch (err) { next(err); }
});

// ---- GET /users/streak ----------------------------------------
router.get('/streak', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('current_streak, longest_streak, last_active_date')
      .eq('id', req.userId)
      .single();
    if (error) return next(error);
    res.json({
      current_streak: data.current_streak ?? 0,
      longest_streak: data.longest_streak ?? 0,
      last_active_date: data.last_active_date ?? null,
    });
  } catch (err) { next(err); }
});

// ---- GET /users/achievements -----------------------------------
router.get('/achievements', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', req.userId)
      .order('unlocked_at', { ascending: false });
    if (error) return next(error);
    res.json({ achievements: data ?? [] });
  } catch (err) { next(err); }
});

// ---- DELETE /users/me -----------------------------------------
// GDPR: deletes Supabase Auth account + all cascaded data
// (stories, scenes, characters, credit_transactions, content_flags).
router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    // Delete Supabase Auth account — public.users cascades automatically
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.userId);
    if (error) return next(error);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
