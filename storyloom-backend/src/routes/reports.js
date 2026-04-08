'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

const router = Router();

// ── POST /reports ─────────────────────────────────────────────
// Submit a content flag for a story scene.
// Body: { story_id, scene_id? }
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { story_id, scene_id } = req.body;
    if (!story_id) return res.status(400).json({ error: 'story_id is required.' });

    // Verify the story exists (user may report any story, not just their own,
    // but we still validate it's a real story_id)
    const { data: story } = await supabaseAdmin
      .from('stories').select('id').eq('id', story_id).single();
    if (!story) return res.status(404).json({ error: 'Story not found.' });

    const { error } = await supabaseAdmin.from('content_flags').insert({
      id: uuidv4(),
      story_id,
      scene_id: scene_id ?? null,
      reported_by_user_id: req.userId,
      status: 'pending',
    });

    if (error) throw error;

    return res.status(201).json({ reported: true });
  } catch (err) { next(err); }
});

module.exports = router;
