'use strict';

/**
 * Zero-deps tests for sceneSchema (validation + spoiler detection).
 * Run via `node src/services/sceneSchema.test.js` from storyloom-backend/.
 */

const assert = require('node:assert');
const { validateScene, detectSpoilers } = require('./sceneSchema');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

// ── Fixtures ──────────────────────────────────────────────────

function validSceneB() {
  return {
    schema_version: 2,
    scene_number: 2,
    scene_type: 'B',
    can_text_input: false,
    scene_text: 'Sarah grips the wheel. The city blurs past her window.',
    dialogue: [
      { character: 'Sarah', line: 'We need to keep moving.', emotion: 'tense' },
      { character: 'Jake',  line: 'I know, I know.',          emotion: 'neutral' },
      { character: 'Sarah', line: 'They are still behind us.', emotion: 'tense' },
      { character: 'Jake',  line: 'Hold on tight.',            emotion: 'tense' },
    ],
    choices: ['Take the highway exit', 'Cut through the alleyway'],
    choice_hints: ['Safer but slower escape.', 'Riskier shortcut.'],
    choice_reaction: { emoji: '😰', character: 'secondary' },
    filler_dialogue: [
      { character: 'Sarah', line: 'God, my heart.', emotion: 'tense', beat_ms: 900 },
      { character: 'Jake',  line: 'Are you okay?',  emotion: 'neutral', beat_ms: 800 },
      { character: 'Sarah', line: 'Just breathe.',  emotion: 'neutral', beat_ms: 1000 },
    ],
    image_prompt: 'Sarah driving, city blur, night, intense expression.',
    twist_occurred: false,
    twist_type: null,
    story_tension_score: 65,
    time_of_day: 'night',
    weather: 'clear',
    is_final_scene: false,
    ending_type: null,
    best_quote: 'They are still behind us.',
  };
}

// ── Tests ─────────────────────────────────────────────────────

console.log('sceneSchema tests:');

test('validates a correct Type B scene', () => {
  const r = validateScene(validSceneB(), { sceneNumber: 2, isFinalScene: false });
  assert.strictEqual(r.valid, true, `expected valid, got: ${r.errors?.join(', ')}`);
});

test('rejects invalid scene_type', () => {
  const s = validSceneB(); s.scene_type = 'C';
  const r = validateScene(s, { sceneNumber: 2, isFinalScene: false });
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('scene_type')));
});

test('auto-fixes can_text_input mismatch with scene_type', () => {
  const s = validSceneB(); s.can_text_input = true; // wrong for type B
  const r = validateScene(s, { sceneNumber: 2, isFinalScene: false });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(s.can_text_input, false); // coerced back to match type B
});

test('requires filler_dialogue on non-final scenes', () => {
  const s = validSceneB(); s.filler_dialogue = [];
  const r = validateScene(s, { sceneNumber: 2, isFinalScene: false });
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('filler_dialogue')));
});

test('does not require filler on final scenes', () => {
  const s = validSceneB();
  s.is_final_scene = true;
  s.filler_dialogue = [];
  s.scene_type = 'A';
  s.can_text_input = true;
  const r = validateScene(s, { sceneNumber: 8, isFinalScene: true });
  assert.strictEqual(r.valid, true, `got: ${r.errors?.join(', ')}`);
});

test('coerces unknown emotion to neutral', () => {
  const s = validSceneB();
  s.dialogue[0].emotion = 'sus';
  const r = validateScene(s, { sceneNumber: 2, isFinalScene: false });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(s.dialogue[0].emotion, 'neutral');
});

test('aliases creative emotions to whitelist (reflective -> neutral)', () => {
  const s = validSceneB();
  s.filler_dialogue[2].emotion = 'reflective';
  const r = validateScene(s, { sceneNumber: 2, isFinalScene: false });
  assert.strictEqual(r.valid, true, `got: ${r.errors?.join(', ')}`);
  assert.strictEqual(s.filler_dialogue[2].emotion, 'neutral');
});

test('aliases anxious -> tense', () => {
  const s = validSceneB();
  s.filler_dialogue[0].emotion = 'anxious';
  const r = validateScene(s, { sceneNumber: 2, isFinalScene: false });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(s.filler_dialogue[0].emotion, 'tense');
});

test('clamps beat_ms outside 200..4000 instead of rejecting', () => {
  const s = validSceneB();
  s.filler_dialogue[0].beat_ms = 50;
  const r = validateScene(s, { sceneNumber: 2, isFinalScene: false });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(s.filler_dialogue[0].beat_ms, 200);
});

test('soft-coerces unknown time_of_day to null', () => {
  const s = validSceneB();
  s.time_of_day = 'twilight';
  const r = validateScene(s, { sceneNumber: 2, isFinalScene: false });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(s.time_of_day, null);
});

test('detects spoiler with 2+ distinctive tokens from same choice', () => {
  const s = validSceneB();
  s.filler_dialogue[0].line = 'The highway exit is close.';
  const r = detectSpoilers(s);
  assert.strictEqual(r.clean, false);
  assert.strictEqual(r.offending[0].reason, 'multi_overlap');
});

test('detects spoiler with 3-word phrase match', () => {
  const s = validSceneB();
  s.choices = ['We take the highway exit', 'Cut through the alleyway'];
  s.filler_dialogue[0].line = "Okay, take the highway right now.";
  const r = detectSpoilers(s);
  assert.strictEqual(r.clean, false);
  assert.strictEqual(r.offending[0].reason, 'phrase_match');
});

test('does NOT flag single common-word overlap (everything)', () => {
  const s = validSceneB();
  s.choices = ['Tell her everything now', 'Keep the secret'];
  s.filler_dialogue[0].line = "I can't believe everything.";
  const r = detectSpoilers(s);
  assert.strictEqual(r.clean, true);
});

test('does NOT flag single content-word overlap (highway)', () => {
  const s = validSceneB();
  s.filler_dialogue[0].line = 'The highway is far away.';
  const r = detectSpoilers(s);
  assert.strictEqual(r.clean, true);
});

test('passes clean branch-agnostic filler', () => {
  const s = validSceneB();
  const r = detectSpoilers(s);
  assert.strictEqual(r.clean, true);
});

test('ignores short stopword overlap', () => {
  const s = validSceneB();
  s.filler_dialogue[1].line = 'The the the the the.';
  const r = detectSpoilers(s);
  assert.strictEqual(r.clean, true);
});

// ── Summary ───────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
