'use strict';

const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');

const INITIAL_EMOTIONS = { love: 50, trust: 50, anger: 0, fear: 0, jealousy: 0 };

/**
 * Create both characters for a story.
 * Characters are described via a text appearance string (no photo upload).
 *
 * @param {string} userId
 * @param {string} storyId
 * @param {Array<{ role, name, traits, appearance }>} characterMeta
 */
async function createCharacters(userId, storyId, characterMeta) {
  logger.info('[CharacterService] Creating characters', {
    storyId, userId,
    characters: characterMeta.map((m) => `${m.role}="${m.name}"`).join(', '),
  });

  const { data: story, error: storyErr } = await supabaseAdmin
    .from('stories').select('id').eq('id', storyId).eq('user_id', userId).single();

  if (storyErr || !story) {
    logger.warn('[CharacterService] Story ownership check failed', { userId, storyId });
    throw Object.assign(new Error('Story not found or access denied.'), { statusCode: 404 });
  }

  const rows = characterMeta.map((meta) => ({
    id:             uuidv4(),
    story_id:       storyId,
    name:           meta.name,
    role:           meta.role,
    // photo_url stores the text appearance description for builder-created characters
    photo_url:      meta.appearance ?? null,
    traits:         Array.isArray(meta.traits) ? meta.traits : [],
    emotions:       { ...INITIAL_EMOTIONS },
    relationships:  [],
    key_events:     [],
    secrets:        [],
    is_ai_generated: false,
    updated_at:     new Date().toISOString(),
  }));

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('characters').insert(rows).select();

  if (insertErr) {
    logger.error('[CharacterService] DB insert failed', { storyId, error: insertErr.message });
    throw new Error('Failed to save characters. Please try again.');
  }

  logger.info('[CharacterService] Characters created', {
    storyId,
    count: inserted.length,
    names: inserted.map((c) => c.name),
  });

  return inserted;
}

async function getCharactersForStory(userId, storyId) {
  const { data: story, error: storyErr } = await supabaseAdmin
    .from('stories').select('id').eq('id', storyId).eq('user_id', userId).single();
  if (storyErr || !story) {
    throw Object.assign(new Error('Story not found or access denied.'), { statusCode: 404 });
  }

  const { data: characters, error } = await supabaseAdmin
    .from('characters').select('*').eq('story_id', storyId)
    .order('is_ai_generated', { ascending: true })
    .order('role', { ascending: true });

  if (error) throw new Error('Failed to fetch characters.');
  return characters;
}

module.exports = { createCharacters, getCharactersForStory };
