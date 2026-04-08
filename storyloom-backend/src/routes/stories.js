'use strict';

const { Router } = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');
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
router.post(
  '/',
  requireAuth,
  upload.fields([
    { name: 'main_photo',      maxCount: 1 },
    { name: 'secondary_photo', maxCount: 1 },
  ]),
  async (req, res, next) => {
    const userId = req.userId;
    logger.info('[POST /stories] Story creation request received', { userId });

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
        logger.warn('[POST /stories] Missing required fields', { userId, missing });
        return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      }

      const mainFile      = req.files?.main_photo?.[0];
      const secondaryFile = req.files?.secondary_photo?.[0];
      if (!mainFile) {
        logger.warn('[POST /stories] main_photo missing', { userId });
        return res.status(400).json({ error: 'main_photo is required.' });
      }
      if (!secondaryFile) {
        logger.warn('[POST /stories] secondary_photo missing', { userId });
        return res.status(400).json({ error: 'secondary_photo is required.' });
      }

      // Parse optional traits
      let parsedMainTraits = [], parsedSecondaryTraits = [];
      try {
        if (main_traits)      parsedMainTraits      = JSON.parse(main_traits);
        if (secondary_traits) parsedSecondaryTraits = JSON.parse(secondary_traits);
      } catch {
        logger.warn('[POST /stories] Invalid traits JSON', { userId });
        return res.status(400).json({ error: 'traits must be a valid JSON array.' });
      }

      logger.info('[POST /stories] Starting story creation pipeline', {
        userId, genre, setting, tone, length, art_style,
        mainName: main_name, secondaryName: secondary_name,
        mainPhotoSize: mainFile.size, secondaryPhotoSize: secondaryFile.size,
      });

      const { story, characters } = await createStory(
        userId,
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

      logger.info('[POST /stories] Story creation successful', { userId, storyId: story.id });
      return res.status(201).json({ story, characters });
    } catch (err) {
      if (err.statusCode >= 400 && err.statusCode < 500) {
        logger.warn('[POST /stories] Client error during story creation', { userId, status: err.statusCode, error: err.message, code: err.code });
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
      }
      next(err);
    }
  }
);

// ── GET /stories ──────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    logger.debug('[GET /stories] Fetching user stories', { userId: req.userId });
    const stories = await getUserStories(req.userId);
    logger.debug('[GET /stories] Stories returned', { userId: req.userId, count: stories.length });
    return res.json({ stories });
  } catch (err) { next(err); }
});

// ── GET /stories/:id/scenes-current ──────────────────────────
router.get('/:id/scenes-current', requireAuth, async (req, res, next) => {
  try {
    const storyId = req.params.id;
    logger.debug('[GET /stories/:id/scenes-current] Polling current scene', { userId: req.userId, storyId });

    const { data: story } = await supabaseAdmin
      .from('stories').select('id').eq('id', storyId).eq('user_id', req.userId).single();
    if (!story) {
      logger.warn('[GET /stories/:id/scenes-current] Story not found', { userId: req.userId, storyId });
      return res.status(404).json({ error: 'Story not found.' });
    }

    const { data: scene } = await supabaseAdmin
      .from('scenes').select('*').eq('story_id', storyId)
      .order('scene_number', { ascending: false }).limit(1).single();

    logger.debug('[GET /stories/:id/scenes-current] Scene returned', {
      storyId,
      sceneNumber: scene?.scene_number,
      hasImage: !!scene?.image_url,
    });
    return res.json({ scene: scene ?? null });
  } catch (err) { next(err); }
});

// ── GET /stories/:id ──────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    logger.debug('[GET /stories/:id] Fetching story', { userId: req.userId, storyId: req.params.id });
    const story = await getStory(req.userId, req.params.id);
    return res.json({ story });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// ── DELETE /stories/:id ───────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    logger.info('[DELETE /stories/:id] Abandoning story', { userId: req.userId, storyId: req.params.id });
    await abandonStory(req.userId, req.params.id);
    return res.status(204).end();
  } catch (err) { next(err); }
});

// ── POST /stories/:id/scenes ──────────────────────────────────
// Full scene generation pipeline:
//   safety pre-filter → Story AI → memory update → image gen → DB save
router.post('/:id/scenes', requireAuth, async (req, res, next) => {
  const { generateScene }       = require('../services/SceneService');
  const { getCharacterMemory, applyMemoryUpdates, updateTensionScore } = require('../services/MemoryService');
  const { generateSceneImage }  = require('../services/ImageService');
  const { v4: uuidv4 }          = require('uuid');

  const storyId = req.params.id;
  const userId  = req.userId;
  const pipelineStart = Date.now();

  logger.info('[POST /stories/:id/scenes] Scene generation pipeline started', { userId, storyId });

  try {
    const { player_choice, player_text_input } = req.body;

    // ── Step 1: Load story ────────────────────────────────────
    logger.debug('[scenes] Loading story from DB', { storyId });
    const { data: story, error: stErr } = await supabaseAdmin
      .from('stories')
      .select('*')
      .eq('id', storyId)
      .eq('user_id', userId)
      .single();

    if (stErr || !story) {
      logger.warn('[scenes] Story not found', { userId, storyId });
      return res.status(404).json({ error: 'Story not found.' });
    }
    if (story.status !== 'active') {
      logger.warn('[scenes] Scene request on non-active story', { userId, storyId, status: story.status });
      return res.status(409).json({ error: 'Story is not active.' });
    }

    logger.debug('[scenes] Story loaded', {
      storyId,
      currentScene: story.current_scene_number,
      totalScenes: story.total_scenes,
      status: story.status,
      tensionScore: story.story_tension_score,
    });

    // ── Step 2: Load characters and recent scenes ─────────────
    logger.debug('[scenes] Loading character memory and recent scene history', { storyId });
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

    logger.info('[scenes] Context loaded', {
      storyId,
      characterCount: characters.length,
      recentScenesCount: recentScenes?.length ?? 0,
      isFirstScene,
      playerChoice: playerChoice ? playerChoice.slice(0, 60) : null,
    });

    // ── Step 3: Save player choice on the previous scene ──────
    if (previousScene && playerChoice) {
      logger.debug('[scenes] Saving player choice to previous scene', {
        storyId,
        previousSceneId: previousScene.id,
        playerChoice,
      });
      await supabaseAdmin
        .from('scenes')
        .update({ player_choice: playerChoice })
        .eq('id', previousScene.id);
    }

    // ── Step 4: Generate scene text + metadata via Story AI ───
    logger.info('[scenes] Calling Story AI (SceneService)', { storyId });
    const aiStart = Date.now();
    const sceneData = await generateScene({
      story, characters,
      recentScenes: (recentScenes ?? []).reverse(),
      playerChoice,
      isFirstScene,
    });
    logger.info('[scenes] Story AI completed', {
      storyId,
      durationMs: Date.now() - aiStart,
      twistOccurred: sceneData.twist_occurred,
      twistType: sceneData.twist_type,
      tensionScore: sceneData.story_tension_score,
      isFinalScene: sceneData.is_final_scene,
    });

    // ── Step 5: Build scene row ───────────────────────────────
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

    // ── Step 6: Start image generation (async — don't block) ──
    logger.info('[scenes] Kicking off async image generation', {
      storyId,
      sceneNumber,
      hasPreviousImage: !!previousScene?.image_url,
    });

    const imagePromise = generateSceneImage({
      imagePrompt:      sceneData.image_prompt,
      storyId,
      sceneNumber,
      characters,
      previousImageUrl: previousScene?.image_url ?? null,
    }).then(async (imageUrl) => {
      logger.info('[scenes] Image generated — updating scene row', { storyId, sceneNumber, sceneId, imageUrl });
      await supabaseAdmin
        .from('scenes')
        .update({ image_url: imageUrl })
        .eq('id', sceneId);
    }).catch((err) => {
      logger.error('[scenes] Image generation failed (non-fatal — scene continues without image)', {
        storyId,
        sceneNumber,
        error: err.message,
      });
    });

    // ── Step 7: Insert scene row + update story state ─────────
    logger.debug('[scenes] Inserting scene row into DB', { storyId, sceneId, sceneNumber });
    const { error: insertErr } = await supabaseAdmin.from('scenes').insert(sceneRow);
    if (insertErr) throw insertErr;

    const newStatus = sceneData.is_final_scene ? 'completed' : 'active';
    logger.debug('[scenes] Updating story state', {
      storyId,
      sceneNumber,
      newStatus,
      tensionScore: sceneData.story_tension_score,
    });

    await supabaseAdmin
      .from('stories')
      .update({
        current_scene_number: sceneNumber,
        story_tension_score:  sceneData.story_tension_score ?? story.story_tension_score,
        status: newStatus,
        completed_at: sceneData.is_final_scene ? new Date().toISOString() : null,
      })
      .eq('id', storyId);

    // ── Step 8: Apply memory updates ──────────────────────────
    logger.debug('[scenes] Applying character memory updates', { storyId });
    await applyMemoryUpdates(storyId, sceneData.memory_updates ?? {});
    await updateTensionScore(storyId, sceneData.story_tension_score ?? 0);

    // ── Step 9: Respond immediately (image_url may be null) ───
    const totalMs = Date.now() - pipelineStart;
    logger.info('[scenes] Scene pipeline complete — responding to client', {
      storyId,
      sceneNumber,
      isFinalScene: sceneData.is_final_scene,
      totalPipelineMs: totalMs,
    });

    res.status(201).json({ scene: sceneRow, is_final_scene: sceneData.is_final_scene ?? false });

    // ── Step 10: Preload warm-up (background) ─────────────────
    if (!sceneData.is_final_scene) {
      imagePromise.then(() => {
        logger.debug('[scenes] Image generation settled — background preload hook point', { storyId });
      });
    }
  } catch (err) { next(err); }
});

// ── POST /stories/:id/undo ────────────────────────────────────
router.post('/:id/undo', requireAuth, async (req, res, next) => {
  try {
    const storyId = req.params.id;
    logger.info('[POST /stories/:id/undo] Undo requested', { userId: req.userId, storyId });

    const { data: story, error: stErr } = await supabaseAdmin
      .from('stories')
      .select('id, user_id, current_scene_number')
      .eq('id', storyId)
      .eq('user_id', req.userId)
      .single();

    if (stErr || !story) {
      logger.warn('[undo] Story not found', { userId: req.userId, storyId });
      return res.status(404).json({ error: 'Story not found.' });
    }
    if (story.current_scene_number < 2) {
      logger.warn('[undo] Cannot undo first scene', { storyId });
      return res.status(409).json({ error: 'Cannot undo the first scene.' });
    }

    const { data: lastScene } = await supabaseAdmin
      .from('scenes')
      .select('id, scene_number, is_undo_snapshot')
      .eq('story_id', storyId)
      .order('scene_number', { ascending: false })
      .limit(1)
      .single();

    if (lastScene?.is_undo_snapshot) {
      logger.warn('[undo] Undo already used for this story', { storyId });
      return res.status(409).json({ error: 'Undo already used for this story.' });
    }

    logger.info('[undo] Deleting last scene and rolling back story state', {
      storyId,
      deletingSceneId: lastScene.id,
      sceneNumber: lastScene.scene_number,
    });

    await supabaseAdmin.from('scenes').delete().eq('id', lastScene.id);

    const restoredSceneNumber = story.current_scene_number - 1;
    await supabaseAdmin
      .from('stories')
      .update({ current_scene_number: restoredSceneNumber, status: 'active' })
      .eq('id', storyId);

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

    logger.info('[undo] Undo complete', { storyId, restoredSceneNumber });
    return res.json({ scene: prevScene, undo_used: true });
  } catch (err) { next(err); }
});

// ── PATCH /stories/:id/favourite ─────────────────────────────
router.patch('/:id/favourite', requireAuth, async (req, res, next) => {
  try {
    logger.info('[PATCH /stories/:id/favourite] Toggle favourite', { userId: req.userId, storyId: req.params.id });
    const story = await toggleFavourite(req.userId, req.params.id);
    return res.json({ story });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
