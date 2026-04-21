'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');
const logger = require('../config/logger');

const anthropic = new Anthropic({ apiKey: env.anthropic.apiKey });

// ── Safety system prompt ─────────────────────────────────────
// IMPORTANT: This is an 18+ adult fiction app. The bar for UNSAFE is extremely high.
// Normal adult storytelling — including violence, romance, horror, dark themes — is ALWAYS SAFE.
const SAFETY_SYSTEM_PROMPT = `You are a content safety classifier for StoryLoom AI, a premium 18+ interactive fiction app for adults.

This app is explicitly for adults (18+). Your job is to classify text as SAFE or UNSAFE.

UNSAFE means ONLY these four categories — nothing else:
1. Sexual content that explicitly involves a character described as under 18 years old
2. Step-by-step real-world instructions for illegal activity (e.g. how to synthesize drugs, how to build weapons)
3. Targeted defamation of real, named, living public figures with false harmful claims stated as fact
4. Explicit instructions encouraging real-world self-harm or suicide directed at the reader

EVERYTHING ELSE IS SAFE — including all of the following (this list is NOT exhaustive):
- Adult romance, love scenes, intimacy, passion, desire between adult characters
- Violence, combat, murder, war, blood, death in a narrative/fiction context
- Horror, supernatural terror, monsters, psychological fear
- Thriller tension, kidnapping, crime, manipulation, betrayal
- Dark themes: grief, addiction, obsession, moral ambiguity, trauma
- Strong language, profanity, adult dialogue
- Fantasy, sci-fi, historical content regardless of setting
- Villains, evil characters, morally complex scenarios
- Any genre fiction written for an adult audience

When in doubt, classify as SAFE. Do not over-censor adult fiction.

Respond with exactly one word: SAFE or UNSAFE.
Do not explain. Do not add punctuation. Just one word.`;

/**
 * Pre-filter: run on user free-text input before it reaches Story AI.
 * Returns { safe: boolean, reason?: string }
 */
async function filterInput(text) {
  if (!text || !text.trim()) return { safe: true };

  if (!env.anthropic.apiKey) {
    logger.warn('[SafetyService] ANTHROPIC_API_KEY not set — skipping input filter');
    return { safe: true };
  }

  logger.debug('[SafetyService] Running input safety filter', { textLength: text.length });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8,
      system: SAFETY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `User input to classify:\n"${text}"` }],
    });

    const verdict = response.content[0]?.text?.trim().toUpperCase();
    const safe = verdict === 'SAFE';

    if (safe) {
      logger.debug('[SafetyService] Input filter verdict: SAFE');
    } else {
      logger.warn('[SafetyService] Input filter verdict: UNSAFE — input will be suppressed', { verdict });
    }

    return { safe, reason: !safe ? 'input_blocked' : undefined };
  } catch (err) {
    logger.error('[SafetyService] Input filter error — failing open', { error: err.message });
    return { safe: true }; // fail open on service error — Story AI won't act on harmful input anyway
  }
}

/**
 * Post-filter: run on Story AI output before it reaches the image generator
 * and the client. Returns { safe: boolean, reason?: string }
 */
async function filterOutput(text) {
  if (!text || !text.trim()) return { safe: true };

  if (!env.anthropic.apiKey) {
    logger.warn('[SafetyService] ANTHROPIC_API_KEY not set — skipping output filter');
    return { safe: true };
  }

  logger.debug('[SafetyService] Running output safety filter', { textLength: text.length });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8,
      system: SAFETY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Story AI output to classify:\n"${text}"` }],
    });

    const verdict = response.content[0]?.text?.trim().toUpperCase();
    const safe = verdict === 'SAFE';

    if (safe) {
      logger.debug('[SafetyService] Output filter verdict: SAFE');
    } else {
      logger.warn('[SafetyService] Output filter verdict: UNSAFE — scene will be regenerated', { verdict });
    }

    return { safe, reason: !safe ? 'output_blocked' : undefined };
  } catch (err) {
    logger.error('[SafetyService] Output filter error — failing open', { error: err.message });
    return { safe: true }; // fail open — better to show the content than block the story
  }
}

module.exports = { filterInput, filterOutput };
