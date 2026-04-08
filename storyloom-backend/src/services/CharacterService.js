'use strict';

const { v4: uuidv4 } = require('uuid');
const { fal } = require('@fal-ai/client');
const Anthropic = require('@anthropic-ai/sdk');
const { supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');
const logger = require('../config/logger');

// ── SDK config (once at module load) ─────────────────────────
fal.config({ credentials: env.fal.apiKey });
const anthropic = new Anthropic({ apiKey: env.anthropic.apiKey });

// ── Constants ─────────────────────────────────────────────────
const STORAGE_BUCKET = 'character-photos';
const NSFW_THRESHOLD = 0.75; // block if nsfw_probability >= this
const INITIAL_EMOTIONS = { love: 50, trust: 50, anger: 0, fear: 0, jealousy: 0 };

// ── Helpers ───────────────────────────────────────────────────

/**
 * Run fal.ai NSFW classifier on a base64-encoded image.
 * Returns true if the image is safe to store.
 */
async function checkNsfw(base64Data, mimeType) {
  if (!env.fal.apiKey) {
    logger.warn('[CharacterService] FAL_API_KEY not set — skipping NSFW check');
    return true;
  }

  logger.debug('[CharacterService] Running NSFW classification via fal.ai');
  const dataUrl = `data:${mimeType};base64,${base64Data}`;

  try {
    const result = await fal.run('fal-ai/imageutils/nsfw', {
      input: { image_url: dataUrl },
    });
    const nsfwProb = result?.nsfw_probability ?? 0;
    const safe = nsfwProb < NSFW_THRESHOLD;
    logger.debug('[CharacterService] NSFW classification result', { nsfwProbability: nsfwProb, threshold: NSFW_THRESHOLD, safe });
    return safe;
  } catch (err) {
    logger.error('[CharacterService] NSFW check failed', { error: err.message });
    throw new Error('Content moderation service unavailable. Please try again.');
  }
}

/**
 * Use Claude Haiku vision to confirm a human face is clearly visible.
 * Returns true if a face is detected.
 */
async function detectFace(base64Data, mimeType) {
  if (!env.anthropic.apiKey) {
    logger.warn('[CharacterService] ANTHROPIC_API_KEY not set — skipping face detection');
    return true;
  }

  logger.debug('[CharacterService] Running face detection via Claude Haiku vision');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64Data },
            },
            {
              type: 'text',
              text: 'Does this image contain a clearly visible human face? Reply with only YES or NO.',
            },
          ],
        },
      ],
    });
    const answer = response.content[0]?.text?.trim().toUpperCase() ?? '';
    const hasFace = answer.startsWith('YES');
    logger.debug('[CharacterService] Face detection result', { answer, hasFace });
    return hasFace;
  } catch (err) {
    logger.error('[CharacterService] Face detection failed', { error: err.message });
    throw new Error('Face detection service unavailable. Please try again.');
  }
}

/**
 * Upload a photo buffer to Supabase Storage.
 * Returns the public CDN URL.
 *
 * Path: {userId}/{storyId}/{role}-{uuid}.jpg
 */
async function uploadToStorage(buffer, mimeType, userId, storyId, role) {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/${storyId}/${role}-${uuidv4()}.${ext}`;

  logger.debug('[CharacterService] Uploading photo to Supabase Storage', { path, bytes: buffer.length, mimeType });

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    logger.error('[CharacterService] Storage upload failed', { path, error: error.message });
    throw new Error('Failed to store photo. Please try again.');
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  logger.info('[CharacterService] Photo uploaded to storage', { path, publicUrl: publicUrlData.publicUrl });
  return publicUrlData.publicUrl;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Validate, moderate, and upload a single character photo.
 * Returns the public Supabase Storage URL.
 *
 * @param {Buffer} buffer       - Raw file buffer from multer
 * @param {string} mimeType     - 'image/jpeg' | 'image/png'
 * @param {string} userId       - Authenticated user's ID
 * @param {string} storyId      - Story the character belongs to
 * @param {'main'|'secondary'}  role
 */
async function validateAndUploadPhoto(buffer, mimeType, userId, storyId, role) {
  logger.info('[CharacterService] Validating and uploading character photo', { userId, storyId, role, mimeType, bytes: buffer.length });

  const base64Data = buffer.toString('base64');

  // Run NSFW check and face detection concurrently
  logger.debug('[CharacterService] Running NSFW check and face detection concurrently', { role });
  const [isSafe, hasFace] = await Promise.all([
    checkNsfw(base64Data, mimeType),
    detectFace(base64Data, mimeType),
  ]);

  if (!isSafe) {
    logger.warn('[CharacterService] Photo rejected: NSFW content detected', { userId, storyId, role });
    const err = new Error('Photo contains inappropriate content and cannot be used.');
    err.statusCode = 422;
    err.code = 'NSFW_REJECTED';
    throw err;
  }

  if (!hasFace) {
    logger.warn('[CharacterService] Photo rejected: no face detected', { userId, storyId, role });
    const err = new Error('No clearly visible face detected. Please upload a photo with a clear face.');
    err.statusCode = 422;
    err.code = 'NO_FACE_DETECTED';
    throw err;
  }

  logger.debug('[CharacterService] Photo passed validation — proceeding to upload', { role });
  return uploadToStorage(buffer, mimeType, userId, storyId, role);
}

/**
 * Create two character records for a story.
 * Validates ownership, runs photo moderation, inserts DB rows.
 *
 * @param {string} userId
 * @param {string} storyId
 * @param {Array<{role:string, name:string, traits:string[]}>} characterMeta
 * @param {{ main: {buffer, mimeType}, secondary: {buffer, mimeType} }} photos
 * @returns {Promise<Array>} Inserted character rows
 */
async function createCharacters(userId, storyId, characterMeta, photos) {
  logger.info('[CharacterService] Creating characters for story', {
    userId,
    storyId,
    characters: characterMeta.map((m) => ({ role: m.role, name: m.name })),
  });

  // Verify the story belongs to this user
  const { data: story, error: storyErr } = await supabaseAdmin
    .from('stories')
    .select('id')
    .eq('id', storyId)
    .eq('user_id', userId)
    .single();

  if (storyErr || !story) {
    logger.warn('[CharacterService] Story ownership check failed', { userId, storyId });
    const err = new Error('Story not found or access denied.');
    err.statusCode = 404;
    throw err;
  }

  // Upload both photos concurrently (moderation runs inside)
  logger.info('[CharacterService] Uploading both character photos concurrently', { storyId });
  const [mainUrl, secondaryUrl] = await Promise.all([
    validateAndUploadPhoto(photos.main.buffer, photos.main.mimeType, userId, storyId, 'main'),
    validateAndUploadPhoto(photos.secondary.buffer, photos.secondary.mimeType, userId, storyId, 'secondary'),
  ]);

  logger.info('[CharacterService] Both photos uploaded', { storyId, mainUrl, secondaryUrl });

  const urlByRole = { main: mainUrl, secondary: secondaryUrl };

  // Build DB rows for both characters
  const rows = characterMeta.map((meta) => ({
    id: uuidv4(),
    story_id: storyId,
    name: meta.name,
    role: meta.role,
    photo_url: urlByRole[meta.role],
    traits: Array.isArray(meta.traits) ? meta.traits : [],
    emotions: { ...INITIAL_EMOTIONS },
    relationships: [],
    key_events: [],
    secrets: [],
    is_ai_generated: false,
    updated_at: new Date().toISOString(),
  }));

  logger.debug('[CharacterService] Inserting character rows into DB', { storyId, count: rows.length });

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('characters')
    .insert(rows)
    .select();

  if (insertErr) {
    logger.error('[CharacterService] DB insert failed', { storyId, error: insertErr.message });
    throw new Error('Failed to save characters. Please try again.');
  }

  logger.info('[CharacterService] Characters inserted into DB', {
    storyId,
    characterIds: inserted.map((c) => c.id),
  });

  return inserted;
}

/**
 * Fetch all characters (with full memory state) for a story.
 * Verifies the requesting user owns the story.
 *
 * @param {string} userId
 * @param {string} storyId
 * @returns {Promise<Array>} Character rows
 */
async function getCharactersForStory(userId, storyId) {
  logger.debug('[CharacterService] Fetching characters for story', { userId, storyId });

  // Verify ownership
  const { data: story, error: storyErr } = await supabaseAdmin
    .from('stories')
    .select('id')
    .eq('id', storyId)
    .eq('user_id', userId)
    .single();

  if (storyErr || !story) {
    logger.warn('[CharacterService] Story ownership check failed', { userId, storyId });
    const err = new Error('Story not found or access denied.');
    err.statusCode = 404;
    throw err;
  }

  const { data: characters, error } = await supabaseAdmin
    .from('characters')
    .select('*')
    .eq('story_id', storyId)
    .order('is_ai_generated', { ascending: true }) // user chars first
    .order('role', { ascending: true });

  if (error) {
    logger.error('[CharacterService] Failed to fetch characters', { userId, storyId, error: error.message });
    throw new Error('Failed to fetch characters.');
  }

  logger.debug('[CharacterService] Characters fetched', { storyId, count: characters?.length ?? 0 });
  return characters;
}

module.exports = { createCharacters, getCharactersForStory, validateAndUploadPhoto };
