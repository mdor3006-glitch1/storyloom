'use strict';

const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

/**
 * Service-role client — bypasses RLS.
 * Used by all backend services for DB reads/writes.
 * NEVER expose this key to the mobile client.
 */
const supabaseAdmin = createClient(
  env.supabase.url,
  env.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Anon client — respects RLS.
 * Used only when we need to act on behalf of a user
 * with their JWT (e.g. validating tokens in auth middleware).
 */
const supabaseAnon = createClient(
  env.supabase.url,
  env.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = { supabaseAdmin, supabaseAnon };
