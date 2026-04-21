'use strict';

const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');

const router = Router();

// ── GET /subscriptions/status ─────────────────────────────────
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', req.userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });

    const isPlus = !!data && new Date(data.expires_at) > new Date();
    return res.json({ is_plus: isPlus, subscription: data ?? null });
  } catch (err) { next(err); }
});

// ── POST /subscriptions/subscribe ────────────────────────────
// Initiates a Stripe checkout session for StoryLoom Plus ($5/month)
router.post('/subscribe', requireAuth, async (req, res, next) => {
  try {
    // Stripe integration placeholder — return a checkout URL
    // In production: create a Stripe checkout session here
    logger.info('[POST /subscriptions/subscribe] Subscription initiated', { userId: req.userId });
    return res.json({
      checkout_url: 'https://buy.stripe.com/storyloom-plus',
      message: 'Redirect user to checkout_url to complete subscription.',
    });
  } catch (err) { next(err); }
});

// ── POST /subscriptions/webhook ───────────────────────────────
// Stripe webhook — called by Stripe when subscription events fire
router.post('/webhook', async (req, res, next) => {
  try {
    const event = req.body; // Stripe sends raw JSON
    logger.info('[POST /subscriptions/webhook] Received Stripe event', { type: event?.type });

    if (event?.type === 'customer.subscription.created' || event?.type === 'invoice.payment_succeeded') {
      const userId = event?.data?.object?.metadata?.user_id;
      if (userId) {
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        await supabaseAdmin.from('subscriptions').upsert({
          user_id: userId,
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          stripe_subscription_id: event?.data?.object?.subscription ?? event?.data?.object?.id,
        }, { onConflict: 'user_id' });

        // Grant 100 bonus credits
        const { data: user } = await supabaseAdmin
          .from('users').select('credit_balance').eq('id', userId).single();
        if (user) {
          await supabaseAdmin
            .from('users')
            .update({ credit_balance: user.credit_balance + 100 })
            .eq('id', userId);
        }
      }
    }

    if (event?.type === 'customer.subscription.deleted') {
      const userId = event?.data?.object?.metadata?.user_id;
      if (userId) {
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('user_id', userId);
      }
    }

    return res.json({ received: true });
  } catch (err) { next(err); }
});

module.exports = router;
