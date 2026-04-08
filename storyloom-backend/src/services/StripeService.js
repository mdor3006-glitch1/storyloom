'use strict';

const stripe = require('stripe');
const env = require('../config/env');
const { addCredits } = require('./CreditService');

// ── Credit pack definitions ─────────────────────────────────
// Must mirror CREDIT_PACKS in the frontend creditHelpers.ts
const CREDIT_PACKS = {
  starter: { credits: 100,  price_cents: 100  },
  basic:   { credits: 300,  price_cents: 250  },
  popular: { credits: 600,  price_cents: 450  },
  value:   { credits: 1500, price_cents: 999  },
  mega:    { credits: 3500, price_cents: 1999 },
};

let _stripe = null;
function getStripe() {
  if (!_stripe) {
    if (!env.stripe.secretKey) throw new Error('STRIPE_SECRET_KEY not configured.');
    _stripe = stripe(env.stripe.secretKey);
  }
  return _stripe;
}

/**
 * Create a Stripe PaymentIntent for a credit pack purchase.
 * Returns { clientSecret } which the client uses to complete payment.
 *
 * @param {string} userId
 * @param {string} packId  - e.g. 'popular'
 * @returns {Promise<{ clientSecret: string, credits: number, amount: number }>}
 */
async function createPaymentIntent(userId, packId) {
  const pack = CREDIT_PACKS[packId];
  if (!pack) {
    const err = new Error(`Unknown credit pack: ${packId}`);
    err.statusCode = 400;
    throw err;
  }

  const paymentIntent = await getStripe().paymentIntents.create({
    amount: pack.price_cents,
    currency: 'usd',
    metadata: { user_id: userId, pack_id: packId, credits: String(pack.credits) },
    automatic_payment_methods: { enabled: true },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    credits: pack.credits,
    amount: pack.price_cents,
  };
}

/**
 * Verify and process a Stripe webhook event.
 * Adds credits when payment_intent.succeeded fires.
 *
 * @param {Buffer} rawBody   - raw request body (must be Buffer, not parsed JSON)
 * @param {string} signature - value of stripe-signature header
 */
async function handleWebhook(rawBody, signature) {
  if (!env.stripe.webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured.');
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
  } catch (err) {
    const e = new Error(`Webhook signature verification failed: ${err.message}`);
    e.statusCode = 400;
    throw e;
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const { user_id, pack_id, credits } = intent.metadata;

    if (!user_id || !credits) {
      console.warn('[StripeService] Missing metadata on PaymentIntent:', intent.id);
      return;
    }

    const pack = CREDIT_PACKS[pack_id];
    const description = pack ? `${pack_id.charAt(0).toUpperCase() + pack_id.slice(1)} pack — ${credits} credits` : `${credits} credits`;

    await addCredits(user_id, parseInt(credits, 10), description, intent.id);
    console.log(`[StripeService] Added ${credits} credits to user ${user_id} via ${intent.id}`);
  }
  // Other event types are ignored for now
}

module.exports = { createPaymentIntent, handleWebhook, CREDIT_PACKS };
