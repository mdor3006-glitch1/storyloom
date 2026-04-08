'use strict';

const { supabaseAdmin } = require('../config/supabase');

/**
 * Fetch all characters for a story with their full memory state.
 * @param {string} storyId
 * @returns {Promise<object[]>}
 */
async function getCharacterMemory(storyId) {
  const { data, error } = await supabaseAdmin
    .from('characters')
    .select('*')
    .eq('story_id', storyId)
    .order('is_ai_generated', { ascending: true });

  if (error) throw new Error(`Failed to load character memory: ${error.message}`);
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
  if (!entries.length) return;

  // Fetch current character rows
  const characters = await getCharacterMemory(storyId);
  const charMap = Object.fromEntries(characters.map((c) => [c.name.toLowerCase(), c]));

  await Promise.all(
    entries.map(async ([name, updates]) => {
      const char = charMap[name.toLowerCase()];
      if (!char) return; // ignore updates for unknown characters

      const patch = {};

      if (updates.emotions && typeof updates.emotions === 'object') {
        // Clamp all emotion values to 0-100
        patch.emotions = {};
        for (const [k, v] of Object.entries(updates.emotions)) {
          patch.emotions[k] = Math.max(0, Math.min(100, Number(v) || 0));
        }
      }

      if (Array.isArray(updates.key_events) && updates.key_events.length > 0) {
        // Append new events, keep last 20 total to prevent unbounded growth
        const existing = char.key_events ?? [];
        patch.key_events = [...existing, ...updates.key_events].slice(-20);
      }

      if (Array.isArray(updates.secrets) && updates.secrets.length > 0) {
        const existing = char.secrets ?? [];
        patch.secrets = [...existing, ...updates.secrets].slice(-10);
      }

      if (Object.keys(patch).length === 0) return;

      patch.updated_at = new Date().toISOString();

      await supabaseAdmin
        .from('characters')
        .update(patch)
        .eq('id', char.id);
    })
  );
}

/**
 * Update the story_tension_score on the stories row.
 * @param {string} storyId
 * @param {number} tensionScore - 0-100
 */
async function updateTensionScore(storyId, tensionScore) {
  await supabaseAdmin
    .from('stories')
    .update({ story_tension_score: Math.max(0, Math.min(100, tensionScore)) })
    .eq('id', storyId);
}

module.exports = { getCharacterMemory, applyMemoryUpdates, updateTensionScore };
