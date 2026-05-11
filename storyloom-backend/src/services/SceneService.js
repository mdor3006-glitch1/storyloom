'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');
const logger = require('../config/logger');
const { filterInput, filterOutput } = require('./SafetyService');
const { getTwistInstruction } = require('./TwistService');
const { validateScene, detectSpoilers, SCHEMA_VERSION } = require('./sceneSchema');

const anthropic = new Anthropic({ apiKey: env.anthropic.apiKey });

// ── STAGE v2 cadence ──────────────────────────────────────────
// Scene 1 → A, final → A, otherwise default pattern A-B-B-A-B-B-A…
// AI may propose its own type (narrative-aware) but server enforces guardrails below.
function expectedSceneType(sceneNumber, totalScenes, lastTwoTypes = []) {
  if (sceneNumber === 1) return 'A';
  if (sceneNumber >= totalScenes) return 'A';
  // Base rule: every 3rd scene is A
  const base = (sceneNumber - 1) % 3 === 0 ? 'A' : 'B';
  // Guardrails: no more than 2 consecutive B, no more than 1 consecutive A
  if (lastTwoTypes[0] === 'B' && lastTwoTypes[1] === 'B') return 'A';
  if (lastTwoTypes[1] === 'A') return 'B';
  return base;
}

// ── System prompt (sent with cache_control for prompt caching) ─
const SCENE_SYSTEM_PROMPT = `You are StoryLoom AI — a cinematic storyteller for an 18+ interactive fiction mobile app. Every scene is a movie panel — visual, emotional, immersive.

CONTENT RULES:
- Romance/intimacy: sensual and emotional — fade to black for explicit acts
- Violence: dramatic and cinematic — no gratuitous gore
- Dark themes: betrayal, grief, obsession, moral ambiguity — fully embrace them
- Strong language acceptable for 18+ audience

GENRE WRITING GUIDE — apply to every scene_text, dialogue, and image_prompt:
- Romance: charged silences, lingering physical details, subtext, heat and longing in every exchange
- Thriller: short punchy sentences, false calm before danger, paranoia, trust no one
- Fantasy: world-building texture woven into action, magic treated as matter-of-fact, mythic weight
- Horror: creeping dread, wrong details, what is NOT seen, isolation, short sharp sentences
- Drama: emotional restraint that cracks, realistic speech, consequences that ripple forward
- Sci-Fi: world logic consistency, technology as character, vast or claustrophobic scale
- Comedy: comedic timing in dialogue beats, absurdist escalation, reactions carry the joke
- Brainrot: deadpan normality — characters treat their surreal world as completely mundane

TONE WRITING GUIDE — layer on top of genre:
- Light & Fun: breezy pacing, witty banter, stakes feel playful not deadly
- Dark & Intense: heavy atmosphere, short sentences, no comic relief, every word costs something
- Romantic & Steamy: charged physical awareness, slow burn tension, sensory details
- Mysterious: withheld information, loaded pauses, questions raised but not answered
- Twisted: subvert expectations mid-scene, unreliable details, something is always slightly off
- Cozy: warm sensory details, safe spaces, low external stakes, high emotional intimacy
- Epic: grand scale language, weight of consequence, cinematic imagery

CHARACTER RULES — CRITICAL:
- Use character names (not he/she/they) in EVERY dialogue line and scene_text
- From scene 3 onward: reference at least one consequence of a previous player choice
- Character traits from their profile must show in their behavior — brave characters act bravely
- Story premise must be visible in the narrative arc

SCENE WRITING RULES — STRICT:
- scene_text: EXACTLY 2-4 SHORT punchy sentences. Maximum 60 words. Sets atmosphere. Uses character names.
- dialogue: 4-8 lines total (pre-choice). Mix main and secondary character. Each line max 10 words. Real speech bubbles — short, sharp, emotional.
- choices: EXACTLY 2 choices, 4-8 words each. Action phrases. One "safe/expected" (index 0), one "risky/unexpected" (index 1).
- choice_hints: 1 sentence each describing where that choice generally leads (for long-press preview).
- choice_reaction: The secondary character's emotional reaction emoji to the most recent player choice.
- image_prompt: SCENE DESCRIPTION ONLY — characters' actions, expressions, setting. MAX 50 words. NO art style tags.
- Every word earns its place.

STAGE v2 — SCENE TYPOLOGY (REQUIRED):
- Every scene has a "scene_type": either "A" (hub, freeform, decision beat) or "B" (kinetic, pure momentum).
- can_text_input MUST equal (scene_type === "A").
- Scene 1 is always A. The final scene is always A.
- Default rhythm: A-B-B-A-B-B-A... (every third scene is A).
- Type A scenes are narrative pivots where stakes shift.
- Type B scenes are momentum scenes — action, dialogue, rising tension.

STAGE v2 — FILLER DIALOGUE (REQUIRED on non-final scenes):
- "filler_dialogue" is a SEPARATE array of 4-8 short bubbles that plays AFTER the player taps a choice.
- Purpose: extends the scene by 8-18 seconds while the next scene loads.
- Branch-agnostic — MUST NOT reference or commit to either choice's specific outcome.
- Pure emotional reaction/processing: the characters digesting what just happened.
- Each entry: { "character": "<name>", "line": "<max 10 words>", "emotion": "<emotion>", "beat_ms": <600-1400> }.
- Good examples: "You really did that…", "Wait, hold on—", "*she exhales*", "My heart is racing."
- BAD examples (spoilers): "And that's why we went left.", "Let's head to the club now.", "Now I'm running to her."

EMOTION SYSTEM — each dialogue / filler line must include an "emotion" tag:
Valid emotions: "love" | "anger" | "sad" | "surprise" | "happy" | "tense" | "neutral" | "twist"

ATMOSPHERE — include time_of_day and weather for visual tinting.

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no preamble:
{
  "schema_version": 2,
  "scene_number": <integer>,
  "scene_type": "A" | "B",
  "can_text_input": <boolean, true only if scene_type==="A">,
  "scene_text": "<2-4 punchy sentences — MAX 60 words>",
  "dialogue": [
    {"character": "<name>", "line": "<max 10 words>", "emotion": "<emotion>"}
  ],
  "choices": ["<choice A safe, 4-8 words>", "<choice B risky, 4-8 words>"],
  "choice_hints": ["<1 sentence: direction of A>", "<1 sentence: direction of B>"],
  "choice_reaction": {"emoji": "<emoji>", "character": "secondary"},
  "filler_dialogue": [
    {"character": "<name>", "line": "<max 10 words>", "emotion": "<emotion>", "beat_ms": <600-1400>}
  ],
  "image_prompt": "<scene description — actions/expressions/setting — MAX 50 words>",
  "memory_updates": {
    "<character_name>": {
      "emotions": {"love": <0-100>, "trust": <0-100>, "anger": <0-100>, "fear": <0-100>, "jealousy": <0-100>},
      "key_events": ["<one brief event if significant, or omit>"]
    }
  },
  "twist_occurred": <boolean>,
  "twist_type": <"Betrayal"|"Secret Revealed"|"Unexpected Arrival"|"Time Jump"|"Power Shift"|"Death"|null>,
  "story_tension_score": <0-100>,
  "time_of_day": <"morning"|"afternoon"|"evening"|"night">,
  "weather": <"clear"|"cloudy"|"rain"|"storm"|"snow"|"fog">,
  "is_final_scene": <boolean>,
  "ending_type": <"happy"|"tragic"|"twist"|"secret"|null>,
  "best_quote": "<most dramatic/memorable single line of dialogue — used for share card>"
}`;

// ── Helpers ───────────────────────────────────────────────────

function buildCharacterBlock(characters) {
  return characters.map((c) => JSON.stringify({
    name: c.name,
    role: c.role,
    appearance: (c.photo_url && !c.photo_url.startsWith('http')) ? c.photo_url : null,
    traits: c.traits,
    emotions: c.emotions,
    relationships: c.relationships,
    key_events: (c.key_events ?? []).slice(-5),
    secrets: c.secrets ?? [],
  }, null, 2)).join('\n\n');
}

function buildHistoryBlock(recentScenes) {
  if (!recentScenes?.length) return 'This is scene 1 — no history yet.';
  return recentScenes.slice(-5).map((s) =>
    `Scene ${s.scene_number} (type ${s.scene_type ?? '?'}): ${(s.scene_text ?? '').slice(0, 180)}... [Player chose: ${s.player_choice ?? 'N/A'}]`
  ).join('\n\n');
}

const ART_STYLE_MAP = {
  'Cinematic':   'Cinematic photorealistic style, dramatic film lighting, shallow depth of field, widescreen composition',
  'Realistic':   'Photorealistic style, natural lighting, lifelike textures, authentic expressions',
  'Anime':       'Anime illustration style, expressive eyes, dynamic poses, vibrant saturated colors',
  'Illustrated': 'Digital illustration, painterly style, rich colors, storybook composition',
  'Comic Book':  'Comic book panel art style, bold ink outlines, vibrant saturated colors, dramatic cinematic lighting, half-page illustration, Marvel DC Episode comic book aesthetic',
  'Pixel Art':   'Retro pixel art style, 16-bit aesthetic, chunky pixels, limited color palette, SNES-era game sprite composition',
  'Oil Painting':'Classical oil painting style, rich visible brushstrokes, dramatic chiaroscuro lighting, Renaissance fine art aesthetic',
  'AI Decides':  'Cinematic photorealistic style, dramatic lighting, high-quality film still',
};

function buildComicImagePrompt(sceneData, characters, story) {
  const parts = [];

  parts.push(ART_STYLE_MAP[story.art_style] ?? ART_STYLE_MAP['Comic Book']);

  if (story.art_style && story.art_style.toLowerCase() !== 'default') {
    parts.push(`Art direction: ${story.art_style}`);
  }

  const charDescs = characters.map((c) => {
    const hasAppearance = c.photo_url && !c.photo_url.startsWith('http');
    if (hasAppearance) {
      return `${c.name} (${c.role}: ${c.photo_url})`;
    }
    const traits = (c.traits ?? []).slice(0, 3).join(', ');
    return `${c.name} (${c.role} character${traits ? `, ${traits}` : ''})`;
  });
  if (charDescs.length > 0) {
    parts.push(`Featuring: ${charDescs.join(' and ')}`);
  }

  const aiDesc = (sceneData.image_prompt ?? '').trim().slice(0, 120);
  if (aiDesc) parts.push(aiDesc);

  const contextTags = [story.setting, story.genre, story.tone].filter(Boolean).join(', ');
  if (contextTags) parts.push(`Setting: ${contextTags}`);

  parts.push(
    'Detailed character faces, dynamic composition, ' +
    'portrait 4:3 panel layout, high quality, sharp lines, no watermark'
  );

  return parts.join('. ');
}

/**
 * Parse JSON from Claude response; retry once if parsing OR validation fails.
 */
async function parseAndValidateWithRetry(rawText, messages, context, { sceneNumber, isFinalScene, forcedSceneType }) {
  const tryParse = (text) => {
    const stripped = text.replace(/```(?:json)?/gi, '').trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  };

  let parsed = tryParse(rawText);

  const runValidators = (data) => {
    if (!data) return { ok: false, reason: 'json_parse_failed', errors: ['Could not parse JSON'] };
    const v = validateScene(data, { sceneNumber, isFinalScene });
    if (!v.valid) return { ok: false, reason: 'schema_invalid', errors: v.errors };
    const s = detectSpoilers(data);
    if (!s.clean) return { ok: false, reason: 'spoiler_leak', errors: s.offending.map(o => `filler[${o.index}] leaks: ${o.tokens.join(',')}`) };
    return { ok: true };
  };

  let result = runValidators(parsed);

  if (!result.ok) {
    logger.warn('[SceneService] Scene failed validation — retrying with correction prompt', {
      ...context,
      reason: result.reason,
      errors: result.errors?.slice(0, 5),
    });

    const correction = [
      `Your response failed validation. Reasons: ${result.errors.slice(0, 5).join('; ')}.`,
      `Scene ${sceneNumber} must be scene_type="${forcedSceneType}" with can_text_input=${forcedSceneType === 'A'}.`,
      `Return ONLY the corrected JSON object, no markdown, no preamble.`,
      `Remember: filler_dialogue is REQUIRED (≥3 entries) and must be branch-agnostic — NEVER reference either choice's specific outcome.`,
    ].join(' ');

    const fixResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1400,
      messages: [
        ...messages,
        { role: 'assistant', content: rawText },
        { role: 'user', content: correction },
      ],
    });

    const fixedText = fixResponse.content[0]?.text ?? '';
    parsed = tryParse(fixedText);
    result = runValidators(parsed);

    if (!result.ok) {
      logger.error('[SceneService] Scene failed validation after retry', { ...context, reason: result.reason, errors: result.errors });
      throw new Error(`Story AI failed validation after retry: ${result.errors?.join('; ')}`);
    }
    logger.info('[SceneService] Scene self-correction succeeded', context);
  }

  return parsed;
}

// ── Main export ───────────────────────────────────────────────

async function generateScene({
  story, characters, recentScenes,
  playerChoice, isFirstScene = false, _safetyRetry = 0,
}) {
  const sceneNumber = (story.current_scene_number ?? 0) + 1;
  const context = { storyId: story.id, sceneNumber, genre: story.genre };

  logger.info('[SceneService] Starting scene generation', context);

  // 1. Pre-filter player input
  if (playerChoice && !isFirstScene) {
    const { safe } = await filterInput(playerChoice);
    if (!safe) {
      logger.warn('[SceneService] Player input blocked by safety filter — replacing with neutral continuation', context);
      playerChoice = 'continue the story';
    }
  }

  // 2. Twist
  const twistInstruction = getTwistInstruction(story, recentScenes ?? []);

  // 3. Build content
  const characterBlock = buildCharacterBlock(characters);
  const historyBlock   = buildHistoryBlock(recentScenes);
  const isFinalScene   = sceneNumber >= story.total_scenes;

  // Cadence guardrails
  const recentTypes = (recentScenes ?? []).slice(-2).map(s => s.scene_type ?? 'B');
  const freeformCooldown = Math.max(0, story.freeform_cooldown_remaining ?? 0);
  let forcedSceneType = expectedSceneType(sceneNumber, story.total_scenes, recentTypes);
  // If freeform cooldown active → force B (regardless of other rules) unless final
  if (freeformCooldown > 0 && !isFinalScene) forcedSceneType = 'B';

  const userContent = [
    {
      type: 'text',
      text: `CHARACTER STATE:\n${characterBlock}`,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: [
        `STORY CONTEXT:`,
        `Genre: ${story.genre}${story.genre_subtype ? ` (${story.genre_subtype})` : ''} | Setting: ${story.setting} | Tone: ${story.tone} | Art Style: ${story.art_style}`,
        `Scene ${sceneNumber} of ${story.total_scenes} | Tension: ${story.story_tension_score ?? 0}`,
        `Required scene_type for this scene: ${forcedSceneType} (can_text_input=${forcedSceneType === 'A'})`,
        freeformCooldown > 0 ? `Note: Freeform cooldown active (${freeformCooldown} scenes remaining) — scene_type MUST be B.` : '',
        story.story_elements?.length
          ? `\nREQUIRED STORY ELEMENTS (weave organically):\n${story.story_elements.map(e => `• ${e}`).join('\n')}`
          : '',
        story.genre === 'Brainrot'
          ? `\nBRAINROT RULES: Characters treat their absurd world as completely normal — never acknowledge the weirdness.`
          : '',
        ``,
        `RECENT HISTORY:`,
        historyBlock,
        ``,
        `PLAYER ACTION: ${playerChoice || 'Begin the story — set the scene and introduce the characters.'}`,
        twistInstruction ? `\nTWIST INSTRUCTION: ${twistInstruction}` : '',
        ``,
        isFinalScene
          ? `This is the FINAL scene. Bring the story to a satisfying conclusion. Set "is_final_scene": true.`
          : `Generate scene ${sceneNumber}. End with 2 meaningful choices AND branch-agnostic filler_dialogue.`,
      ].filter(Boolean).join('\n'),
    },
  ];

  const messages = [{ role: 'user', content: userContent }];

  // 4. Call Claude Haiku with cached system prompt
  logger.info('[SceneService] Calling Claude Haiku for scene', {
    ...context,
    model: 'claude-haiku-4-5-20251001',
    forcedSceneType,
    freeformCooldown,
  });

  const claudeStart = Date.now();
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1600,
    system: [
      { type: 'text', text: SCENE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages,
  });
  const claudeMs = Date.now() - claudeStart;

  logger.info('[SceneService] Claude Haiku responded', {
    ...context,
    durationMs: claudeMs,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
    cacheReadTokens: response.usage?.cache_read_input_tokens,
  });

  const rawText = response.content[0]?.text ?? '';

  // 5. Parse + validate (schema + spoiler)
  const sceneData = await parseAndValidateWithRetry(rawText, messages, context, {
    sceneNumber, isFinalScene, forcedSceneType,
  });

  // 6. Server enforces scene_type override if AI disobeyed
  if (sceneData.scene_type !== forcedSceneType) {
    logger.warn('[SceneService] AI violated cadence — forcing scene_type', {
      ...context, aiType: sceneData.scene_type, forced: forcedSceneType,
    });
    sceneData.scene_type    = forcedSceneType;
    sceneData.can_text_input = forcedSceneType === 'A';
  }
  sceneData.schema_version = SCHEMA_VERSION;

  // 7. Build deterministic image prompt
  const rawAiImageDesc = sceneData.image_prompt ?? '';
  sceneData.image_prompt = buildComicImagePrompt(sceneData, characters, story);

  logger.info('[SceneService] Scene data validated', {
    ...context,
    sceneType: sceneData.scene_type,
    fillerCount: sceneData.filler_dialogue?.length ?? 0,
    twistOccurred: sceneData.twist_occurred,
    tensionScore: sceneData.story_tension_score,
    isFinalScene: sceneData.is_final_scene,
    aiSceneDesc: rawAiImageDesc.slice(0, 60),
  });

  // 8. Post-filter combined scene + dialogue + filler
  const MAX_SAFETY_RETRIES = 3;
  const combinedText = [
    sceneData.scene_text,
    ...(sceneData.dialogue ?? []).map(d => d.line),
    ...(sceneData.filler_dialogue ?? []).map(d => d.line),
  ].filter(Boolean).join(' \n ');

  const { safe } = await filterOutput(combinedText);
  if (!safe) {
    if (_safetyRetry >= MAX_SAFETY_RETRIES) {
      logger.warn('[SceneService] Safety filter still flagging after max retries — passing through', context);
    } else {
      logger.warn('[SceneService] Scene content blocked by safety post-filter — regenerating', {
        ...context, safetyRetry: _safetyRetry + 1,
      });
      return generateScene({
        story, characters, recentScenes,
        playerChoice: (playerChoice || '') + ' [generate a clean version of this scene]',
        isFirstScene,
        _safetyRetry: _safetyRetry + 1,
      });
    }
  }

  logger.info('[SceneService] Scene generation complete', { ...context, durationMs: Date.now() - claudeStart });

  return sceneData;
}

module.exports = { generateScene, expectedSceneType, SCHEMA_VERSION };
