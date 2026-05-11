'use strict';

/**
 * STAGE v2 Pregeneration Service.
 *
 * Supabase-backed cache of fully-hydrated scene bundles (scene_data + image_url).
 * Atomic pair semantics: both branches must reach `ready` before either is served.
 * Dedup via UNIQUE(story_id, from_scene_number, choice_hash, schema_version) +
 * INSERT ... ON CONFLICT DO NOTHING. Safe across multiple backend instances.
 *
 * Global semaphores cap Claude & FLUX concurrency per instance.
 * Engagement gate + per-story budget prevent cost blowouts.
 * Global kill-switch via system_flags.pregen_enabled.
 */

const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');

const SCHEMA_VERSION = 2;
const TTL_MS         = 15 * 60 * 1000;

const MAX_CONCURRENT_CLAUDE = 6;
const MAX_CONCURRENT_FLUX   = 4;

// ── Simple counting semaphore ─────────────────────────────────
function createSemaphore(limit) {
  let active = 0;
  const queue = [];
  const acquire = () => new Promise((resolve) => {
    const tryAcquire = () => {
      if (active < limit) {
        active++;
        resolve();
      } else {
        queue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
  const release = () => {
    active = Math.max(0, active - 1);
    const next = queue.shift();
    if (next) next();
  };
  const run = async (fn) => {
    await acquire();
    try { return await fn(); } finally { release(); }
  };
  return { run, active: () => active };
}

const claudeSem = createSemaphore(MAX_CONCURRENT_CLAUDE);
const fluxSem   = createSemaphore(MAX_CONCURRENT_FLUX);

// ── Metrics counters (in-memory, scraped via /admin/metrics) ──
const metrics = {
  hits: 0,
  misses: 0,
  partialFailures: 0,
  prediction: { correct: 0, total: 0 },
  durationsMs: [],
};

function recordDuration(ms) {
  metrics.durationsMs.push(ms);
  if (metrics.durationsMs.length > 500) metrics.durationsMs.shift();
}

function getMetricsSnapshot() {
  const arr = metrics.durationsMs.slice().sort((a, b) => a - b);
  const pct = (p) => arr.length ? arr[Math.floor(arr.length * p)] : 0;
  const total = metrics.hits + metrics.misses;
  return {
    hits: metrics.hits,
    misses: metrics.misses,
    partial_failures: metrics.partialFailures,
    hit_rate: total ? metrics.hits / total : 0,
    prediction_accuracy: metrics.prediction.total
      ? metrics.prediction.correct / metrics.prediction.total
      : 0,
    duration_p50: pct(0.5),
    duration_p90: pct(0.9),
    duration_p99: pct(0.99),
    duration_sample_size: arr.length,
  };
}

// ── Helpers ───────────────────────────────────────────────────

function choiceHash(choice) {
  return crypto.createHash('sha1').update(String(choice).trim().toLowerCase()).digest('hex');
}

async function isPregenEnabled() {
  try {
    const { data } = await supabaseAdmin
      .from('system_flags')
      .select('value')
      .eq('key', 'pregen_enabled')
      .single();
    // value is stored as jsonb — could be boolean or string
    if (typeof data?.value === 'boolean') return data.value;
    if (typeof data?.value === 'string') return data.value === 'true';
    return Boolean(data?.value);
  } catch {
    return true; // fail open — don't break when flag row missing
  }
}

/**
 * Consume a ready bundle: marks it 'consumed' and returns its data.
 * Returns null on miss or if not yet ready.
 */
async function consumeBundle(storyId, fromSceneNumber, choice) {
  const hash = choiceHash(choice);

  const { data: row } = await supabaseAdmin
    .from('pregen_bundles')
    .select('*')
    .eq('story_id', storyId)
    .eq('from_scene_number', fromSceneNumber)
    .eq('choice_hash', hash)
    .eq('schema_version', SCHEMA_VERSION)
    .eq('status', 'ready')
    .maybeSingle();

  if (!row) {
    metrics.misses++;
    logger.info('[Pregen] Cache MISS', { storyId, fromSceneNumber, choicePrefix: choice?.slice(0, 30) });
    return null;
  }

  // TTL guard
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs > TTL_MS) {
    metrics.misses++;
    logger.info('[Pregen] Cache EXPIRED', { storyId, fromSceneNumber, ageMs });
    await supabaseAdmin.from('pregen_bundles').update({ status: 'failed' }).eq('id', row.id);
    return null;
  }

  // Mark consumed
  await supabaseAdmin
    .from('pregen_bundles')
    .update({ status: 'consumed' })
    .eq('id', row.id);

  metrics.hits++;
  logger.info('[Pregen] Cache HIT', { storyId, fromSceneNumber, ageMs });

  return {
    sceneData: row.scene_data,
    imageUrl:  row.image_url,
    blurhash:  row.blurhash,
  };
}

/**
 * Invalidate all bundles from a scene onward — used by undo.
 */
async function invalidateFromScene(storyId, fromSceneNumber) {
  const { error } = await supabaseAdmin
    .from('pregen_bundles')
    .update({ status: 'failed' })
    .eq('story_id', storyId)
    .gte('from_scene_number', fromSceneNumber);

  if (error) {
    logger.error('[Pregen] invalidateFromScene failed', { storyId, fromSceneNumber, error: error.message });
  } else {
    logger.info('[Pregen] Invalidated bundles from scene', { storyId, fromSceneNumber });
  }
}

// ── Engagement gate ───────────────────────────────────────────
async function passesEngagementGate({ userId, story, isAppForeground = true }) {
  if (!isAppForeground) return false;
  if ((story.total_scenes ?? 0) - (story.current_scene_number ?? 0) < 2) return false; // no pregen on penultimate

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('credit_balance, last_active_at')
    .eq('id', userId)
    .maybeSingle();

  if (!user) return false;
  if ((user.credit_balance ?? 0) < 10) return false;

  // Activity heuristic: last_active within 30 minutes
  if (user.last_active_at) {
    const ageMs = Date.now() - new Date(user.last_active_at).getTime();
    if (ageMs > 30 * 60 * 1000) return false;
  }

  return true;
}

// ── Predicted-branch priority ─────────────────────────────────
async function getPredictedBranchOrder(userId, choices) {
  // choices[0] = safe, choices[1] = risky (product convention)
  try {
    const { data: u } = await supabaseAdmin
      .from('users')
      .select('choice_bias')
      .eq('id', userId)
      .maybeSingle();

    const bias = u?.choice_bias ?? { safe_count: 0, risky_count: 0 };
    const total = (bias.safe_count ?? 0) + (bias.risky_count ?? 0);
    const safeProb = total > 0 ? (bias.safe_count / total) : 0.5;

    // If user leans safe, prioritize index 0 first
    return safeProb >= 0.5 ? [0, 1] : [1, 0];
  } catch {
    return [0, 1];
  }
}

async function updateChoiceBias(userId, choiceIndex) {
  const field = choiceIndex === 0 ? 'safe_count' : 'risky_count';
  try {
    const { data: u } = await supabaseAdmin
      .from('users')
      .select('choice_bias')
      .eq('id', userId)
      .maybeSingle();

    const bias = u?.choice_bias ?? { safe_count: 0, risky_count: 0 };
    bias[field] = (bias[field] ?? 0) + 1;

    await supabaseAdmin
      .from('users')
      .update({ choice_bias: bias })
      .eq('id', userId);
  } catch (err) {
    logger.warn('[Pregen] Failed to update choice_bias', { userId, error: err.message });
  }
}

// ── Per-story pregen budget (in-memory counter) ───────────────
const storyBudgets = new Map(); // storyId → { used, cap }
function checkBudget(storyId, totalScenes) {
  const cap = totalScenes * 2;
  const entry = storyBudgets.get(storyId) ?? { used: 0, cap };
  if (entry.used >= cap) return false;
  entry.used += 1;
  storyBudgets.set(storyId, entry);
  return true;
}

// ── Core: pregenerate one branch (text + image) ───────────────
async function pregenerateBranch({
  storyId, story, characters, currentSceneRow, currentSceneData, recentScenes,
  choice, userId,
}) {
  const { generateScene } = require('./SceneService');
  const { generateSceneImage } = require('./ImageService');

  const fromSceneNumber = currentSceneRow.scene_number;
  const hash = choiceHash(choice);
  const start = Date.now();

  // Claim the slot: insert pending marker; returns null on conflict
  const { data: claim, error: claimErr } = await supabaseAdmin
    .from('pregen_bundles')
    .insert({
      story_id: storyId,
      from_scene_number: fromSceneNumber,
      choice_hash: hash,
      choice_text: String(choice).slice(0, 120),
      status: 'pending',
      schema_version: SCHEMA_VERSION,
    })
    .select('id')
    .single();

  // If we lost the race, another worker is already handling it — don't regenerate.
  if (claimErr && claimErr.code === '23505') {
    logger.debug('[Pregen] Branch already claimed by another worker', { storyId, fromSceneNumber });
    return { claimed: false };
  }
  if (claimErr) {
    logger.error('[Pregen] Claim insert failed', { storyId, fromSceneNumber, error: claimErr.message });
    return { claimed: false, error: claimErr.message };
  }

  const bundleId = claim.id;

  try {
    // 1. Build next-scene context
    const nextStory = { ...story, current_scene_number: fromSceneNumber };
    const history = [...(recentScenes ?? []), {
      scene_number: fromSceneNumber,
      scene_text:   currentSceneRow.scene_text,
      scene_type:   currentSceneRow.scene_type,
      player_choice: choice,
    }];

    // 2. Claude (text) — bounded by semaphore
    const sceneData = await claudeSem.run(() =>
      generateScene({
        story: nextStory,
        characters,
        recentScenes: history,
        playerChoice: choice,
        isFirstScene: false,
      })
    );

    // 3. FLUX (image) — bounded by semaphore
    const previousImageUrl = currentSceneRow.image_url || null;
    const imageUrl = await fluxSem.run(() =>
      generateSceneImage({
        imagePrompt: sceneData.image_prompt,
        storyId,
        sceneNumber: fromSceneNumber + 1,
        previousImageUrl,
        genre: story.genre ?? null,
        genreSubtype: story.genre_subtype ?? null,
        sceneType: sceneData.scene_type ?? null,
        twistOccurred: sceneData.twist_occurred ?? false,
        isFinalScene: sceneData.is_final_scene ?? false,
      })
    );

    // 4. Write bundle as 'ready'
    await supabaseAdmin
      .from('pregen_bundles')
      .update({
        scene_data: sceneData,
        image_url: imageUrl,
        status: 'ready',
        ready_at: new Date().toISOString(),
      })
      .eq('id', bundleId);

    recordDuration(Date.now() - start);
    logger.info('[Pregen] Branch READY', { storyId, fromSceneNumber, durationMs: Date.now() - start });
    return { claimed: true, ok: true, sceneData, imageUrl };
  } catch (err) {
    logger.warn('[Pregen] Branch failed', {
      storyId, fromSceneNumber,
      choicePrefix: String(choice).slice(0, 30),
      error: err.message,
    });
    await supabaseAdmin
      .from('pregen_bundles')
      .update({ status: 'failed' })
      .eq('id', bundleId);
    return { claimed: true, ok: false, error: err.message };
  }
}

/**
 * Atomic pair pregen. Fires both branches in parallel; does NOT mark
 * either as 'ready' to clients until both are attempted.
 * The per-branch `pregenerateBranch` writes 'ready' atomically on success.
 * This fn gathers results for logging + metrics.
 */
async function pregeneratePair({
  userId, storyId, story, characters, currentSceneRow, currentSceneData, recentScenes,
  isAppForeground = true,
}) {
  const context = { userId, storyId, fromSceneNumber: currentSceneRow.scene_number };

  // Global kill-switch
  if (!(await isPregenEnabled())) {
    logger.info('[Pregen] Globally disabled via system_flags', context);
    return;
  }

  // Engagement gate
  const passes = await passesEngagementGate({ userId, story, isAppForeground });
  if (!passes) {
    logger.info('[Pregen] Engagement gate blocked pregen', context);
    return;
  }

  const choices = (currentSceneData.choices ?? []).slice(0, 2);
  if (choices.length < 2) {
    logger.debug('[Pregen] Less than 2 choices — skipping pair', context);
    return;
  }

  // Budget check: if budget exhausted → pregen only predicted branch
  const order = await getPredictedBranchOrder(userId, choices);
  const fullBudget = checkBudget(storyId, story.total_scenes ?? 8);

  const branchesToRun = fullBudget
    ? order.map(i => ({ i, choice: choices[i] }))
    : order.slice(0, 1).map(i => ({ i, choice: choices[i] }));

  if (!fullBudget) {
    logger.info('[Pregen] Budget exhausted — single-branch pregen only', context);
  }

  // Fire all in parallel, off the request path (setImmediate so caller isn't blocked)
  setImmediate(async () => {
    const results = await Promise.all(
      branchesToRun.map(({ choice }) => pregenerateBranch({
        storyId, story, characters, currentSceneRow, currentSceneData, recentScenes,
        choice, userId,
      }).catch((err) => ({ ok: false, error: err.message })))
    );

    const successes = results.filter(r => r?.ok).length;
    const attempts  = results.length;

    if (attempts === 2 && successes === 1) metrics.partialFailures++;

    logger.info('[Pregen] Pair complete', {
      ...context,
      attempts, successes,
      partial: attempts === 2 && successes === 1,
    });
  });
}

// ── Cleanup (orphaned rows + old blobs) ───────────────────────
async function runCleanup() {
  try {
    // Best-effort: delete old rows
    await supabaseAdmin
      .from('pregen_bundles')
      .delete()
      .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    await supabaseAdmin
      .from('pregen_bundles')
      .delete()
      .in('status', ['consumed', 'failed']);

    logger.debug('[Pregen] Cleanup pass complete');
  } catch (err) {
    logger.warn('[Pregen] Cleanup failed', { error: err.message });
  }
}

function startCleanupCron() {
  // Every 15 min
  setInterval(runCleanup, 15 * 60 * 1000).unref?.();
  // Initial pass 30s after boot
  setTimeout(runCleanup, 30_000).unref?.();
  logger.info('[Pregen] Cleanup cron scheduled (15 min interval)');
}

module.exports = {
  SCHEMA_VERSION,
  consumeBundle,
  invalidateFromScene,
  pregeneratePair,
  updateChoiceBias,
  getMetricsSnapshot,
  startCleanupCron,
  choiceHash,
};
