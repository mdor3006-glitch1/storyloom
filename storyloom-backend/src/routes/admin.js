'use strict';

const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

const router = Router();

// All admin routes require auth + admin role (Task 5.2)
router.use(requireAuth, requireAdmin);

// ── GET /admin/flags ──────────────────────────────────────────
// List pending content flags with story + scene + reporter info.
// Query params: status (default 'pending'), limit, offset
router.get('/flags', async (req, res, next) => {
  try {
    const status = req.query.status ?? 'pending';
    const limit  = Math.min(parseInt(req.query.limit  ?? '50', 10), 200);
    const offset = parseInt(req.query.offset ?? '0', 10);

    const { data, error } = await supabaseAdmin
      .from('content_flags')
      .select(`
        *,
        story:stories(id, genre, setting, tone, user_id),
        scene:scenes(id, scene_number, scene_text, image_url),
        reporter:users!reported_by_user_id(id, email, display_name)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return res.json({ flags: data });
  } catch (err) { next(err); }
});

// ── PATCH /admin/flags/:id ────────────────────────────────────
// Review or dismiss a content flag.
// Body: { action: 'reviewed' | 'dismissed' }
router.patch('/flags/:id', async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!['reviewed', 'dismissed'].includes(action)) {
      return res.status(400).json({ error: 'action must be "reviewed" or "dismissed".' });
    }

    const { data, error } = await supabaseAdmin
      .from('content_flags')
      .update({ status: action, reviewed_by_admin_id: req.userId })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data)  return res.status(404).json({ error: 'Flag not found.' });

    return res.json({ flag: data });
  } catch (err) { next(err); }
});

// ── GET /admin/users ──────────────────────────────────────────
// List all users with key stats. Query params: limit, offset, search (email)
router.get('/users', async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  ?? '50', 10), 200);
    const offset = parseInt(req.query.offset ?? '0', 10);
    const search = req.query.search?.trim() ?? '';

    let query = supabaseAdmin
      .from('users')
      .select('id, email, display_name, credit_balance, is_admin, created_at, last_active_at, language')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) query = query.ilike('email', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ users: data });
  } catch (err) { next(err); }
});

// ── GET /admin/stats ──────────────────────────────────────────
// Daily revenue + signups for the last N days (default 30).
router.get('/stats', async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days ?? '30', 10), 90);

    // Signups per day
    const { data: signups } = await supabaseAdmin
      .from('users')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - days * 86400000).toISOString());

    // Revenue per day (purchase transactions only)
    const { data: purchases } = await supabaseAdmin
      .from('credit_transactions')
      .select('amount, created_at')
      .eq('type', 'purchase')
      .gte('created_at', new Date(Date.now() - days * 86400000).toISOString());

    // Stories created per day
    const { data: stories } = await supabaseAdmin
      .from('stories')
      .select('created_at, credits_spent')
      .gte('created_at', new Date(Date.now() - days * 86400000).toISOString());

    return res.json({
      signups:   signups   ?? [],
      purchases: purchases ?? [],
      stories:   stories   ?? [],
    });
  } catch (err) { next(err); }
});

module.exports = router;
