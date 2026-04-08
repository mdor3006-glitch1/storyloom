'use strict';

const { fal } = require('@fal-ai/client');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const env = require('../config/env');

fal.config({ credentials: env.fal.apiKey });

const STORAGE_BUCKET = 'scene-images';
const FLUX_MODEL     = 'fal-ai/flux-pro/kontext';

// ── Helpers ───────────────────────────────────────────────────

/**
 * Download an image from a URL and return it as a base64 data URL.
 * Used to pass reference photos to fal.ai.
 */
async function urlToDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch reference image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get('content-type') ?? 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/**
 * Upload a generated image (from URL or buffer) to Supabase Storage.
 * Returns the public CDN URL.
 */
async function storeImage(imageUrl, storyId, sceneNumber) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download generated image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const path = `${storyId}/scene-${sceneNumber}-${uuidv4()}.jpg`;

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buf, { contentType: 'image/jpeg', upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Generate a scene image using FLUX.1 Kontext [pro] via fal.ai.
 *
 * Scene 1: text-to-image with character descriptions
 * Scene 2+: image-to-image using previous scene as visual reference
 *
 * Both character reference photos are included in every call for
 * face consistency (per PROJECT_BIBLE §5.4).
 *
 * @param {object} opts
 * @param {string}   opts.imagePrompt       - from Story AI output
 * @param {string}   opts.storyId
 * @param {number}   opts.sceneNumber
 * @param {object[]} opts.characters         - character rows (for photo_url)
 * @param {string}   [opts.previousImageUrl] - last generated scene image
 * @returns {Promise<string>} public CDN URL of the stored image
 */
async function generateSceneImage({ imagePrompt, storyId, sceneNumber, characters, previousImageUrl }) {
  if (!env.fal.apiKey) {
    console.warn('[ImageService] FAL_API_KEY not set — returning placeholder');
    return 'https://placehold.co/1280x720/2E4057/FAFAFA?text=Scene+Image';
  }

  // Build reference images array: character photos + previous scene
  const referenceUrls = characters
    .filter((c) => c.photo_url && !c.is_ai_generated)
    .map((c) => c.photo_url);

  if (previousImageUrl) referenceUrls.push(previousImageUrl);

  // Convert reference URLs to base64 data URLs for fal.ai
  const referenceDataUrls = await Promise.all(referenceUrls.map(urlToDataUrl));

  // Build fal.ai input
  const falInput = {
    prompt: imagePrompt,
    image_size: { width: 1280, height: 720 },
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    safety_tolerance: '2', // allows mature content appropriate for 18+ app
    ...(referenceDataUrls.length > 0 ? { image_url: referenceDataUrls[0] } : {}),
    // Additional reference images (character photos)
    ...(referenceDataUrls.length > 1 ? { reference_images: referenceDataUrls.slice(1).map((url) => ({ url })) } : {}),
  };

  const result = await fal.run(FLUX_MODEL, { input: falInput });

  const generatedUrl = result?.images?.[0]?.url;
  if (!generatedUrl) throw new Error('fal.ai returned no image URL');

  // Store in Supabase Storage and return CDN URL
  return storeImage(generatedUrl, storyId, sceneNumber);
}

module.exports = { generateSceneImage };
