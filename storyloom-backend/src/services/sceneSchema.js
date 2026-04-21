'use strict';

/**
 * STAGE v2 scene schema validator.
 *
 * Handrolled to avoid new dependencies. Validates the AI's scene response
 * and detects spoiler leaks in filler_dialogue.
 */

const VALID_EMOTIONS  = new Set(['love','anger','sad','surprise','happy','tense','neutral','twist']);
const VALID_TIME      = new Set(['morning','afternoon','evening','night']);
const VALID_WEATHER   = new Set(['clear','cloudy','rain','storm','snow','fog']);
const VALID_TWIST     = new Set(['Betrayal','Secret Revealed','Unexpected Arrival','Time Jump','Power Shift','Death']);
const VALID_ENDING    = new Set(['happy','tragic','twist','secret']);
const VALID_SCENE_TYP = new Set(['A','B']);

const SCHEMA_VERSION = 2;

function isStr(v) { return typeof v === 'string'; }
function isArr(v) { return Array.isArray(v); }
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function isBool(v) { return typeof v === 'boolean'; }
function isNum(v) { return typeof v === 'number' && !Number.isNaN(v); }

/**
 * Validate scene data. Returns { valid, errors[] }.
 * Does not mutate input.
 */
function validateScene(scene, { sceneNumber, isFinalScene }) {
  const errors = [];

  if (!isObj(scene)) return { valid: false, errors: ['scene is not an object'] };

  // Scene type & derived
  if (!VALID_SCENE_TYP.has(scene.scene_type)) {
    errors.push(`scene_type must be 'A' or 'B' (got ${JSON.stringify(scene.scene_type)})`);
  }
  if (!isBool(scene.can_text_input)) {
    errors.push('can_text_input must be boolean');
  } else if (scene.scene_type && scene.can_text_input !== (scene.scene_type === 'A')) {
    errors.push(`can_text_input must equal (scene_type === 'A'); got ${scene.can_text_input} for type ${scene.scene_type}`);
  }

  // Scene text
  if (!isStr(scene.scene_text) || !scene.scene_text.trim()) {
    errors.push('scene_text missing or empty');
  }

  // Dialogue
  if (!isArr(scene.dialogue) || scene.dialogue.length < 2) {
    errors.push('dialogue must be a non-empty array (>=2 lines)');
  } else {
    scene.dialogue.forEach((d, i) => {
      if (!isStr(d.character)) errors.push(`dialogue[${i}].character missing`);
      if (!isStr(d.line) || !d.line.trim()) errors.push(`dialogue[${i}].line missing`);
      if (d.emotion && !VALID_EMOTIONS.has(d.emotion)) {
        errors.push(`dialogue[${i}].emotion invalid: ${d.emotion}`);
      }
    });
  }

  // Choices (2 required unless final scene)
  if (!isArr(scene.choices) || scene.choices.length !== 2) {
    if (!isFinalScene) errors.push(`choices must be exactly 2 (got ${scene.choices?.length})`);
  }

  // Choice hints
  if (!isArr(scene.choice_hints) || scene.choice_hints.length !== 2) {
    if (!isFinalScene) errors.push('choice_hints must be exactly 2');
  }

  // Filler dialogue (required for non-final scenes)
  if (!isFinalScene) {
    if (!isArr(scene.filler_dialogue) || scene.filler_dialogue.length < 3) {
      errors.push('filler_dialogue must have at least 3 entries');
    } else {
      scene.filler_dialogue.forEach((d, i) => {
        if (!isStr(d.character)) errors.push(`filler_dialogue[${i}].character missing`);
        if (!isStr(d.line) || !d.line.trim()) errors.push(`filler_dialogue[${i}].line missing`);
        if (d.emotion && !VALID_EMOTIONS.has(d.emotion)) {
          errors.push(`filler_dialogue[${i}].emotion invalid: ${d.emotion}`);
        }
        if (d.beat_ms !== undefined && (!isNum(d.beat_ms) || d.beat_ms < 200 || d.beat_ms > 4000)) {
          errors.push(`filler_dialogue[${i}].beat_ms must be 200..4000 ms`);
        }
      });
    }
  }

  // image_prompt
  if (!isStr(scene.image_prompt) || !scene.image_prompt.trim()) {
    errors.push('image_prompt missing');
  }

  // Optional enums
  if (scene.time_of_day && !VALID_TIME.has(scene.time_of_day)) {
    errors.push(`time_of_day invalid: ${scene.time_of_day}`);
  }
  if (scene.weather && !VALID_WEATHER.has(scene.weather)) {
    errors.push(`weather invalid: ${scene.weather}`);
  }
  if (scene.twist_type && !VALID_TWIST.has(scene.twist_type)) {
    errors.push(`twist_type invalid: ${scene.twist_type}`);
  }
  if (scene.ending_type && !VALID_ENDING.has(scene.ending_type)) {
    errors.push(`ending_type invalid: ${scene.ending_type}`);
  }

  // tension
  if (scene.story_tension_score !== undefined &&
      (!isNum(scene.story_tension_score) || scene.story_tension_score < 0 || scene.story_tension_score > 100)) {
    errors.push('story_tension_score must be 0..100');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Detect spoiler leak — filler_dialogue must NOT contain unique tokens
 * from either choice. Heuristic: tokenize choices, strip stopwords and
 * short words, require ≥ 1 distinctive token per choice, then check
 * filler for any of those tokens.
 *
 * Returns { clean, offending[] } — offending lists the filler index +
 * leaked tokens when not clean.
 */
const STOPWORDS = new Set([
  'the','a','an','and','or','but','so','to','of','in','on','at','with','by',
  'for','from','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','can',
  'go','goes','going','went','i','you','he','she','it','we','they','them',
  'your','my','his','her','their','our','me','us','him',
  'that','this','these','those','what','how','why','where','when','who',
  'into','onto','as','if','then','else','not','no','yes','up','down','out',
  'new','some','any','all','each','every','own','too','very','more','most',
  'just','even','much','still','get','got','let','keep','take','make','say','said',
  'like','about','over','under','after','before','while','during',
]);

function tokenize(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(Boolean);
}

function distinctiveTokens(choice) {
  return tokenize(choice).filter(w => w.length >= 4 && !STOPWORDS.has(w));
}

function detectSpoilers(scene) {
  if (!Array.isArray(scene.filler_dialogue) || !Array.isArray(scene.choices)) {
    return { clean: true, offending: [] };
  }

  const tokensPerChoice = scene.choices.map(distinctiveTokens);
  // Union of tokens from both choices (branch-agnostic filler would use neither)
  const banned = new Set(tokensPerChoice.flat());
  if (!banned.size) return { clean: true, offending: [] };

  const offending = [];
  scene.filler_dialogue.forEach((d, i) => {
    const fillerTokens = tokenize(d.line ?? '');
    const leaked = fillerTokens.filter(t => banned.has(t));
    if (leaked.length) offending.push({ index: i, tokens: leaked, line: d.line });
  });

  return { clean: offending.length === 0, offending };
}

module.exports = {
  SCHEMA_VERSION,
  validateScene,
  detectSpoilers,
};
