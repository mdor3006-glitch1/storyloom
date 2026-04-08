'use strict';

const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../config/logger');

// ── Credit costs (mirrors frontend creditHelpers.ts) ──────────
const STORY_CREDIT_COSTS = { short: 50, medium: 100, long: 175 };

/**
 * Atomically deduct credits from a user's balance.
 * Uses optimistic locking: the UPDATE only succeeds when
 * `credit_balance` still equals the value we just read.
 * If another request has already decremented it, we retry once,
 * then surface an "Insufficient credits" error.
 *
 * On success inserts a credit_transactions row and returns the
 * new balance.
 *
 * @param {string} userId
 * @param {number} amount      - positive integer to deduct
 * @param {string} description - e.g. 'Medium story started'
 * @param {string|null} storyId
 * @returns {Promise<{ newBalance: number }>}
 */
async function deductCredits(userId, amount, description, storyId = null) {
  const MAX_RETRIES = 2;
  logger.info('[CreditService] Deducting credits', { userId, amount, description, storyId });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      logger.warn('[CreditService] Retrying credit deduction after optimistic lock conflict', { userId, attempt });
    }

    // 1. Read current balance
    const { data: userRow, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('credit_balance')
      .eq('id', userId)
      .single();

    if (fetchErr || !userRow) {
      logger.error('[CreditService] User not found during credit deduction', { userId });
      throw Object.assign(new Error('User not found.'), { statusCode: 404 });
    }

    const currentBalance = userRow.credit_balance;
    logger.debug('[CreditService] Current balance read', { userId, currentBalance, required: amount });

    if (currentBalance < amount) {
      logger.warn('[CreditService] Insufficient credits', { userId, currentBalance, required: amount });
      throw Object.assign(
        new Error(`Insufficient credits. You need ${amount} but have ${currentBalance}.`),
        { statusCode: 402, code: 'INSUFFICIENT_CREDITS' }
      );
    }

    // 2. Atomic conditional decrement (optimistic lock)
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('users')
      .update({ credit_balance: currentBalance - amount })
      .eq('id', userId)
      .eq('credit_balance', currentBalance) // lock: only match if unchanged
      .select('credit_balance')
      .single();

    if (updateErr) {
      logger.error('[CreditService] Credit deduction DB update failed', { userId, error: updateErr.message });
      throw Object.assign(new Error('Failed to deduct credits.'), { statusCode: 500 });
    }

    if (!updated) {
      // Another request changed the balance between read and write — retry
      if (attempt === MAX_RETRIES - 1) {
        logger.error('[CreditService] Credit deduction conflict — max retries exceeded', { userId });
        throw Object.assign(
          new Error('Could not complete credit deduction due to a conflict. Please try again.'),
          { statusCode: 409 }
        );
      }
      continue;
    }

    // 3. Record the transaction
    await supabaseAdmin.from('credit_transactions').insert({
      id: uuidv4(),
      user_id: userId,
      type: 'spend',
      amount: -amount,
      description,
      story_id: storyId,
    });

    logger.info('[CreditService] Credits deducted successfully', {
      userId,
      amount,
      newBalance: updated.credit_balance,
      storyId,
    });

    return { newBalance: updated.credit_balance };
  }
}

/**
 * Refund credits to a user — used when story creation fails after
 * credits have already been deducted.
 *
 * @param {string} userId
 * @param {number} amount
 * @param {string} description
 * @param {string|null} storyId
 */
async function refundCredits(userId, amount, description, storyId = null) {
  logger.info('[CreditService] Refunding credits', { userId, amount, description, storyId });

  // Increment without a lock — refunds are not contended
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('credit_balance')
    .eq('id', userId)
    .single();

  if (!userRow) {
    logger.warn('[CreditService] User not found during refund — skipping', { userId });
    return; // best-effort; user may have been deleted
  }

  await supabaseAdmin
    .from('users')
    .update({ credit_balance: userRow.credit_balance + amount })
    .eq('id', userId);

  await supabaseAdmin.from('credit_transactions').insert({
    id: uuidv4(),
    user_id: userId,
    type: 'refund',
    amount: +amount,
    description,
    story_id: storyId,
  });

  logger.info('[CreditService] Credits refunded', {
    userId,
    amount,
    newBalance: userRow.credit_balance + amount,
    storyId,
  });
}

/**
 * Add credits to a user's balance — used after a successful Stripe payment.
 * Not contended in the same way as deductions, so no optimistic lock needed.
 *
 * @param {string} userId
 * @param {number} amount              - positive integer to add
 * @param {string} description         - e.g. '300 credit pack'
 * @param {string|null} stripePaymentId
 * @returns {Promise<{ newBalance: number }>}
 */
async function addCredits(userId, amount, description, stripePaymentId = null) {
  logger.info('[CreditService] Adding credits', { userId, amount, description, stripePaymentId });

  const { data: userRow, error: fetchErr } = await supabaseAdmin
    .from('users')
    .select('credit_balance')
    .eq('id', userId)
    .single();

  if (fetchErr || !userRow) {
    logger.error('[CreditService] User not found during addCredits', { userId });
    throw Object.assign(new Error('User not found.'), { statusCode: 404 });
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('users')
    .update({ credit_balance: userRow.credit_balance + amount })
    .eq('id', userId)
    .select('credit_balance')
    .single();

  if (updateErr || !updated) {
    logger.error('[CreditService] Failed to add credits', { userId, error: updateErr?.message });
    throw Object.assign(new Error('Failed to add credits.'), { statusCode: 500 });
  }

  await supabaseAdmin.from('credit_transactions').insert({
    id: uuidv4(),
    user_id: userId,
    type: 'purchase',
    amount: +amount,
    description,
    stripe_payment_id: stripePaymentId,
  });

  logger.info('[CreditService] Credits added successfully', {
    userId,
    amount,
    newBalance: updated.credit_balance,
    stripePaymentId,
  });

  return { newBalance: updated.credit_balance };
}

/**
 * Get a user's current credit balance.
 */
async function getBalance(userId) {
  logger.debug('[CreditService] Fetching credit balance', { userId });

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('credit_balance')
    .eq('id', userId)
    .single();

  if (error || !data) {
    logger.error('[CreditService] User not found during getBalance', { userId });
    throw Object.assign(new Error('User not found.'), { statusCode: 404 });
  }

  logger.debug('[CreditService] Balance fetched', { userId, balance: data.credit_balance });
  return data.credit_balance;
}

/**
 * Get paginated credit transaction history for a user.
 * Returns most recent first.
 */
async function getHistory(userId, { limit = 50, offset = 0 } = {}) {
  logger.debug('[CreditService] Fetching credit history', { userId, limit, offset });

  const { data, error } = await supabaseAdmin
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('[CreditService] Failed to fetch credit history', { userId, error: error.message });
    throw new Error('Failed to fetch credit history.');
  }

  logger.debug('[CreditService] Credit history fetched', { userId, count: data?.length });
  return data;
}

module.exports = { deductCredits, refundCredits, addCredits, getBalance, getHistory, STORY_CREDIT_COSTS };
