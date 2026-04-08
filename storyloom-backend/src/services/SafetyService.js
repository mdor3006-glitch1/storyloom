'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const env = require('../config/env');
const logger = require('../config/logger');

const anthropic = new Anthropic({ apiKey: env.anthropic.apiKey });

// ── Safety system prompt ─────────────────────────────────────
const SAFETY_SYSTEM_PROMPT = `You are a content safety classifier for StoryLoom AI, an 18+ interactive story app.

Your job is to classify text as SAFE or UNSAFE.

UNSAFE content includes:
- Sexual content involving minors (any age under 18)
- Instructions for real-world illegal activities (making weapons, drugs, etc.)
- Real person defamation (false harmful claims about real, named public figures)
- Self-harm instructions or glorification
- Hate speech targeting protected groups
- Graphic torture or gore beyond typical adult fiction

SAFE content includes:
- Adult romance, intimacy, sensuality (fade-to-black is fine)
- Violence in a narrative fiction context (battles, conflict, thriller)
- Dark themes: betrayal, death, moral ambiguity
- Thriller/horror tension and fear
- Strong language

Respond with exactly one word: SAFE or UNSAFE.
Do not explain. Do not add punctuation. Just: SAFE or UNSAFE`;

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
