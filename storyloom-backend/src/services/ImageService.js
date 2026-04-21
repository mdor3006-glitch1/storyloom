'use strict';

const { fal } = require('@fal-ai/client');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');
const logger = require('../config/logger');

fal.config({ credentials: env.fal.apiKey });

const STORAGE_BUCKET   = 'scene-images';
const KONTEXT_PRO      = 'fal-ai/flux-pro/kontext';
const SCHNELL          = 'fal-ai/flux/schnell';

// STAGE v2 hard timeout per FLUX call
const FLUX_TIMEOUT_MS = 12_000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function storeImage(imageUrl, storyId, sceneNumber) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download generated image: ${res.status}`);
  const buf  = Buffer.from(await res.arrayBuffer());
  const path = `${storyId}/scene-${sceneNumber}-${uuidv4()}.jpg`;

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buf, { contentType: 'image/jpeg', upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function buildGenrePromptPrefix(genre, genreSubtype) {
  if (genre === 'Cartoon Characters') {
    return `anthropomorphic character with human body proportions, expressive cartoon eyes, Pixar 3D animation style, cinematic studio lighting, vibrant saturated colors, `;
  }
  if (genre === 'Brainrot') {
    const subtypeDesc = genreSubtype ? `${genreSubtype} scenario, ` : '';
    return `surreal Pixar 3D animation style, ${subtypeDesc}dreamlike impossible environment, vibrant hyper-saturated colors, cinematic composition, hyper-detailed rendering, Studio Ghibli meets Pixar meets Salvador Dali, `;
  }
  return '';
}

/**
 * Tiered model selector (STAGE v2):
 *   sceneType='A' OR twistOccurred OR isFinalScene → Kontext Pro (high quality)
 *   Otherwise → Schnell (fast/cheap)
 *   First scene (no previous image) always uses text-to-image Schnell.
 */
function selectModel({ hasPreviousImage, sceneType, twistOccurred, isFinalScene }) {
  const isCritical = sceneType === 'A' || twistOccurred || isFinalScene;
  if (!hasPreviousImage) return { model: SCHNELL, mode: 'text' };
  if (isCritical) return { model: KONTEXT_PRO, mode: 'kontext' };
  // Non-critical Type B with prior image: use Kontext anyway (for character consistency)
  // but prefer faster variants. For now use Pro to preserve consistency.
  return { model: KONTEXT_PRO, mode: 'kontext' };
}

async function callFluxOnce({ model, mode, fullPrompt, previousImageUrl }) {
  const input = mode === 'text'
    ? {
        prompt:                fullPrompt,
        image_size:            'portrait_4_3',
        num_inference_steps:   4,
        num_images:            1,
        enable_safety_checker: false,
      }
    : {
        prompt:                fullPrompt,
        image_url:             previousImageUrl,
        num_images:            1,
        enable_safety_checker: false,
      };

  const subResult = await withTimeout(
    fal.subscribe(model, { input, logs: false }),
    FLUX_TIMEOUT_MS,
    `FLUX ${model}`,
  );

  const output = subResult?.data ?? subResult;
  const generatedUrl =
    output?.images?.[0]?.url ||
    output?.image?.url       ||
    output?.output?.images?.[0]?.url ||
    output?.output?.image?.url ||
    null;

  if (!generatedUrl) throw new Error(`fal.ai returned no image URL (model ${model})`);
  return generatedUrl;
}

/**
 * Generate a scene image with STAGE v2 tiered model + timeout fallback.
 */
async function generateSceneImage({
  imagePrompt, storyId, sceneNumber,
  previousImageUrl = null,
  genre = null, genreSubtype = null,
  sceneType = null, twistOccurred = false, isFinalScene = false,
}) {
  const context = { storyId, sceneNumber, sceneType };

  if (!env.fal.apiKey) {
    logger.warn('[ImageService] FAL_API_KEY not set — returning placeholder', context);
    return 'https://placehold.co/768x1024/2E4057/FAFAFA?text=Scene+Image';
  }

  const hasPreviousImage = !!previousImageUrl;
  const { model, mode } = selectModel({ hasPreviousImage, sceneType, twistOccurred, isFinalScene });

  logger.info('[ImageService] Starting image generation', {
    ...context, model, mode, hasPreviousImage, promptLength: imagePrompt.length,
  });

  const genrePrefix = buildGenrePromptPrefix(genre, genreSubtype);
  const fullPrompt  = genrePrefix ? `${genrePrefix}${imagePrompt}` : imagePrompt;

  const start = Date.now();
  let generatedUrl;

  try {
    generatedUrl = await callFluxOnce({ model, mode, fullPrompt, previousImageUrl });
  } catch (err) {
    logger.warn('[ImageService] Primary FLUX call failed — falling back to Schnell', {
      ...context, model, error: err.message,
    });
    try {
      generatedUrl = await callFluxOnce({
        model: SCHNELL,
        mode: 'text',
        fullPrompt: previousImageUrl ? `${fullPrompt} (cinematic continuation)` : fullPrompt,
      });
    } catch (err2) {
      logger.error('[ImageService] FLUX fallback also failed', { ...context, error: err2.message });
      throw err2;
    }
  }

  const durationMs = Date.now() - start;
  logger.info('[ImageService] FLUX responded', { ...context, durationMs });

  const publicUrl = await storeImage(generatedUrl, storyId, sceneNumber);
  logger.info('[ImageService] Scene image pipeline complete', { ...context, publicUrl });
  return publicUrl;
}

module.exports = { generateSceneImage };
