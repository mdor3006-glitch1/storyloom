'use strict';

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { createCharacters, getCharactersForStory } = require('../services/CharacterService');

const router = Router();

// ── POST /characters ──────────────────────────────────────────
// Creates two character records for a story.
// Body JSON:
//   story_id, main_name, main_appearance, secondary_name, secondary_appearance
//   main_traits / secondary_traits  (optional JSON arrays)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const {
      story_id,
      main_name, main_traits, main_appearance,
      secondary_name, secondary_traits, secondary_appearance,
    } = req.body;

    if (!story_id)             return res.status(400).json({ error: 'story_id is required.' });
    if (!main_name?.trim())    return res.status(400).json({ error: 'main_name is required.' });
    if (!secondary_name?.trim()) return res.status(400).json({ error: 'secondary_name is required.' });

    let parsedMainTraits = [], parsedSecondaryTraits = [];
    try {
      if (main_traits)      parsedMainTraits      = JSON.parse(main_traits);
      if (secondary_traits) parsedSecondaryTraits = JSON.parse(secondary_traits);
    } catch {
      return res.status(400).json({ error: 'traits must be a valid JSON array.' });
    }

    const characters = await createCharacters(
      req.userId,
      story_id,
      [
        {
          role:       'main',
          name:       main_name.trim().slice(0, 20),
          traits:     parsedMainTraits.slice(0, 3),
          appearance: main_appearance?.trim() ?? null,
        },
        {
          role:       'secondary',
          name:       secondary_name.trim().slice(0, 20),
          traits:     parsedSecondaryTraits.slice(0, 3),
          appearance: secondary_appearance?.trim() ?? null,
        },
      ]
    );

    return res.status(201).json({ characters });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// ── GET /characters/:story_id ─────────────────────────────────
router.get('/:story_id', requireAuth, async (req, res, next) => {
  try {
    const characters = await getCharactersForStory(req.userId, req.params.story_id);
    return res.json({ characters });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
