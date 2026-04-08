'use strict';

const TWIST_TYPES = ['Betrayal', 'Secret Revealed', 'Unexpected Arrival', 'Time Jump', 'Power Shift', 'Death'];

// Minimum scenes between twists
const TWIST_COOLDOWN = 4;

// Base probability per scene (increases with tension)
const BASE_TWIST_PROB = 0.08;

/**
 * Decide whether a twist should occur for the upcoming scene.
 * Returns a twist instruction string to inject into the scene prompt,
 * or null if no twist should occur.
 *
 * Rules (per PROJECT_BIBLE §3.6):
 *  - Never in scenes 1-3
 *  - Max 1 twist per 4 scenes
 *  - Probability increases with story_tension_score
 *  - Twist type is selected based on genre + emotional state
 *
 * @param {object}   story        - story row (genre, story_tension_score, current_scene_number)
 * @param {object[]} recentScenes - last ≤5 scene rows
 * @returns {string|null}
 */
function getTwistInstruction(story, recentScenes) {
  const sceneNum = (story.current_scene_number ?? 0) + 1;

  // Never in scenes 1-3
  if (sceneNum <= 3) return null;

  // Check cooldown — no twist if one occurred within the last TWIST_COOLDOWN scenes
  const recentTwist = recentScenes.some((s) => s.twist_occurred);
  if (recentTwist) return null;

  // Probability based on tension (0-100 → 0-1 scale) + base probability
  const tension = story.story_tension_score ?? 0;
  const prob = BASE_TWIST_PROB + (tension / 100) * 0.25; // max ~33% at full tension

  if (Math.random() > prob) return null;

  // Pick twist type weighted by genre
  const type = selectTwistType(story.genre, tension);
  return `Introduce a ${type} twist in this scene. Make it narratively coherent and surprising but not random.`;
}

function selectTwistType(genre, tension) {
  // Genre weights: some twists fit certain genres better
  const weights = {
    Romance:  ['Betrayal', 'Secret Revealed', 'Unexpected Arrival', 'Power Shift'],
    Thriller: ['Betrayal', 'Death', 'Secret Revealed', 'Power Shift'],
    Fantasy:  ['Power Shift', 'Unexpected Arrival', 'Death', 'Time Jump'],
    Horror:   ['Death', 'Secret Revealed', 'Betrayal', 'Unexpected Arrival'],
    Drama:    ['Secret Revealed', 'Betrayal', 'Death', 'Power Shift'],
    'Sci-Fi': ['Time Jump', 'Power Shift', 'Secret Revealed', 'Unexpected Arrival'],
  };

  const pool = weights[genre] ?? TWIST_TYPES;
  // Higher tension → prefer more dramatic twists (first in each list)
  const cutoff = tension > 60 ? Math.ceil(pool.length / 2) : pool.length;
  return pool[Math.floor(Math.random() * cutoff)];
}

module.exports = { getTwistInstruction };
