# Supabase Setup — StoryLoom AI

## 1. Create the Supabase project

1. Go to https://supabase.com → New project
2. Name: `storyloom-ai` | Region: closest to your users
3. Copy **Project URL** and **anon key** → paste into `storyloom-ai/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Also copy the **service_role key** → backend `.env`:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> **Never** expose the service_role key in the mobile app.

---

## 2. Run migrations

In the Supabase Dashboard → **SQL Editor**, run each migration file in order:

```
supabase/migrations/20260407000001_create_tables.sql
supabase/migrations/20260407000002_enable_rls.sql
supabase/migrations/20260407000003_auth_triggers.sql
supabase/migrations/20260407000004_storage_buckets.sql
```

Or, if you have the Supabase CLI installed and linked:

```bash
supabase db push
```

---

## 3. Configure Auth providers

### Email/Password
- Dashboard → **Authentication → Providers → Email** → Enable
- For production: enable "Confirm email"

### Google OAuth
1. [Google Cloud Console](https://console.cloud.google.com) → Create OAuth 2.0 credentials
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Dashboard → **Auth → Providers → Google** → paste Client ID + Secret
4. Add Client ID to `.env`:
   ```
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   ```

### Apple Sign-In
1. [Apple Developer](https://developer.apple.com) → Certificates, IDs & Profiles
   - Create a **Services ID** (e.g. `com.storyloom.ai.signin`)
   - Enable Sign In with Apple, set redirect: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Create a **Key** with Sign In with Apple capability
2. Dashboard → **Auth → Providers → Apple** → paste Services ID, Team ID, Key ID, private key
3. In `app.json` the `ios.bundleIdentifier` (`com.storyloom.ai`) must match your Apple app.

---

## 4. Storage buckets

Migration 004 creates both buckets automatically.  
Verify in Dashboard → **Storage**:

| Bucket | Public | Use |
|--------|--------|-----|
| `character-photos` | No | User-uploaded character reference images |
| `scene-images` | Yes | AI-generated scene images (CDN served) |

---

## 5. Enable pg_cron (optional — Pro plan)

For automatic story expiry (stories expire after 10 days):

1. Dashboard → **Database → Extensions** → enable `pg_cron`
2. Uncomment the `cron.schedule(...)` block in migration 003

On the free plan, the backend's `StoryService.cleanupExpiredStories()` handles this instead.

---

## 6. Verify

After running migrations, check in SQL Editor:

```sql
-- All tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- RLS is on
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public';

-- Trigger exists
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_schema = 'auth';
```

Expected: 6 tables, all `rowsecurity = true`, trigger `on_auth_user_created` present.
