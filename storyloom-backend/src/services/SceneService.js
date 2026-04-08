'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');
const { filterInput, filterOutput } = require('./SafetyService');
const { getTwistInstruction } = require('./TwistService');

const anthropic = new Anthropic({ apiKey: env.anthropic.apiKey });

// ── System prompt (sent with cache_control for prompt caching) ─
const SCENE_SYSTEM_PROMPT = `You are StoryLoom AI, a master storyteller for an 18+ interactive fiction app. Generate vivid, emotionally engaging story scenes.

CONTENT RULES:
- Romance/intimacy: sensual and emotional — fade to black for explicit acts
- Violence: dramatic and cinematic — no torture porn or gratuitous gore
- Dark themes: betrayal, grief, obsession, moral ambiguity — fully embrace them
- Strong language is acceptable for 18+ audience

NARRATIVE RULES:
- Every scene must advance the plot — no filler
- Dialogue must feel real, not expository
- Choices must be meaningfully different — not variations of the same action
- The world reacts to player choices — cause and effect must be visible
- Maintain genre tone consistently throughout

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no preamble:
{
  "scene_number": <integer>,
  "scene_text": "<2-4 paragraphs of narrative + dialogue>",
  "dialogue": [{"character": "<name>", "line": "<spoken line>"}],
  "choices": ["<choice A>", "<choice B>", "<choice C>"],
  "image_prompt": "<detailed FLUX.1 image prompt — scene composition, lighting, mood, characters' appearance and clothing>",
  "memory_updates": {
    "<character_name>": {
      "emotions": {"love": <0-100>, "trust": <0-100>, "anger": <0-100>, "fear": <0-100>, "jealousy": <0-100>},
      "key_events": ["<brief event summary if something significant happened>"]
    }
  },
  "twist_occurred": <boolean>,
  "twist_type": <"Betrayal"|"Secret Revealed"|"Unexpected Arrival"|"Time Jump"|"Power Shift"|"Death"|null>,
  "story_tension_score": <0-100>,
  "is_final_scene": <boolean>
}`;

// ── Helpers ───────────────────────────────────────────────────

function buildCharacterBlock(characters) {
  return characters.map((c) => JSON.stringify({
    name: c.name,
    role: c.role,
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
    `Scene ${s.scene_number}: ${(s.scene_text ?? '').slice(0, 180)}... [Player chose: ${s.player_choice ?? 'N/A'}]`
  ).join('\n\n');
}

/**
 * Parse JSON from Claude response; retry once with a correction prompt
 * if parsing fails (Task 3.4).
 */
async function parseWithRetry(rawText, messages) {
  // Strip possible markdown code fences
  const stripped = rawText.replace(/```(?:json)?/gi, '').trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
  }

  // Retry: send output back to Claude for self-correction
  const fixResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [
      ...messages,
      { role: 'assistant', content: rawText },
      { role: 'user', content: 'Your response was not valid JSON. Return ONLY the corrected JSON object with no other text.' },
    ],
  });

  const fixedText = fixResponse.content[0]?.text ?? '';
  const fixedMatch = fixedText.replace(/```(?:json)?/gi, '').trim().match(/\{[\s\S]*\}/);
  if (fixedMatch) return JSON.parse(fixedMatch[0]);

  throw new Error('Story AI returned invalid JSON after retry.');
}

// ── Main export ───────────────────────────────────────────────

/**
 * Generate the next scene for a story (Tasks 3.2, 3.3, 3.4).
 *
 * @param {object}   opts.story         - story row
 * @param {object[]} opts.characters    - character rows with full memory
 * @param {object[]} opts.recentScenes  - last ≤5 scene rows
 * @param {string}   opts.playerChoice  - player's choice or free text
 * @param {boolean}  [opts.isFirstScene]
 * @returns {Promise<object>} parsed scene data
 */
async function generateScene({ story, characters, recentScenes, playerChoice, isFirstScene = false }) {
  // 1. Pre-filter player input (Safety Task 3.1)
  if (playerChoice && !isFirstScene) {
    const { safe } = await filterInput(playerChoice);
    if (!safe) playerChoice = 'continue the story'; // silent replacement
  }

  // 2. Twist injection (Task 3.6)
  const twistInstruction = getTwistInstruction(story, recentScenes ?? []);

  // 3. Build message content
  const sceneNumber    = (story.current_scene_number ?? 0) + 1;
  const characterBlock = buildCharacterBlock(characters);
  const historyBlock   = buildHistoryBlock(recentScenes);
  const isFinalScene   = sceneNumber >= story.total_scenes;

  // Character state gets cache_control so it's reused across scenes of the same story
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
        `Genre: ${story.genre} | Setting: ${story.setting} | Tone: ${story.tone} | Art Style: ${story.art_style}`,
        `Scene ${sceneNumber} of ${story.total_scenes} | Tension: ${story.story_tension_score ?? 0}`,
        ``,
        `RECENT HISTORY:`,
        historyBlock,
        ``,
        `PLAYER ACTION: ${playerChoice || 'Begin the story — set the scene and introduce the characters.'}`,
        twistInstruction ? `\nTWIST INSTRUCTION: ${twistInstruction}` : '',
        ``,
        isFinalScene
          ? `This is the FINAL scene. Bring the story to a satisfying conclusion. Set "is_final_scene": true.`
          : `Generate scene ${sceneNumber}. End with 2-3 meaningful choices.`,
      ].filter(Boolean).join('\n'),
    },
  ];

  const messages = [{ role: 'user', content: userContent }];

  // 4. Call Claude Haiku with cached system prompt (Task 3.3)
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: [
      {
        type: 'text',
        text: SCENE_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages,
  });

  const rawText = response.content[0]?.text ?? '';

  // 5. Parse with retry (Task 3.4)
  const sceneData = await parseWithRetry(rawText, messages);

  // 6. Post-filter AI output (Task 3.1)
  const { safe } = await filterOutput(sceneData.scene_text ?? '');
  if (!safe) {
    // Regenerate cleanly — user does not know the filter triggered
    return generateScene({
      story, characters, recentScenes,
      playerChoice: (playerChoice || '') + ' [generate a clean non-explicit version of this scene]',
      isFirstScene,
    });
  }

  return sceneData;
}

module.exports = { generateScene };
