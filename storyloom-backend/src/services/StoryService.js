'use strict';

const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');
const { deductCredits, refundCredits, STORY_CREDIT_COSTS } = require('./CreditService');
const { createCharacters } = require('./CharacterService');

// ── Constants ─────────────────────────────────────────────────

const TOTAL_SCENES_BY_LENGTH = {
  short:  8,
  medium: 15,
  long:   () => Math.floor(Math.random() * 16) + 25, // 25–40
};

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

const VALID_LENGTHS    = ['short', 'medium', 'long'];
const VALID_GENRES     = ['Romance', 'Thriller', 'Fantasy', 'Horror', 'Drama', 'Sci-Fi', 'Surprise Me'];
const VALID_ART_STYLES = ['Cinematic', 'Realistic', 'Anime', 'Illustrated', 'Comic Book', 'AI Decides'];

// ── Helpers ───────────────────────────────────────────────────

function totalScenes(length) {
  const v = TOTAL_SCENES_BY_LENGTH[length];
  return typeof v === 'function' ? v() : v;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Create a new story and its two characters in a single atomic flow.
 *
 * Flow:
 *   1. Validate input
 *   2. Deduct credits (optimistic lock)
 *   3. Insert story row
 *   4. Upload photos + insert character rows (CharacterService)
 *   5. On any failure after step 2 → refund + clean up
 *
 * @param {string} userId
 * @param {object} wizardData - { genre, setting, tone, length, art_style }
 * @param {Array<{role, name, traits}>} characterMeta
 * @param {{ main: {buffer, mimeType}, secondary: {buffer, mimeType} }} photos
 * @returns {Promise<{ story, characters }>}
 */
async function createStory(userId, wizardData, characterMeta, photos) {
  const { genre, setting, tone, length, art_style } = wizardData;

  logger.info('[StoryService] Creating new story', { userId, genre, setting, tone, length, art_style });

  // ── 1. Validate ───────────────────────────────────────────
  if (!VALID_LENGTHS.includes(length)) {
    logger.warn('[StoryService] Invalid story length', { userId, length });
    throw Object.assign(new Error('Invalid story length.'), { statusCode: 400 });
  }
  if (!genre || !setting || !tone || !art_style) {
    logger.warn('[StoryService] Missing required wizard fields', { userId, genre, setting, tone, art_style });
    throw Object.assign(new Error('genre, setting, tone and art_style are all required.'), { statusCode: 400 });
  }

  const cost = STORY_CREDIT_COSTS[length];
  const scenes = totalScenes(length);
  const storyId = uuidv4();

  logger.info('[StoryService] Story parameters resolved', { userId, storyId, cost, totalScenes: scenes });

  // ── 2. Deduct credits ─────────────────────────────────────
  logger.info('[StoryService] Deducting credits for story creation', { userId, storyId, amount: cost });
  await deductCredits(
    userId,
    cost,
    `${length.charAt(0).toUpperCase() + length.slice(1)} story started`,
    storyId
  );
  logger.info('[StoryService] Credits deducted successfully', { userId, storyId, amount: cost });

  // ── 3. Insert story row ───────────────────────────────────
  let story;
  try {
    logger.debug('[StoryService] Inserting story row into DB', { storyId });
    const { data, error } = await supabaseAdmin
      .from('stories')
      .insert({
        id: storyId,
        user_id: userId,
        genre,
        setting,
        tone,
        art_style,
        total_scenes: scenes,
        current_scene_number: 0,
        status: 'active',
        credits_spent: cost,
        is_favourite: false,
        expires_at: new Date(Date.now() + TEN_DAYS_MS).toISOString(),
        story_tension_score: 0,
      })
      .select()
      .single();

    if (error) throw error;
    story = data;
    logger.info('[StoryService] Story row inserted', { storyId, userId });
  } catch (err) {
    logger.error('[StoryService] Story insert failed — refunding credits', { storyId, userId, error: err.message });
    await refundCredits(userId, cost, 'Refund: story creation failed', storyId);
    throw Object.assign(new Error('Failed to create story. Credits have been refunded.'), { statusCode: 500 });
  }

  // ── 4. Upload photos + create characters ──────────────────
  let characters;
  try {
    logger.info('[StoryService] Creating characters and uploading photos', { storyId, userId });
    characters = await createCharacters(userId, storyId, characterMeta, photos);
    logger.info('[StoryService] Characters created successfully', {
      storyId,
      characterCount: characters.length,
      names: characters.map((c) => c.name),
    });
  } catch (err) {
    logger.error('[StoryService] Character creation failed — refunding credits and deleting story', {
      storyId,
      userId,
      error: err.message,
    });
    await refundCredits(userId, cost, 'Refund: character upload failed', storyId);
    await supabaseAdmin.from('stories').delete().eq('id', storyId);
    // Re-throw known validation errors (NSFW, no face) directly
    if (err.statusCode === 422) throw err;
    throw Object.assign(new Error('Failed to upload character photos. Credits have been refunded.'), { statusCode: 500 });
  }

  logger.info('[StoryService] Story creation complete', { storyId, userId, genre, length, totalScenes: scenes });
  return { story, characters };
}

/**
 * List all non-abandoned stories for a user, newest first.
 * Includes characters for each story.
 */
async function getUserStories(userId) {
  logger.debug('[StoryService] Fetching stories for user', { userId });

  const { data: stories, error } = await supabaseAdmin
    .from('stories')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'abandoned')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('[StoryService] Failed to fetch user stories', { userId, error: error.message });
    throw new Error('Failed to fetch stories.');
  }

  if (!stories.length) {
    logger.debug('[StoryService] No stories found for user', { userId });
    return [];
  }

  // Batch-load characters for all stories
  const storyIds = stories.map((s) => s.id);
  const { data: characters } = await supabaseAdmin
    .from('characters')
    .select('*')
    .in('story_id', storyIds)
    .eq('is_ai_generated', false);

  // Group by story_id
  const charMap = {};
  for (const c of characters ?? []) {
    (charMap[c.story_id] ??= []).push(c);
  }

  logger.debug('[StoryService] Stories fetched', { userId, count: stories.length });
  return stories.map((s) => ({ ...s, characters: charMap[s.id] ?? [] }));
}

/**
 * Get a single story with its characters.
 * Verifies the requesting user owns it.
 */
async function getStory(userId, storyId) {
  logger.debug('[StoryService] Fetching story', { userId, storyId });

  const { data: story, error } = await supabaseAdmin
    .from('stories')
    .select('*')
    .eq('id', storyId)
    .eq('user_id', userId)
    .neq('status', 'abandoned')
    .single();

  if (error || !story) {
    logger.warn('[StoryService] Story not found or access denied', { userId, storyId });
    throw Object.assign(new Error('Story not found.'), { statusCode: 404 });
  }

  const { data: characters } = await supabaseAdmin
    .from('characters')
    .select('*')
    .eq('story_id', storyId)
    .order('is_ai_generated', { ascending: true });

  logger.debug('[StoryService] Story fetched', { storyId, characterCount: characters?.length ?? 0 });
  return { ...story, characters: characters ?? [] };
}

/**
 * Mark a story as abandoned.
 * No credit refund — per product rules.
 */
async function abandonStory(userId, storyId) {
  logger.info('[StoryService] Abandoning story', { userId, storyId });

  const { error } = await supabaseAdmin
    .from('stories')
    .update({ status: 'abandoned', completed_at: new Date().toISOString() })
    .eq('id', storyId)
    .eq('user_id', userId);

  if (error) {
    logger.error('[StoryService] Failed to abandon story', { userId, storyId, error: error.message });
    throw new Error('Failed to abandon story.');
  }

  logger.info('[StoryService] Story abandoned', { userId, storyId });
}

/**
 * Toggle the is_favourite flag.
 * Favourited stories get expires_at = null (kept forever).
 * Un-favourited stories get expires_at = now + 10 days.
 */
async function toggleFavourite(userId, storyId) {
  logger.debug('[StoryService] Toggling favourite', { userId, storyId });

  // Fetch current value
  const { data: story, error: fetchErr } = await supabaseAdmin
    .from('stories')
    .select('is_favourite')
    .eq('id', storyId)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !story) {
    logger.warn('[StoryService] Story not found for favourite toggle', { userId, storyId });
    throw Object.assign(new Error('Story not found.'), { statusCode: 404 });
  }

  const newFavourite = !story.is_favourite;
  const newExpiresAt = newFavourite ? null : new Date(Date.now() + TEN_DAYS_MS).toISOString();

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('stories')
    .update({ is_favourite: newFavourite, expires_at: newExpiresAt })
    .eq('id', storyId)
    .eq('user_id', userId)
    .select()
    .single();

  if (updateErr) {
    logger.error('[StoryService] Failed to update favourite', { userId, storyId, error: updateErr.message });
    throw new Error('Failed to update favourite.');
  }

  logger.info('[StoryService] Favourite toggled', { userId, storyId, isFavourite: newFavourite });
  return updated;
}

module.exports = { createStory, getUserStories, getStory, abandonStory, toggleFavourite };
