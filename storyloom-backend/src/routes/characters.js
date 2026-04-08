'use strict';

const { Router } = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { createCharacters, getCharactersForStory } = require('../services/CharacterService');

// Store uploads in memory — streamed directly to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

// ── POST /characters ──────────────────────────────────────────
// Creates two character records for a story.
// Expects multipart/form-data:
//   story_id        string  (required)
//   main_name       string  (required)
//   main_traits     JSON string array e.g. '["Brave","Kind"]'  (optional)
//   secondary_name  string  (required)
//   secondary_traits JSON string array  (optional)
//   main_photo      file    (required, JPG/PNG ≤5MB)
//   secondary_photo file    (required, JPG/PNG ≤5MB)
router.post(
  '/',
  requireAuth,
  upload.fields([
    { name: 'main_photo',      maxCount: 1 },
    { name: 'secondary_photo', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const { story_id, main_name, main_traits, secondary_name, secondary_traits } = req.body;

      // ── Input validation ──────────────────────────────────
      if (!story_id) {
        return res.status(400).json({ error: 'story_id is required.' });
      }
      if (!main_name?.trim()) {
        return res.status(400).json({ error: 'main_name is required.' });
      }
      if (!secondary_name?.trim()) {
        return res.status(400).json({ error: 'secondary_name is required.' });
      }

      const mainFile      = req.files?.main_photo?.[0];
      const secondaryFile = req.files?.secondary_photo?.[0];

      if (!mainFile) {
        return res.status(400).json({ error: 'main_photo is required.' });
      }
      if (!secondaryFile) {
        return res.status(400).json({ error: 'secondary_photo is required.' });
      }

      // Parse optional traits arrays
      let parsedMainTraits      = [];
      let parsedSecondaryTraits = [];
      try {
        if (main_traits)      parsedMainTraits      = JSON.parse(main_traits);
        if (secondary_traits) parsedSecondaryTraits = JSON.parse(secondary_traits);
      } catch {
        return res.status(400).json({ error: 'traits must be a valid JSON array.' });
      }

      // ── Delegate to service ───────────────────────────────
      const characters = await createCharacters(
        req.userId,
        story_id,
        [
          { role: 'main',      name: main_name.trim().slice(0, 20),      traits: parsedMainTraits.slice(0, 3) },
          { role: 'secondary', name: secondary_name.trim().slice(0, 20), traits: parsedSecondaryTraits.slice(0, 3) },
        ],
        {
          main:      { buffer: mainFile.buffer,      mimeType: mainFile.mimetype },
          secondary: { buffer: secondaryFile.buffer, mimeType: secondaryFile.mimetype },
        }
      );

      return res.status(201).json({ characters });
    } catch (err) {
      // Surface known validation errors as 422 directly
      if (err.statusCode === 422) {
        return res.status(422).json({ error: err.message, code: err.code });
      }
      next(err);
    }
  }
);

// ── GET /characters/:story_id ─────────────────────────────────
// Returns all characters + full memory state for a story.
// Only the story's owner may call this.
router.get('/:story_id', requireAuth, async (req, res, next) => {
  try {
    const characters = await getCharactersForStory(req.userId, req.params.story_id);
    return res.json({ characters });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
