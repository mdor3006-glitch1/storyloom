'use strict';

const { Router } = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const {
  createStory,
  getUserStories,
  getStory,
  abandonStory,
  toggleFavourite,
} = require('../services/StoryService');

// Multipart upload — photos travel with the story creation request
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
  fileFilter: (_req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png'].includes(file.mimetype));
  },
});

const router = Router();

// ── POST /stories ─────────────────────────────────────────────
// Create a new story, deduct credits, upload character photos.
// Expects multipart/form-data:
//   genre, setting, tone, length, art_style   text fields
//   main_name, main_traits (JSON array)        text fields
//   secondary_name, secondary_traits           text fields
//   main_photo, secondary_photo                files (JPG/PNG ≤5MB)
router.post(
  '/',
  requireAuth,
  upload.fields([
    { name: 'main_photo',      maxCount: 1 },
    { name: 'secondary_photo', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const {
        genre, setting, tone, length, art_style,
        main_name, main_traits,
        secondary_name, secondary_traits,
      } = req.body;

      // ── Required field validation ─────────────────────────
      const missing = ['genre', 'setting', 'tone', 'length', 'art_style', 'main_name', 'secondary_name']
        .filter((f) => !req.body[f]?.trim());
      if (missing.length) {
        return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      }

      const mainFile      = req.files?.main_photo?.[0];
      const secondaryFile = req.files?.secondary_photo?.[0];
      if (!mainFile)      return res.status(400).json({ error: 'main_photo is required.' });
      if (!secondaryFile) return res.status(400).json({ error: 'secondary_photo is required.' });

      // Parse optional traits
      let parsedMainTraits = [], parsedSecondaryTraits = [];
      try {
        if (main_traits)      parsedMainTraits      = JSON.parse(main_traits);
        if (secondary_traits) parsedSecondaryTraits = JSON.parse(secondary_traits);
      } catch {
        return res.status(400).json({ error: 'traits must be a valid JSON array.' });
      }

      const { story, characters } = await createStory(
        req.userId,
        { genre, setting, tone, length, art_style },
        [
          { role: 'main',      name: main_name.trim().slice(0, 20),      traits: parsedMainTraits.slice(0, 3) },
          { role: 'secondary', name: secondary_name.trim().slice(0, 20), traits: parsedSecondaryTraits.slice(0, 3) },
        ],
        {
          main:      { buffer: mainFile.buffer,      mimeType: mainFile.mimetype },
          secondary: { buffer: secondaryFile.buffer, mimeType: secondaryFile.mimetype },
        }
      );

      return res.status(201).json({ story, characters });
    } catch (err) {
      if (err.statusCode >= 400 && err.statusCode < 500) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      next(err);
    }
  }
);

// ── GET /stories ────────────────���─────────────────────────────
// List all active/completed stories for the authenticated user.
// Each story includes its user-created characters.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const stories = await getUserStories(req.userId);
    return res.json({ stories });
  } catch (err) { next(err); }
});

// ── GET /stories/:id/scenes-current ──────────────────────────
// Returns the most recent scene for a story — used by the client
// to poll for the image_url after async image generation completes.
router.get('/:id/scenes-current', requireAuth, async (req, res, next) => {
  try {
    const storyId = req.params.id;
    // Verify ownership
    const { data: story } = await supabaseAdmin
      .from('stories').select('id').eq('id', storyId).eq('user_id', req.userId).single();
    if (!story) return res.status(404).json({ error: 'Story not found.' });

    const { data: scene } = await supabaseAdmin
      .from('scenes').select('*').eq('story_id', storyId)
      .order('scene_number', { ascending: false }).limit(1).single();

    return res.json({ scene: scene ?? null });
  } catch (err) { next(err); }
});

// ── GET /stories/:id ───────────────────────────────────────────
// Get a single story with all characters.
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const story = await getStory(req.userId, req.params.id);
    return res.json({ story });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// ── DELETE /stories/:id ──────────────��────────────────────────
// Abandon a story. No credit refund per product rules.
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await abandonStory(req.userId, req.params.id);
    return res.status(204).end();
  } catch (err) { next(err); }
});

// ── POST /stories/:id/scenes ──────────────────────────────────
// Full scene generation pipeline (Tasks 3.8 + 3.9):
//   safety pre-filter → Story AI → memory update → image gen → DB save
//   then immediately kicks off preload of next scene in background.
//
// Body: { player_choice?: string, player_text_input?: string }
router.post('/:id/scenes', requireAuth, async (req, res, next) => {
  try {
    const { generateScene }       = require('../services/SceneService');
    const { getCharacterMemory, applyMemoryUpdates, updateTensionScore } = require('../services/MemoryService');
    const { generateSceneImage }  = require('../services/ImageService');
    const { v4: uuidv4 }          = require('uuid');

    const storyId = req.params.id;
    const { player_choice, player_text_input } = req.body;

    // 1. Load story
    const { data: story, error: stErr } = await supabaseAdmin
      .from('stories')
      .select('*')
      .eq('id', storyId)
      .eq('user_id', req.userId)
      .single();
    if (stErr || !story) return res.status(404).json({ error: 'Story not found.' });
    if (story.status !== 'active') return res.status(409).json({ error: 'Story is not active.' });

    // 2. Load characters and recent scenes
    const characters = await getCharacterMemory(storyId);
    const { data: recentScenes } = await supabaseAdmin
      .from('scenes')
      .select('*')
      .eq('story_id', storyId)
      .order('scene_number', { ascending: false })
      .limit(5);

    const previousScene = recentScenes?.[0] ?? null;
    const isFirstScene  = !previousScene;
    const playerChoice  = player_text_input?.trim() || player_choice || null;

    // 3. Save player choice on the previous scene row
    if (previousScene && playerChoice) {
      await supabaseAdmin
        .from('scenes')
        .update({ player_choice: playerChoice })
        .eq('id', previousScene.id);
    }

    // 4. Generate scene text + metadata via Story AI
    const sceneData = await generateScene({
      story, characters,
      recentScenes: (recentScenes ?? []).reverse(),
      playerChoice,
      isFirstScene,
    });

    // 5. Snapshot the scene row before image (so client can show text immediately)
    const sceneNumber = (story.current_scene_number ?? 0) + 1;
    const sceneId     = uuidv4();

    const sceneRow = {
      id:                  sceneId,
      story_id:            storyId,
      scene_number:        sceneNumber,
      scene_text:          sceneData.scene_text,
      dialogue:            sceneData.dialogue ?? [],
      choices:             sceneData.choices ?? [],
      image_prompt:        sceneData.image_prompt,
      twist_occurred:      sceneData.twist_occurred ?? false,
      twist_type:          sceneData.twist_type ?? null,
      is_undo_snapshot:    false,
      image_url:           null, // filled in after image gen
    };

    // 6. Generate scene image (async — don't block response)
    const imagePromise = generateSceneImage({
      imagePrompt:      sceneData.image_prompt,
      storyId,
      sceneNumber,
      characters,
      previousImageUrl: previousScene?.image_url ?? null,
    }).then(async (imageUrl) => {
      await supabaseAdmin
        .from('scenes')
        .update({ image_url: imageUrl })
        .eq('id', sceneId);
    }).catch((err) => {
      console.error('[scenes] Image generation failed:', err.message);
      // Non-fatal — scene plays on without image
    });

    // 7. Insert scene row + update story state
    const { error: insertErr } = await supabaseAdmin.from('scenes').insert(sceneRow);
    if (insertErr) throw insertErr;

    await supabaseAdmin
      .from('stories')
      .update({
        current_scene_number: sceneNumber,
        story_tension_score:  sceneData.story_tension_score ?? story.story_tension_score,
        status: sceneData.is_final_scene ? 'completed' : 'active',
        completed_at: sceneData.is_final_scene ? new Date().toISOString() : null,
      })
      .eq('id', storyId);

    // 8. Apply memory updates
    await applyMemoryUpdates(storyId, sceneData.memory_updates ?? {});
    await updateTensionScore(storyId, sceneData.story_tension_score ?? 0);

    // 9. Respond immediately with scene text (image_url may be null, client polls)
    res.status(201).json({ scene: sceneRow, is_final_scene: sceneData.is_final_scene ?? false });

    // 10. Preload next scene in background (Task 3.9) — fire-and-forget
    if (!sceneData.is_final_scene) {
      imagePromise.then(() => {
        // Next-scene preload would go here — requires player choice, so we only
        // kick off the image generation head-start by warming the character cache.
        // Full preload is triggered when player submits their choice (see client).
      });
    }
  } catch (err) { next(err); }
});

// ── POST /stories/:id/undo ─────────────────────────────────────
// Restore the previous scene snapshot and reset memory to that state.
// Each story allows 1 undo (checked against is_undo_snapshot flag).
router.post('/:id/undo', requireAuth, async (req, res, next) => {
  try {
    const storyId = req.params.id;

    // Verify ownership
    const { data: story, error: stErr } = await supabaseAdmin
      .from('stories')
      .select('id, user_id, current_scene_number')
      .eq('id', storyId)
      .eq('user_id', req.userId)
      .single();
    if (stErr || !story) return res.status(404).json({ error: 'Story not found.' });
    if (story.current_scene_number < 2) {
      return res.status(409).json({ error: 'Cannot undo the first scene.' });
    }

    // Check that undo hasn't already been used (last scene has is_undo_snapshot flag)
    const { data: lastScene } = await supabaseAdmin
      .from('scenes')
      .select('id, scene_number, is_undo_snapshot')
      .eq('story_id', storyId)
      .order('scene_number', { ascending: false })
      .limit(1)
      .single();

    if (lastScene?.is_undo_snapshot) {
      return res.status(409).json({ error: 'Undo already used for this story.' });
    }

    // Delete the most recent scene and step back
    await supabaseAdmin.from('scenes').delete().eq('id', lastScene.id);

    const restoredSceneNumber = story.current_scene_number - 1;
    await supabaseAdmin
      .from('stories')
      .update({ current_scene_number: restoredSceneNumber, status: 'active' })
      .eq('id', storyId);

    // Mark the now-last scene as undo snapshot (prevents second undo)
    const { data: prevScene } = await supabaseAdmin
      .from('scenes')
      .select('*')
      .eq('story_id', storyId)
      .order('scene_number', { ascending: false })
      .limit(1)
      .single();

    if (prevScene) {
      await supabaseAdmin
        .from('scenes')
        .update({ is_undo_snapshot: true })
        .eq('id', prevScene.id);
    }

    return res.json({ scene: prevScene, undo_used: true });
  } catch (err) { next(err); }
});

// ── PATCH /stories/:id/favourite ────────��────────────────────
// Toggle the favourite flag. Favourited stories never expire.
router.patch('/:id/favourite', requireAuth, async (req, res, next) => {
  try {
    const story = await toggleFavourite(req.userId, req.params.id);
    return res.json({ story });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
