'use strict';

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');
const {
  createStory,
  getUserStories,
  getStory,
  abandonStory,
  toggleFavourite,
  continueStory,
} = require('../services/StoryService');
const {
  consumeBundle,
  pregeneratePair,
  invalidateFromScene,
  updateChoiceBias,
} = require('../services/PregenerationService');

const router = Router();

// ── In-memory idempotency cache (5s window) ───────────────────
const idempotencyCache = new Map(); // key → { sceneRow, ts }
function idempotencyKey(storyId, sceneNumber, playerChoice) {
  return `${storyId}:${sceneNumber}:${String(playerChoice ?? '').slice(0, 60)}`;
}
function getIdempotent(key) {
  const e = idempotencyCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > 5000) { idempotencyCache.delete(key); return null; }
  return e.value;
}
function putIdempotent(key, value) {
  idempotencyCache.set(key, { value, ts: Date.now() });
  // Opportunistic eviction
  if (idempotencyCache.size > 500) {
    const cutoff = Date.now() - 5000;
    for (const [k, v] of idempotencyCache) {
      if (v.ts < cutoff) idempotencyCache.delete(k);
    }
  }
}

// ── POST /stories ─────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  const userId = req.userId;
  logger.info('[POST /stories] Story creation request received', { userId });

  try {
    const {
      genre, genre_subtype, setting, tone, length, art_style,
      story_elements,
      main_name, main_traits, main_appearance,
      secondary_name, secondary_traits, secondary_appearance,
    } = req.body;

    const missing = ['genre', 'setting', 'tone', 'length', 'art_style', 'main_name', 'secondary_name']
      .filter((f) => !req.body[f]?.toString().trim());
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    let parsedMainTraits = [], parsedSecondaryTraits = [];
    try {
      if (main_traits)      parsedMainTraits      = JSON.parse(main_traits);
      if (secondary_traits) parsedSecondaryTraits = JSON.parse(secondary_traits);
    } catch {
      return res.status(400).json({ error: 'traits must be a valid JSON array.' });
    }

    const { story, characters } = await createStory(
      userId,
      { genre, genre_subtype: genre_subtype ?? null, setting, tone, length, art_style, story_elements: story_elements ? JSON.parse(story_elements) : [] },
      [
        { role: 'main',      name: main_name.toString().trim().slice(0, 20),      traits: parsedMainTraits.slice(0, 3),      appearance: main_appearance?.toString().trim() ?? null },
        { role: 'secondary', name: secondary_name.toString().trim().slice(0, 20), traits: parsedSecondaryTraits.slice(0, 3), appearance: secondary_appearance?.toString().trim() ?? null },
      ]
    );

    logger.info('[POST /stories] Story creation successful', { userId, storyId: story.id });

    // STAGE v2 — warm start: kick scene-1 generation immediately.
    // Non-blocking; stored under choice_hash = '__scene_1__'.
    setImmediate(async () => {
      try {
        const { generateScene } = require('../services/SceneService');
        const { generateSceneImage } = require('../services/ImageService');
        const { choiceHash } = require('../services/PregenerationService');
        const { SCHEMA_VERSION } = require('../services/PregenerationService');

        const warmHash = choiceHash('__scene_1__');
        // Claim row
        const { data: claim, error: claimErr } = await supabaseAdmin
          .from('pregen_bundles')
          .insert({
            story_id: story.id,
            from_scene_number: 0,
            choice_hash: warmHash,
            choice_text: '__scene_1__',
            status: 'pending',
            schema_version: SCHEMA_VERSION,
          })
          .select('id')
          .single();
        if (claimErr) {
          logger.warn('[warmStart] Claim failed', { storyId: story.id, error: claimErr.message });
          return;
        }

        const sceneData = await generateScene({
          story, characters, recentScenes: [], playerChoice: null, isFirstScene: true,
        });
        const imageUrl = await generateSceneImage({
          imagePrompt: sceneData.image_prompt,
          storyId: story.id,
          sceneNumber: 1,
          previousImageUrl: null,
          genre: story.genre ?? null,
          genreSubtype: story.genre_subtype ?? null,
          sceneType: sceneData.scene_type ?? 'A',
          twistOccurred: false,
          isFinalScene: false,
        });
        await supabaseAdmin
          .from('pregen_bundles')
          .update({
            scene_data: sceneData,
            image_url:  imageUrl,
            status:     'ready',
            ready_at:   new Date().toISOString(),
          })
          .eq('id', claim.id);
        logger.info('[warmStart] Scene 1 ready', { storyId: story.id });
      } catch (err) {
        logger.warn('[warmStart] Scene 1 warm failed', { storyId: story.id, error: err.message });
      }
    });

    return res.status(201).json({ story, characters });
  } catch (err) {
    logger.error('[POST /stories] Story creation failed', { userId, message: err.message, stack: err.stack });
    if (err.statusCode >= 400 && err.statusCode < 500) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    next(err);
  }
});

// ── GET /stories ──────────────────────────────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const stories = await getUserStories(req.userId);
    return res.json({ stories });
  } catch (err) { next(err); }
});

// ── GET /stories/:id/scenes-current ──────────────────────────
router.get('/:id/scenes-current', requireAuth, async (req, res, next) => {
  try {
    const storyId = req.params.id;

    const { data: story } = await supabaseAdmin
      .from('stories').select('id').eq('id', storyId).eq('user_id', req.userId).single();
    if (!story) return res.status(404).json({ error: 'Story not found.' });

    const { data: scene } = await supabaseAdmin
      .from('scenes').select('*').eq('story_id', storyId)
      .order('scene_number', { ascending: false }).limit(1).single();

    return res.json({ scene: scene ?? null });
  } catch (err) { next(err); }
});

// ── GET /stories/:id/warm-scene-1 ─────────────────────────────
// Called by LoadingScene for first-scene flow to check for warm bundle before
// firing a cold POST /scenes.
router.get('/:id/warm-scene-1', requireAuth, async (req, res, next) => {
  try {
    const storyId = req.params.id;
    const { data: story } = await supabaseAdmin
      .from('stories').select('id, user_id').eq('id', storyId).single();
    if (!story || story.user_id !== req.userId) return res.status(404).json({ error: 'Story not found.' });

    const { choiceHash } = require('../services/PregenerationService');
    const hash = choiceHash('__scene_1__');

    const { data: bundle } = await supabaseAdmin
      .from('pregen_bundles')
      .select('*')
      .eq('story_id', storyId)
      .eq('from_scene_number', 0)
      .eq('choice_hash', hash)
      .eq('status', 'ready')
      .maybeSingle();

    return res.json({
      ready:    !!bundle,
      bundle:   bundle ? { scene_data: bundle.scene_data, image_url: bundle.image_url } : null,
    });
  } catch (err) { next(err); }
});

// ── GET /stories/:id ──────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
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
    await abandonStory(req.userId, req.params.id);
    return res.status(204).end();
  } catch (err) { next(err); }
});

// ── POST /stories/:id/scenes ──────────────────────────────────
router.post('/:id/scenes', requireAuth, async (req, res, next) => {
  const { generateScene, SCHEMA_VERSION } = require('../services/SceneService');
  const { getCharacterMemory, applyMemoryUpdates, updateTensionScore } = require('../services/MemoryService');
  const { generateSceneImage }  = require('../services/ImageService');
  const { v4: uuidv4 }          = require('uuid');

  const storyId = req.params.id;
  const userId  = req.userId;
  const pipelineStart = Date.now();
  const SCENE_TIMEOUT_MS = 85_000;
  const isAppForeground = (req.header('x-app-state') ?? 'foreground') !== 'background';

  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      logger.error('[scenes] Pipeline timeout exceeded', { userId, storyId });
      res.status(503).json({ error: 'Scene generation timed out. Please try again.' });
    }
  }, SCENE_TIMEOUT_MS);

  try {
    const { player_choice, player_text_input, choice_index } = req.body;

    // ── Step 1: Load story ────────────────────────────────────
    const { data: story, error: stErr } = await supabaseAdmin
      .from('stories').select('*').eq('id', storyId).eq('user_id', userId).single();

    if (stErr || !story) return res.status(404).json({ error: 'Story not found.' });
    if (story.status !== 'active') return res.status(409).json({ error: 'Story is not active.' });

    const characters = await getCharacterMemory(storyId);
    const { data: recentScenes } = await supabaseAdmin
      .from('scenes').select('*').eq('story_id', storyId)
      .order('scene_number', { ascending: false }).limit(5);

    const previousScene = recentScenes?.[0] ?? null;
    const isFirstScene  = !previousScene;
    const playerChoice  = player_text_input?.trim() || player_choice || null;
    const isFreeform    = !!player_text_input?.trim();

    // ── Idempotency ───────────────────────────────────────────
    const sceneNumberTarget = (story.current_scene_number ?? 0) + 1;
    const idemKey = idempotencyKey(storyId, sceneNumberTarget, playerChoice);
    const cachedResp = getIdempotent(idemKey);
    if (cachedResp) {
      clearTimeout(timeoutId);
      logger.info('[scenes] Idempotent duplicate — returning cached response', { storyId, idemKey });
      return res.status(201).json(cachedResp);
    }

    // Save player choice on previous scene
    if (previousScene && playerChoice) {
      await supabaseAdmin
        .from('scenes').update({
          player_choice: playerChoice,
          player_text_input: player_text_input?.trim() ?? null,
        }).eq('id', previousScene.id);
    }

    // Update choice bias (predicted-branch priority signal)
    if (!isFreeform && choice_index !== undefined && (choice_index === 0 || choice_index === 1)) {
      updateChoiceBias(userId, choice_index).catch(() => {});
    }

    const sceneNumber = sceneNumberTarget;
    const sceneId     = uuidv4();

    // ── Step 2: Try warm bundle (first scene) or pregen bundle (subsequent) ─
    let sceneData, imageUrlFromBundle = null, usedCache = false;

    if (isFirstScene) {
      const { choiceHash } = require('../services/PregenerationService');
      const warmHash = choiceHash('__scene_1__');
      const { data: warmBundle } = await supabaseAdmin
        .from('pregen_bundles')
        .select('*')
        .eq('story_id', storyId)
        .eq('from_scene_number', 0)
        .eq('choice_hash', warmHash)
        .eq('status', 'ready')
        .maybeSingle();
      if (warmBundle?.scene_data) {
        sceneData = warmBundle.scene_data;
        imageUrlFromBundle = warmBundle.image_url;
        usedCache = true;
        await supabaseAdmin.from('pregen_bundles').update({ status: 'consumed' }).eq('id', warmBundle.id);
        logger.info('[scenes] Warm-start hit for scene 1', { storyId });
      }
    } else if (!isFreeform && playerChoice) {
      const bundle = await consumeBundle(storyId, previousScene.scene_number, playerChoice);
      if (bundle?.sceneData) {
        sceneData = bundle.sceneData;
        imageUrlFromBundle = bundle.imageUrl;
        usedCache = true;
        logger.info('[scenes] Pregen bundle HIT', { storyId, sceneNumber });
      }
    }

    // ── Step 3: Live generation fallback ──────────────────────
    if (!sceneData) {
      const aiStart = Date.now();
      sceneData = await generateScene({
        story, characters,
        recentScenes: (recentScenes ?? []).reverse(),
        playerChoice,
        isFirstScene,
      });
      logger.info('[scenes] Live scene gen completed', {
        storyId, sceneNumber, durationMs: Date.now() - aiStart, isFreeform,
      });
    }

    // ── Step 4: Build scene row ───────────────────────────────
    const sceneRow = {
      id:                sceneId,
      story_id:          storyId,
      scene_number:      sceneNumber,
      scene_text:        sceneData.scene_text,
      dialogue:          sceneData.dialogue ?? [],
      choices:           sceneData.choices ?? [],
      image_prompt:      sceneData.image_prompt ?? '',
      twist_occurred:    sceneData.twist_occurred ?? false,
      twist_type:        sceneData.twist_type ?? null,
      is_undo_snapshot:  false,
      image_url:         imageUrlFromBundle || '',
      // STAGE v2
      scene_type:        sceneData.scene_type ?? 'B',
      filler_dialogue:   sceneData.filler_dialogue ?? [],
      can_text_input:    sceneData.can_text_input ?? (sceneData.scene_type === 'A'),
      schema_version:    SCHEMA_VERSION ?? 2,
    };

    // ── Step 5: Kick off async image gen if bundle missing ────
    let imagePromise = Promise.resolve();
    if (!imageUrlFromBundle) {
      imagePromise = generateSceneImage({
        imagePrompt:      sceneData.image_prompt,
        storyId,
        sceneNumber,
        previousImageUrl: previousScene?.image_url || null,
        genre:            story.genre ?? null,
        genreSubtype:     story.genre_subtype ?? null,
        sceneType:        sceneData.scene_type ?? null,
        twistOccurred:    sceneData.twist_occurred ?? false,
        isFinalScene:     sceneData.is_final_scene ?? false,
      }).then(async (imageUrl) => {
        await supabaseAdmin.from('scenes').update({ image_url: imageUrl }).eq('id', sceneId);
      }).catch((err) => {
        logger.error('[scenes] Image generation failed (non-fatal)', { storyId, error: err.message });
      });
    }

    // ── Step 6: Insert scene + update story ───────────────────
    const { error: insertErr } = await supabaseAdmin.from('scenes').insert(sceneRow);
    if (insertErr) {
      // Duplicate-key race: another concurrent request already inserted this
      // scene_number. Fetch and return the existing row instead of 500'ing.
      // PG error 23505 = unique_violation.
      if (insertErr.code === '23505') {
        logger.warn('[scenes] Duplicate insert detected — returning existing scene', {
          storyId, sceneNumber, userId,
        });
        const { data: existing } = await supabaseAdmin
          .from('scenes').select('*')
          .eq('story_id', storyId)
          .eq('scene_number', sceneNumber)
          .eq('is_undo_snapshot', false)
          .maybeSingle();
        if (existing) {
          clearTimeout(timeoutId);
          if (!res.headersSent) {
            return res.status(201).json({
              scene: existing,
              is_final_scene: existing.scene_number >= (story.total_scenes ?? 0),
              deduped: true,
            });
          }
          return;
        }
      }
      throw insertErr;
    }

    const newStatus = sceneData.is_final_scene ? 'completed' : 'active';
    // Freeform cooldown logic: if this was freeform, set cooldown = 2. Otherwise decrement.
    const prevCooldown = Math.max(0, story.freeform_cooldown_remaining ?? 0);
    const nextCooldown = isFreeform ? 2 : Math.max(0, prevCooldown - 1);

    await supabaseAdmin.from('stories').update({
      current_scene_number: sceneNumber,
      story_tension_score:  sceneData.story_tension_score ?? story.story_tension_score,
      status: newStatus,
      completed_at: sceneData.is_final_scene ? new Date().toISOString() : null,
      freeform_cooldown_remaining: nextCooldown,
    }).eq('id', storyId);

    // ── Step 7: Apply memory updates ──────────────────────────
    await applyMemoryUpdates(storyId, sceneData.memory_updates ?? {});
    await updateTensionScore(storyId, sceneData.story_tension_score ?? 0);

    // ── Step 8: Pregen-on-read — kick next-branch pair BEFORE response ─
    if (!sceneData.is_final_scene) {
      pregeneratePair({
        userId,
        storyId,
        story: { ...story, current_scene_number: sceneNumber, freeform_cooldown_remaining: nextCooldown },
        characters,
        currentSceneRow: sceneRow,
        currentSceneData: sceneData,
        recentScenes: (recentScenes ?? []).reverse(),
        isAppForeground,
      }).catch((err) => logger.warn('[scenes] Pregen kickoff error', { error: err.message }));
    }

    // ── Step 9: Respond ───────────────────────────────────────
    clearTimeout(timeoutId);
    if (res.headersSent) return;

    const responseBody = { scene: sceneRow, is_final_scene: sceneData.is_final_scene ?? false };
    putIdempotent(idemKey, responseBody);

    logger.info('[scenes] Pipeline complete', {
      storyId, sceneNumber, usedCache, totalMs: Date.now() - pipelineStart,
    });

    res.status(201).json(responseBody);
  } catch (err) {
    clearTimeout(timeoutId);
    if (res.headersSent) return;
    const msg = err.message ?? '';
    if (msg.includes('credit balance') || msg.includes('billing') || msg.includes('quota')) {
      return res.status(503).json({ error: 'The story AI is temporarily unavailable. Please try again.' });
    }
    next(err);
  }
});

// ── POST /stories/:id/undo ────────────────────────────────────
router.post('/:id/undo', requireAuth, async (req, res, next) => {
  try {
    const storyId = req.params.id;

    const { data: story, error: stErr } = await supabaseAdmin
      .from('stories').select('id, user_id, current_scene_number')
      .eq('id', storyId).eq('user_id', req.userId).single();

    if (stErr || !story) return res.status(404).json({ error: 'Story not found.' });
    if (story.current_scene_number < 2) return res.status(409).json({ error: 'Cannot undo the first scene.' });

    const { data: lastScene } = await supabaseAdmin
      .from('scenes').select('id, scene_number, is_undo_snapshot')
      .eq('story_id', storyId).order('scene_number', { ascending: false }).limit(1).single();

    if (lastScene?.is_undo_snapshot) return res.status(409).json({ error: 'Undo already used for this story.' });

    await supabaseAdmin.from('scenes').delete().eq('id', lastScene.id);

    const restoredSceneNumber = story.current_scene_number - 1;
    await supabaseAdmin.from('stories')
      .update({ current_scene_number: restoredSceneNumber, status: 'active' }).eq('id', storyId);

    const { data: prevScene } = await supabaseAdmin
      .from('scenes').select('*').eq('story_id', storyId)
      .order('scene_number', { ascending: false }).limit(1).single();

    if (prevScene) {
      await supabaseAdmin.from('scenes').update({ is_undo_snapshot: true }).eq('id', prevScene.id);
    }

    // Invalidate any pregen bundles from the undone scene onward
    await invalidateFromScene(storyId, restoredSceneNumber);

    return res.json({ scene: prevScene, undo_used: true });
  } catch (err) { next(err); }
});

// ── POST /stories/:id/continue ────────────────────────────────
router.post('/:id/continue', requireAuth, async (req, res, next) => {
  try {
    const story = await continueStory(req.userId, req.params.id);
    return res.json({ story });
  } catch (err) {
    if (err.statusCode >= 400 && err.statusCode < 500) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

// ── PATCH /stories/:id/favourite ─────────────────────────────
router.patch('/:id/favourite', requireAuth, async (req, res, next) => {
  try {
    const story = await toggleFavourite(req.userId, req.params.id);
    return res.json({ story });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// ── PATCH /stories/:id — update rating ───────────────────────
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rating, rating_comment } = req.body;
    const { data, error } = await supabaseAdmin
      .from('stories')
      .update({ rating, rating_comment })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ story: data });
  } catch (err) { next(err); }
});

// ── GET /stories/:id/recap ────────────────────────────────────
router.get('/:id/recap', requireAuth, async (req, res, next) => {
  const Anthropic = require('@anthropic-ai/sdk');
  const _env = require('../config/env');
  const anthropic = new Anthropic({ apiKey: _env.anthropic.apiKey });
  try {
    const storyId = req.params.id;
    const [{ data: story }, { data: scenes }] = await Promise.all([
      supabaseAdmin.from('stories').select('title,genre,setting,tone').eq('id', storyId).eq('user_id', req.userId).single(),
      supabaseAdmin.from('scenes').select('scene_number,scene_text,player_choice').eq('story_id', storyId).order('scene_number', { ascending: false }).limit(5),
    ]);
    if (!story) return res.status(404).json({ error: 'Story not found.' });

    const historyText = (scenes ?? []).reverse().map(s =>
      `Scene ${s.scene_number}: ${s.scene_text ?? ''} [Player chose: ${s.player_choice ?? 'N/A'}]`
    ).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Write a 3-4 sentence recap of this story for the player who is returning after a break. Be vivid, use character names, and end with a hook that makes them want to continue.\n\nStory: "${story.title}" — ${story.genre} set in ${story.setting}\n\nRecent scenes:\n${historyText}`,
      }],
    });

    const recap = response.content[0]?.text ?? 'Your story continues where you left off...';
    return res.json({ recap });
  } catch (err) { next(err); }
});

module.exports = router;
