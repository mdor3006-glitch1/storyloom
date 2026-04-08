'use strict';

const { Router } = require('express');
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getBalance, getHistory } = require('../services/CreditService');
const { createPaymentIntent, handleWebhook } = require('../services/StripeService');

const router = Router();

// ── GET /credits/balance ──────────────────────────────────────
router.get('/balance', requireAuth, async (req, res, next) => {
  try {
    const balance = await getBalance(req.userId);
    return res.json({ balance });
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    next(err);
  }
});

// ── GET /credits/history ──────────────────────────────────────
// Query params: limit (default 50, max 100), offset (default 0)
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  ?? '50', 10), 100);
    const offset = Math.max(parseInt(req.query.offset ?? '0',  10), 0);
    if (Number.isNaN(limit) || Number.isNaN(offset)) {
      return res.status(400).json({ error: 'limit and offset must be integers.' });
    }
    const transactions = await getHistory(req.userId, { limit, offset });
    return res.json({ transactions });
  } catch (err) { next(err); }
});

// ── POST /credits/purchase ─────────────────────────────────────
// Creates a Stripe PaymentIntent. Returns clientSecret for the
// client-side payment sheet.
// Body: { pack_id: 'starter' | 'basic' | 'popular' | 'value' | 'mega' }
router.post('/purchase', requireAuth, async (req, res, next) => {
  try {
    const { pack_id } = req.body;
    if (!pack_id) return res.status(400).json({ error: 'pack_id is required.' });

    const result = await createPaymentIntent(req.userId, pack_id);
    return res.json(result);
  } catch (err) {
    if (err.statusCode >= 400 && err.statusCode < 500) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

// ── POST /credits/webhook ──────────────────────────────────────
// Stripe webhook — no auth, requires raw body for signature verification.
// The express.raw() middleware is scoped to this route only.
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    try {
      const signature = req.headers['stripe-signature'];
      if (!signature) return res.status(400).json({ error: 'Missing stripe-signature header.' });

      await handleWebhook(req.body, signature);
      return res.json({ received: true });
    } catch (err) {
      if (err.statusCode === 400) return res.status(400).json({ error: err.message });
      next(err);
    }
  }
);

module.exports = router;
