'use strict';

const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');

/**
 * Fetch all characters for a story with their full memory state.
 * @param {string} storyId
 * @returns {Promise<object[]>}
 */
async function getCharacterMemory(storyId) {
  logger.debug('[MemoryService] Loading character memory', { storyId });

  const { data, error } = await supabaseAdmin
    .from('characters')
    .select('*')
    .eq('story_id', storyId)
    .order('is_ai_generated', { ascending: true });

  if (error) {
    logger.error('[MemoryService] Failed to load character memory', { storyId, error: error.message });
    throw new Error(`Failed to load character memory: ${error.message}`);
  }

  logger.debug('[MemoryService] Character memory loaded', { storyId, characterCount: data?.length ?? 0 });
  return data ?? [];
}

/**
 * Apply the memory_updates map from a scene AI response to the DB.
 * Updates emotions and appends to key_events for each named character.
 *
 * memory_updates shape (from SceneService):
 * {
 *   "<character_name>": {
 *     "emotions": { love, trust, anger, fear, jealousy },
 *     "key_events": ["event description"]
 *   }
 * }
 *
 * @param {string} storyId
 * @param {object} memoryUpdates - keyed by character name
 */
async function applyMemoryUpdates(storyId, memoryUpdates) {
  if (!memoryUpdates || typeof memoryUpdates !== 'object') return;

  const entries = Object.entries(memoryUpdates);
  if (!entries.length) {
    logger.debug('[MemoryService] No memory updates to apply', { storyId });
    return;
  }

  logger.info('[MemoryService] Applying memory updates', {
    storyId,
    characters: entries.map(([name]) => name),
  });

  // Fetch current character rows
  const characters = await getCharacterMemory(storyId);
  const charMap = Object.fromEntries(characters.map((c) => [c.name.toLowerCase(), c]));

  await Promise.all(
    entries.map(async ([name, updates]) => {
      const char = charMap[name.toLowerCase()];
      if (!char) {
        logger.warn('[MemoryService] Memory update for unknown character — skipping', { storyId, name });
        return;
      }

      const patch = {};

      if (updates.emotions && typeof updates.emotions === 'object') {
        // Clamp all emotion values to 0-100
        patch.emotions = {};
        for (const [k, v] of Object.entries(updates.emotions)) {
          patch.emotions[k] = Math.max(0, Math.min(100, Number(v) || 0));
        }
        logger.debug('[MemoryService] Emotion update', { storyId, character: name, emotions: patch.emotions });
      }

      if (Array.isArray(updates.key_events) && updates.key_events.length > 0) {
        // Append new events, keep last 20 total to prevent unbounded growth
        const existing = char.key_events ?? [];
        patch.key_events = [...existing, ...updates.key_events].slice(-20);
        logger.debug('[MemoryService] Key events appended', {
          storyId,
          character: name,
          newEvents: updates.key_events,
          totalEvents: patch.key_events.length,
        });
      }

      if (Array.isArray(updates.secrets) && updates.secrets.length > 0) {
        const existing = char.secrets ?? [];
        patch.secrets = [...existing, ...updates.secrets].slice(-10);
        logger.debug('[MemoryService] Secrets updated', { storyId, character: name, secretCount: patch.secrets.length });
      }

      if (Object.keys(patch).length === 0) return;

      patch.updated_at = new Date().toISOString();

      const { error } = await supabaseAdmin
        .from('characters')
        .update(patch)
        .eq('id', char.id);

      if (error) {
        logger.error('[MemoryService] Failed to update character memory', { storyId, character: name, error: error.message });
      } else {
        logger.debug('[MemoryService] Character memory updated in DB', { storyId, character: name });
      }
    })
  );

  logger.info('[MemoryService] Memory updates applied', { storyId, characterCount: entries.length });
}

/**
 * Update the story_tension_score on the stories row.
 * @param {string} storyId
 * @param {number} tensionScore - 0-100
 */
async function updateTensionScore(storyId, tensionScore) {
  const clamped = Math.max(0, Math.min(100, tensionScore));
  logger.debug('[MemoryService] Updating story tension score', { storyId, tensionScore: clamped });

  const { error } = await supabaseAdmin
    .from('stories')
    .update({ story_tension_score: clamped })
    .eq('id', storyId);

  if (error) {
    logger.error('[MemoryService] Failed to update tension score', { storyId, error: error.message });
  }
}

module.exports = { getCharacterMemory, applyMemoryUpdates, updateTensionScore };
