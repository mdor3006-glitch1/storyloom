# StoryLoom AI — STAGE v2 BIBLE

**Status:** Pre-implementation (approved design, zero code written yet)
**Scope:** Full replacement of the scene-generation pipeline and in-scene UX.
**Author context:** Written 2026-04-21. Supersedes the scene-flow portion of `PROJECT_BIBLE.md.md`.
**North star:** Convert the "tap → spinner → scene" loop into a continuous cinematic stage where Type B scenes feel instantaneous and Type A scenes feel conversational, never dead.

---

## Table of contents

1. [North star & product intent](#1-north-star--product-intent)
2. [Current state audit](#2-current-state-audit)
3. [Target architecture](#3-target-architecture)
4. [Scene JSON contract v2](#4-scene-json-contract-v2)
5. [Database schema changes](#5-database-schema-changes)
6. [Pregeneration v2 spec](#6-pregeneration-v2-spec)
7. [Client stage state machine](#7-client-stage-state-machine)
8. [Weaknesses identified in v1 plan](#8-weaknesses-identified-in-v1-plan)
9. [Reinforcements (28)](#9-reinforcements-28)
10. [Upgrades beyond v1 (18)](#10-upgrades-beyond-v1-18)
11. [Phased work plan](#11-phased-work-plan)
12. [Test strategy](#12-test-strategy)
13. [Observability & metrics](#13-observability--metrics)
14. [Feature flag & rollout](#14-feature-flag--rollout)
15. [Risk register & rollback](#15-risk-register--rollback)
16. [Cost model](#16-cost-model)
17. [Acceptance criteria](#17-acceptance-criteria)
18. [Glossary](#18-glossary)

---

## 1. North star & product intent

StoryLoom AI currently forces the user through a `LoadingScene` spinner between every scene. The user-perceived wait is 5–15 s per scene and the story "breathes" only during reading, never during transitions. This plan replaces that with:

- **Type B ("Kinetic") scenes** — instant transitions. Both branches fully pregenerated (text + image + filler). The `LoadingScene` screen is never shown.
- **Type A ("Hub") scenes** — freeform agency. The player can type their own action. Filler dialogue covers the 5–15 s live-gen wait; nothing ever shows a spinner.
- **Stage continuity** — `SceneScreen` is a persistent stage. Scene-to-scene transition is a crossfade inside the same screen, not a navigation.

**Success metric:** p50 perceived wait drops from ~8 s to < 1 s; p90 from ~14 s to < 4 s; average session duration per scene rises from ~4 s to 20–30 s of continuous content.

---

## 2. Current state audit

### 2.1 Pipeline (verified from code at `storyloom-ai/` and `storyloom-backend/`, commit `376e7f9`)

```
SceneScreen.tsx:459 handleChoice()
  ├─ HapticService.choiceTap()
  ├─ setReactionEmoji(...)
  ├─ resumeTypewriterAfterChoice()        // plays remaining bubbles
  └─ setTimeout 4000ms → navigation.navigate('LoadingScene')

LoadingSceneScreen.tsx:101 generate()
  └─ api.post('/stories/:id/scenes')

routes/stories.js:122 POST /:id/scenes
  ├─ load story + characters + last 5 scenes
  ├─ save previous scene's player_choice
  ├─ check PregenerationService cache   (text only)
  │    HIT → skip Claude
  │    MISS → SceneService.generateScene()   (Claude Haiku, 3–6 s)
  ├─ build sceneRow with image_url=''
  ├─ fire ImageService.generateSceneImage() async (NOT awaited)
  ├─ insert scene row, update story, apply memory
  ├─ res.json({scene, is_final_scene})   // returns with no image
  └─ after response: pregenerateNextScenes() for both choices

LoadingScene waits MIN_LOADING_MS=1500, then navigation.replace('Scene')

SceneScreen polls /scenes-current every 3 s (10 polls max) for image_url
```

### 2.2 Latency budget

| Stage | Cache miss | Cache hit |
|---|---|---|
| Claude Haiku scene text | 3–6 s | 0 s |
| FLUX image | 5–10 s | 5–10 s (still live) |
| Client min spinner | 1.5 s | 1.5 s |
| Client choice-tap delay | 4 s | 4 s |
| **Total perceived wait** | **8–15 s** | **5–10 s** |

### 2.3 Efficiency rating: **5/10**

**What works:**
- Claude prompt caching via `cache_control` (`SceneService.js:289`)
- Background text pregeneration for both choices (`PregenerationService.js:77`)
- FLUX Kontext img2img for character consistency
- Safety filter pre+post with retry

**What's broken vs the target UX:**
1. Pregen only covers text; image is always live. Image is the biggest bottleneck (5–10 s) and is never prefetched.
2. Blind navigation to `LoadingScene` for every scene — forced spinner.
3. Hardcoded 4 000 ms client delay + 1 500 ms spinner min = 5.5 s of dead air even on warm cache.
4. Scene arrives imageless; polls every 3 s for up to 30 s — user sees colored placeholder after the spinner already ended.
5. No scene typology. Every scene is identical in shape.
6. No post-choice filler dialogue. The moment the user taps, the fiction ends.
7. `player_text_input` is plumbed in the API but never exposed in the UI after scene 1.
8. Pregen runs *after* image gen finishes — needlessly delays prefetch by 5–10 s.
9. No `scene_type` / `filler_dialogue` / `can_text_input` fields anywhere.

---

## 3. Target architecture

### 3.1 Core concept

`LoadingScene` is removed from the happy path. `SceneScreen` becomes a continuous stage with a state machine:

```
READING → CHOOSING → STALL_FILLER → CROSSFADE → READING(next)
```

During STALL_FILLER, `filler_dialogue` plays while the next scene warms in the background.

### 3.2 Two scene archetypes

**Type A — Hub scene (freeform, high agency)**
- 2 AI-provided choices + freeform text input.
- `can_text_input: true`.
- Used every 3rd–4th scene and always on scene 1 and the final scene.
- Full pregeneration is impossible for the freeform branch. Filler dialogue (10–20 s) covers live gen for freeform path. Declared choices are pregenned best-effort.

**Type B — Kinetic scene (pregen, momentum)**
- 2 choices only. No text input.
- `can_text_input: false`.
- Both branches fully pregenerated (text + image + filler) during the previous scene.
- Transition is a crossfade, no perceived wait.

### 3.3 Cadence rule

AI proposes `scene_type`. Server enforces guardrails:
- Scene 1 → Type A.
- Final scene → Type A.
- No more than 2 consecutive B.
- No more than 1 consecutive A.
- Default pattern: **A-B-B-A-B-B-A…**

### 3.4 Stage phases

| Phase | What the user sees | What the system does |
|---|---|---|
| `reading` | Intro bubbles typing, then choices appear | Pregen of X+1 branches running in background (started at scene reveal) |
| `choosing` | User tapped; choices freeze, reaction emoji | `POST /scenes` fires with choice (skipped if pregen bundle hit) |
| `stall_filler` | `filler_dialogue` bubbles typing | Response arrives; image preloaded; Blurhash shown behind bubbles |
| `crossfade` | Current image fades to next; bubbles fade | 400 ms animation |
| `reading(next)` | New scene's intro bubbles begin | Cycle repeats |

### 3.5 Critical invariant

**The Loading screen never appears except for (a) scene 1 cold start and (b) stall overflow >18 s.** These are bugs or extreme network conditions, not the default path.

---

## 4. Scene JSON contract v2

Defined as a shared Zod schema in `shared/sceneSchema.ts` (new file), imported by both backend `SceneService.js` and client `storyStore.ts`.

```typescript
SceneSchemaV2 = {
  schema_version: 2,
  scene_number: number,
  scene_type: 'A' | 'B',
  can_text_input: boolean,           // must equal (scene_type === 'A')
  scene_text: string,                // 2–4 sentences, ≤ 60 words
  dialogue: Array<{                   // pre-choice bubbles
    character: string,
    line: string,                    // ≤ 10 words
    emotion: EmotionTag,
  }>,
  choices: [string, string],         // exactly 2, 4–8 words each
  choice_hints: [string, string],
  choice_reaction: { emoji: string, character: 'secondary' },
  filler_dialogue: Array<{           // NEW — post-choice stall content
    character: string,
    line: string,                    // ≤ 10 words, branch-agnostic
    emotion: EmotionTag,
    beat_ms: number,                 // 600–1400
  }>,                                // length 4–8, total 30–60 words
  image_prompt: string,
  memory_updates: Record<string, { emotions: {...}, key_events: string[] }>,
  twist_occurred: boolean,
  twist_type: TwistType | null,
  story_tension_score: number,       // 0–100
  time_of_day: TimeOfDay,
  weather: Weather,
  is_final_scene: boolean,
  ending_type: EndingType | null,
  best_quote: string,
}

EmotionTag = 'love' | 'anger' | 'sad' | 'surprise' | 'happy' | 'tense' | 'neutral' | 'twist'
```

### 4.1 Filler dialogue rules (enforced in system prompt + validator)

- **Branch-agnostic.** Must not reveal or commit to either choice's outcome.
- **Emotional reaction only.** Character processing what just happened, not what's next.
- **Validator rejects** filler containing any unique token from either choice's text.
- Good: "You really did that…", "Wait, hold on—", "*she exhales*".
- Bad: "And that's why we went left.", "Let's head to the club now."

---

## 5. Database schema changes

### 5.1 Migration `2026_04_22_stage_v2.sql`

```sql
-- scenes
ALTER TABLE scenes
  ADD COLUMN scene_type      text    NOT NULL DEFAULT 'B' CHECK (scene_type IN ('A','B')),
  ADD COLUMN filler_dialogue jsonb   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN can_text_input  boolean NOT NULL DEFAULT false,
  ADD COLUMN schema_version  integer NOT NULL DEFAULT 2;

-- users (for feature flag)
ALTER TABLE users
  ADD COLUMN flags jsonb NOT NULL DEFAULT '{}'::jsonb;

-- pregen_bundles (replaces in-memory Map)
CREATE TABLE pregen_bundles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id          uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  from_scene_number integer NOT NULL,
  choice_hash       text NOT NULL,             -- sha1(lowercase(trim(choice)))
  choice_text       text NOT NULL,
  scene_data        jsonb,                     -- complete scene JSON v2
  image_url         text,
  blurhash          text,                      -- 20–40 char Blurhash
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','ready','consumed','failed')),
  schema_version    integer NOT NULL DEFAULT 2,
  created_at        timestamptz NOT NULL DEFAULT now(),
  ready_at          timestamptz,
  UNIQUE (story_id, from_scene_number, choice_hash, schema_version)
);

CREATE INDEX pregen_bundles_lookup_idx
  ON pregen_bundles (story_id, from_scene_number, choice_hash, status);

CREATE INDEX pregen_bundles_cleanup_idx
  ON pregen_bundles (status, created_at);
```

### 5.2 Cleanup cron

```sql
-- Run every 15 min via pg_cron (or a setInterval loop in index.js as fallback)
DELETE FROM pregen_bundles
WHERE status IN ('consumed','failed')
   OR created_at < now() - interval '1 hour';
```

Orphaned Supabase storage blobs cleaned by a Node job that lists `scene-images/` and deletes files not referenced in any `scenes.image_url` or `pregen_bundles.image_url`.

### 5.3 Migration safety for in-flight stories

- All existing scenes get `scene_type='B'`, `filler_dialogue='[]'`, `can_text_input=false`, `schema_version=2`.
- Client guard: if `filler_dialogue.length === 0` AND flag is on → fall back to old `LoadingScene` navigation for that one scene only. Next scene generated under v2 contract and works normally.

---

## 6. Pregeneration v2 spec

### 6.1 `PregenerationService.js` (complete rewrite)

**Cache backing:** `pregen_bundles` table (Supabase).

**Public API:**
```js
// Atomic pair pregen; returns only after both branches ready or both failed.
async function pregeneratePair({ storyId, story, characters, currentSceneRow, currentSceneData, recentScenes })

// Consumer-side lookup; marks row as 'consumed' on hit.
async function consumeBundle(storyId, fromSceneNumber, choice) → { sceneData, imageUrl, blurhash } | null

// Called from POST /undo.
async function invalidateFromScene(storyId, fromSceneNumber)

// Admin kill-switch.
async function setPregenEnabled(enabled: boolean)
```

### 6.2 Atomic pair semantics

- Claude for branch A and branch B fire in parallel.
- Each successful Claude → FLUX fires in parallel (bounded by semaphore).
- Each successful FLUX → Blurhash computed → bundle row upserted `status='ready'`.
- **A bundle is only served if `status='ready'`.** Partial failures stay `'pending'` or `'failed'` — never served.
- If one branch fails and the other succeeds → failed branch re-queued once; if still fails → `status='failed'`, consumer falls through to live gen on tap.

### 6.3 Dedup via DB unique constraint

```sql
INSERT INTO pregen_bundles (story_id, from_scene_number, choice_hash, choice_text, status)
VALUES (...)
ON CONFLICT (story_id, from_scene_number, choice_hash, schema_version)
DO NOTHING
RETURNING id;
```

- If `RETURNING id` is null → another worker is already pregenning this branch. Caller awaits existing bundle via polling (every 500 ms for up to 15 s).
- Works across multiple backend instances (horizontal scale ready).

### 6.4 Concurrency ceilings

- `MAX_CONCURRENT_PREGEN_CLAUDE = 6` (per instance)
- `MAX_CONCURRENT_PREGEN_FLUX = 4` (per instance)
- Implemented via `p-limit` or a handrolled counting semaphore.
- Excess calls queue, not error.

### 6.5 Engagement gate

Pregen fires only if **all** hold:
- User flag `new_stage_v2` is on.
- `current_scene_number < total_scenes - 1` (no pregen after penultimate scene).
- `user_credit_balance > 10`.
- App foregrounded (client sends `X-App-State: foreground` header with every request).
- Story was read in the last 30 minutes (activity heuristic).

### 6.6 Predicted-branch priority

- Per-user state: `users.choice_bias = { safe_count, risky_count }`.
- Choice index 0 is treated as "safe" (product convention).
- Pregen fires the predicted branch first (higher priority), the other second.
- Update bias on each choice tap; TTL 90 days of activity.

### 6.7 Per-story budget

- `pregenBudgetPerStory = total_scenes * 2`.
- Tracked in-memory (counter reset on backend restart is acceptable; conservative).
- When exceeded → pregen only the predicted branch (1× instead of 2×).

### 6.8 Tiered image model

- `scene_type === 'A'` OR `twist_occurred` OR `is_final_scene` → FLUX Pro / Kontext Pro.
- `scene_type === 'B'` and not critical → FLUX Schnell (fast, cheap).
- Pro → Schnell fallback if timeout > 12 s.

### 6.9 Pregen-on-read

Pregen kicks the moment `POST /scenes` inserts the scene row (before `res.json`), not after image generation completes. Saves ~5 s of branch warmth.

### 6.10 Request flow with pregen

```
POST /stories/:id/scenes  { player_choice: "Go with her" }
  1. Load story + chars + recent scenes.
  2. Check bundle: SELECT * FROM pregen_bundles
                   WHERE story_id=? AND from_scene_number=? AND choice_hash=?
                     AND status='ready' AND schema_version=2
  3a. HIT → insert scenes row with scene_data + image_url from bundle.
           → UPDATE bundle SET status='consumed'.
           → res.json({scene, is_final_scene}) in ONE response, image included.
  3b. MISS → live Claude → parallel live FLUX → insert with image_url='' → res.json.
            → client-side stall_filler covers the wait, then polls image_url.
  4. Immediately (pregen-on-read) kick pregenPair for scene N+1.
  5. Apply memory updates, update story state.
```

---

## 7. Client stage state machine

### 7.1 State

```ts
type Phase =
  | 'reading'          // bubbles typing then choices revealed
  | 'choosing'         // user tapped; request in-flight; choices frozen
  | 'stall_filler'     // filler_dialogue playing; next scene warming
  | 'crossfade'        // images swapping; bubbles fading
  | 'next_ready';      // swap state → phase becomes reading of next scene
```

Held in a `useReducer` inside `SceneScreen`. No screen navigation during the cycle.

### 7.2 Transition rules

- `reading → choosing`: user taps a choice. Dedup flag set; all Pressables disabled.
- `choosing → stall_filler`: immediately fire `POST /scenes`; begin typewriter on `filler_dialogue`. `choosing` phase may be 0 ms — combined in practice.
- `stall_filler → crossfade`: fires when **both** are true:
  - Filler elapsed >= `MIN_FILLER_MS` (8 000 ms by default).
  - Next scene response received AND `Image.prefetch(next.image_url)` resolved (with up to 3 retries).
- `stall_filler → crossfade` forced: elapsed > `MAX_FILLER_MS` (18 000 ms) → crossfade anyway; image may load after.
- `crossfade → reading(next)`: animation completes (400 ms). State swap atomic.

### 7.3 Minimum scene display

`MIN_SCENE_DISPLAY_MS = 2500`. Prevents scene-mashing on warm caches. Even a Type B instant hit holds the new scene for 2.5 s before allowing another tap.

### 7.4 Cancellable typewriter

- Each typewriter run gets an `AbortController`.
- `useEffect` cleanup calls `abort()`.
- `isMountedRef` checked before every `setState`.
- No more `await setTimeout` state updates after unmount.

### 7.5 AppState handling

```ts
AppState.addEventListener('change', (nextState) => {
  if (nextState === 'background') {
    pauseTypewriter();
    recordElapsedMs();
  }
  if (nextState === 'active') {
    if (elapsedSinceBackground > 60_000) reloadCurrentScene();
    else resumeTypewriter();
  }
});
```

Mirror `phase`, `typedTexts`, `visibleBubbles` to AsyncStorage. On cold app launch → if a persisted state exists < 30 min old, offer "Resume" chip on Home; else discard.

### 7.6 Dual-buffered image stack

```tsx
<Image source={{uri: currentImageUri}}                 style={styles.layerA} />
<Image source={{uri: nextImageUri, placeholder: blurhash}}
       style={[styles.layerB, { opacity: crossfadeAnim }]} />
```

Back layer pre-renders during `stall_filler`. Crossfade is a pure opacity animation — zero navigation cost, zero white flash.

### 7.7 Image prefetch waterfall

```ts
for (const delayMs of [0, 200, 600, 1400]) {
  await sleep(delayMs);
  try { await Image.prefetch(nextImageUri); break; } catch {}
}
// After 3 fails: crossfade anyway, showing Blurhash placeholder.
// Background retry for 30 s, then stop.
```

### 7.8 Skip-filler affordance

Long-press anywhere on the bubble area during `stall_filler` → overlay "Skip filler". Second tap confirms and forces `crossfade` immediately (if next scene ready). Respects agency; default behavior unchanged.

### 7.9 Dedup on choice tap

- Flag `choosing` locks all choice Pressables with `pointerEvents='none'`.
- The choice handler returns early if `phase !== 'reading'`.
- Server-side: `POST /scenes` is idempotent per `(story_id, current_scene_number, player_choice)` — if that combination was just served, return the same scene row (safety net against duplicate requests).

### 7.10 Freeform input UI (Type A only)

- Below the 2 choice buttons, collapsed "Or type your own action…" affordance.
- Expand → TextInput (max 120 chars) + Send button.
- On submit → `handleChoice(text, { isFreeform: true })` → `POST /scenes` with `player_text_input`.
- Cache miss is expected; filler dialogue covers the wait.
- **Cooldown:** after a freeform submission, the next 2 scenes are forced Type B (server honors this) to allow pregen system to recover.

---

## 8. Weaknesses identified in v1 plan

Kept here so future readers understand why the reinforcements exist.

### A. Correctness / failure modes
1. In-memory pregen cache dies on server restart.
2. No versioning on cache bundle shape.
3. No cleanup of orphaned Supabase images.
4. Pregen uncapped — 2× FLUX per scene, no concurrency ceiling.
5. Pregen ignores undo flow — stale bundle served after undo.
6. Pregen hits Claude rate limits if many players pregen simultaneously.
7. Partial cache: one branch succeeds, other fails — asymmetric experience.
8. Pregen traffic not accounted for in `middleware/rateLimit.js`.
9. No safety filter on `filler_dialogue`.
10. Branch-agnostic filler can still leak outcome if AI cheats.

### B. Client state-machine gaps
11. Double-tap fires two requests.
12. Background mid-filler → timers keep running; state corrupts on resume.
13. Typewriter `await setTimeout` fires after unmount.
14. `Image.prefetch` failure → crossfade into white rect.
15. No minimum-stage-time — scenes could flicker past.
16. No skip-filler affordance.

### C. Performance cliffs
17. Fixed filler duration vs variable gen time → dead air or boredom.
18. Claude not streamed — 2 s wasted.
19. No warm start for scene 1.
20. FLUX has no hard timeout — one stuck call blocks a branch forever.

### D. Cost controls
21. Pregen fires for abandoning users (low credits, idle, disengaged).
22. No per-user or per-story pregen budget.
23. FLUX Pro vs Schnell not tiered by scene importance.

### E. Observability / rollout
24. No "perceived wait" metric.
25. No cache hit rate telemetry.
26. No feature flag specified.
27. Migration breaks in-flight stories.
28. No test strategy.

---

## 9. Reinforcements (28)

| # | Fix | Target file(s) |
|---|---|---|
| 1 | Supabase-backed `pregen_bundles` table | migration; `PregenerationService.js` rewrite |
| 2 | `schema_version` stamp on every bundle | `pregen_bundles`, `SceneService.js` |
| 3 | Nightly cleanup cron for orphaned storage | `jobs/cleanupStorage.js` new |
| 4 | Global semaphores: 6 Claude, 4 FLUX | `PregenerationService.js` |
| 5 | Undo invalidation wipes bundles `>= current_scene` | `routes/stories.js` undo handler |
| 6 | Request deduping via `INSERT ON CONFLICT` | `PregenerationService.js` |
| 7 | Atomic pair pregen — only served when both branches ready | `PregenerationService.js` |
| 8 | Pregen traffic tracked in rate-limit bucket `user:pregen` | `middleware/rateLimit.js` |
| 9 | Safety filter extended to concatenated scene+dialogue+filler | `SafetyService.js`, `SceneService.js` |
| 10 | Spoiler validator rejects filler containing choice tokens | `SceneService.js` parse phase |
| 11 | `pointerEvents='none'` on choice layer during `stall_filler` | `SceneScreen.tsx` |
| 12 | AppState handler: pause/resume typewriter, 60 s stale threshold | `SceneScreen.tsx` |
| 13 | Cancellable typewriter via AbortController + isMountedRef | `SceneScreen.tsx` |
| 14 | Image prefetch retry waterfall (0, 200, 600, 1400 ms) | `SceneScreen.tsx` |
| 15 | `MIN_SCENE_DISPLAY_MS = 2500` | `SceneScreen.tsx` |
| 16 | Skip-filler long-press affordance | `SceneScreen.tsx` |
| 17 | Adaptive filler pacing (min 8 s, max 18 s, gates on image-ready) | `SceneScreen.tsx` |
| 18 | Claude streaming + incremental JSON parse | `SceneService.js`, live-gen path |
| 19 | Warm start: scene-1 pregen on `POST /stories` | `routes/stories.js` create handler |
| 20 | FLUX 12 s hard timeout → Schnell fallback | `ImageService.js` |
| 21 | Engagement gate (credits, foreground, activity) | `PregenerationService.js` |
| 22 | Per-story pregen budget | `PregenerationService.js` |
| 23 | Tiered image model (Pro for A/twist/final, Schnell for B) | `ImageService.js` |
| 24 | Emit `perceivedWaitMs` analytics event | `SceneScreen.tsx` |
| 25 | Server metrics: hit/miss/partial/duration/prediction accuracy | `PregenerationService.js` + logger |
| 26 | Feature flag `new_stage_v2` in `users.flags` | migration; `AppNavigator.tsx`; gate |
| 27 | Migration defaults + client fallback for legacy scenes | migration; `SceneScreen.tsx` guard |
| 28 | Unit + integration + E2E tests | `tests/` new, documented in §12 |

---

## 10. Upgrades beyond v1 (18)

| # | Upgrade | Gain |
|---|---|---|
| U1 | Blurhash preview in cache bundle (40 bytes, free) | Visual anticipation during filler |
| U2 | Predicted-branch priority per user bias | Cache hit rate up ~15 % |
| U3 | Pregen-on-read (not pregen-on-write) | −5 s branch warmth |
| U4 | Claude streaming + incremental typewriter | −2 s perceived latency on live gen |
| U5 | Dual-layer image stack (back buffer) | 60 fps crossfade, zero flash |
| U6 | Warm wizard — scene 1 gen at create-story | Scene 1 spinner gone |
| U7 | Tiered image model (A=Pro, B=Schnell) | Cost ↓ ~60 % on B scenes |
| U8 | Haptic + audio choreography per phase | Cinematic feel |
| U9 | Resume from AsyncStorage on relaunch | Prevents mid-story loss |
| U10 | A/B via feature flag cohort (control vs v2) | Data-driven validation |
| U11 | Mini-map pregen indicator (debug-only HUD) | QA / ops visibility |
| U12 | Idle-detect boost (user slow to choose → boost pregen) | Cache hit rate on slow players |
| U13 | Scene-1 placeholder art (genre gradient + plumbob) | Premium feel while FLUX runs |
| U14 | AI-guided typology with server guardrails | Better pacing than pure rule |
| U15 | Freeform input cooldown (2 forced B after) | Cost recovery |
| U16 | Cross-instance pregen dedup via DB row lock | Horizontal-scale ready |
| U17 | Zod schema for scene JSON (shared client/server) | Runtime validation, AI retry on mismatch |
| U18 | Kill-switch admin endpoint | Incident response |

---

## 11. Phased work plan

Total estimate: **~14 dev days** single-engineer, gated by review checkpoints.

### Phase 0 — Baseline telemetry (0.5 day)

**Goal:** quantify "before" numbers for plan rating.

- Add client log in `LoadingSceneScreen.tsx:101` capturing `Date.now() - startTime` at navigation.
- Add server log in `routes/stories.js:230` delta between insert and res.json.
- Record 20 manual plays, average both durations.
- Publish baseline table in this file's §17.

**Deliverable:** baseline latency numbers committed to the repo.

### Phase 1 — Data model & feature flag (1 day)

**Files:**
- `storyloom-backend/migrations/2026_04_22_stage_v2.sql` (new) — see §5.1.
- `storyloom-backend/src/config/supabase.js` — no change.
- `storyloom-ai/src/store/storyStore.ts:24` — extend `Scene` interface with `scene_type`, `filler_dialogue`, `can_text_input`, `schema_version`.
- `storyloom-ai/src/store/featureFlagStore.ts` (new) — read `users.flags.new_stage_v2` on auth.
- `storyloom-backend/src/routes/auth.js` — include `flags` in user payload.

**Acceptance:** Migration runs; flag is off for all users; no behavior change.

### Phase 2 — AI contract v2 (1 day)

**Files:**
- `shared/sceneSchema.ts` (new) — Zod schema per §4.
- `storyloom-backend/src/services/SceneService.js:12` — update `SCENE_SYSTEM_PROMPT`:
  - Add scene_type / filler_dialogue / can_text_input / schema_version fields.
  - Add cadence guardrails (scene 1 = A, final = A, no >2 consecutive B, no >1 consecutive A).
  - Add spoiler rule for filler.
  - Enable `stream: true` on `anthropic.messages.create`.
- `storyloom-backend/src/services/SceneService.js:155` — `parseWithRetry`:
  - Validate parsed JSON against Zod schema.
  - Run spoiler validator on `filler_dialogue` vs `choices`.
  - One retry on schema fail; throw on second fail.
- `storyloom-backend/src/services/SafetyService.js` — accept concatenated scene+dialogue+filler string.

**Acceptance:** 10 test scene generations pass schema + spoiler validation. Output contains non-empty `filler_dialogue`.

### Phase 3 — Pregeneration v2 (2.5 days)

**Files:**
- `storyloom-backend/src/services/PregenerationService.js` — full rewrite per §6.
  - Supabase-backed bundle table.
  - `pregeneratePair` atomic semantics.
  - Dedup via `ON CONFLICT`.
  - Semaphores (`p-limit`).
  - Engagement gate.
  - Per-story budget.
  - Predicted-branch priority.
  - Blurhash computation via `blurhash` npm package.
  - 12 s FLUX timeout → Schnell fallback.
  - Kill-switch (reads env + `system_flags` row).
  - Structured metric logs.
- `storyloom-backend/src/services/ImageService.js:47` — tiered model selection from `sceneType` param; Pro→Schnell fallback.
- `storyloom-backend/src/middleware/rateLimit.js` — add `user:pregen` bucket.
- `storyloom-backend/src/jobs/cleanupPregen.js` (new) — cron 15 min; delete expired rows; delete orphaned storage blobs.
- `storyloom-backend/src/index.js` — start cleanup job on boot.

**Acceptance:**
- Create test story, generate scene → `pregen_bundles` has 2 rows `status='ready'` within 12 s.
- Simulate FLUX timeout → fallback Schnell completes; bundle still reaches `ready`.
- Restart backend → next POST /scenes hits bundle (survives restart).
- Force partial failure on one branch → neither branch served (atomic).

### Phase 4 — Backend route wiring (0.5 day)

**Files:**
- `storyloom-backend/src/routes/stories.js:122` (`POST /:id/scenes`):
  - Replace cache lookup with `consumeBundle()`.
  - On hit: insert scene row with full `scene_data + image_url`; response includes image.
  - On miss: live path as today, but kick `pregeneratePair` for N+1 **before** `res.json`, not after.
  - Remove the `imagePromise.then(pregen…)` chain.
- `storyloom-backend/src/routes/stories.js:275` (`POST /:id/undo`):
  - Call `invalidateFromScene(storyId, currentSceneNumber - 1)`.
- `storyloom-backend/src/routes/stories.js:20` (`POST /stories`):
  - After `createStory` resolves, kick `warmStartScene1(storyId)` async. (U6)
- Idempotency key on POST /scenes: `(story_id, current_scene_number, player_choice_hash)` — in-memory TTL 5 s.

**Acceptance:** Warm-cache tap returns complete scene (with image) in a single response. Undo invalidates bundles correctly.

### Phase 5 — Client stage state machine (4 days, highest risk)

**Files:**
- `storyloom-ai/src/screens/SceneScreen.tsx` — deep refactor per §7.
  - `useReducer` state machine with phases.
  - Cancellable typewriter (AbortController + isMountedRef).
  - AppState handler with pause/resume.
  - AsyncStorage mirror of phase + typedTexts + visibleBubbles (U9).
  - Dual-buffered image stack.
  - Image prefetch waterfall.
  - MIN_SCENE_DISPLAY_MS guard.
  - Skip-filler long-press overlay.
  - Dedup on choice tap.
  - Legacy scene guard (`filler_dialogue.length === 0` → old navigation path).
- `storyloom-ai/src/screens/LoadingSceneScreen.tsx` — gate behind `reason === 'first_scene' | 'stall_overflow'`.
- `storyloom-ai/src/navigation/MainStack.tsx:48` — extend `LoadingScene` params with `reason`.
- `storyloom-ai/src/services/api.ts` — add `X-App-State` header; add `X-Client-Version`.
- `storyloom-ai/src/hooks/useSceneStage.ts` (new) — extracts state-machine logic for testability.
- Haptic + audio wiring (U8) for each phase transition.
- Feature-flag gate: if flag off → render old SceneScreen behavior (fallback component preserved).

**Acceptance:**
- Type B tap → crossfade within 500 ms of tap, no spinner, MIN_SCENE_DISPLAY_MS respected.
- Type A tap → filler plays 8–18 s, then crossfade.
- Background mid-filler → foreground → state restored.
- Double-tap → single request.
- Long-press during filler → skip affordance appears.

### Phase 6 — Freeform Type A UI (1 day)

**Files:**
- `storyloom-ai/src/screens/SceneScreen.tsx` — `FreeformChoiceSheet` component.
- `storyloom-ai/src/services/api.ts` — already supports `player_text_input`.
- Server: freeform cooldown (U15) — next 2 scenes forced Type B.

**Acceptance:** Type A scene shows text input; 120 char limit; submit triggers live-gen covered by filler.

### Phase 7 — Warm start scene 1 (0.5 day)

**Files:**
- `storyloom-backend/src/services/StoryService.js:49` (`createStory`) — after story+characters inserted, kick a background job that generates scene 1 and writes it to a pseudo-bundle row keyed `from_scene_number=0, choice_hash='__scene_1__'`.
- `storyloom-ai/src/screens/LoadingSceneScreen.tsx` (scene-1 path) — poll that bundle first; if ready use it, else live gen.

**Acceptance:** Scene 1 visible within 2 s of wizard completion (warm path) or 8 s (cold).

### Phase 8 — Tiered image model (0.25 day)

**Files:**
- `storyloom-backend/src/services/ImageService.js:47` — accept `sceneType`, `twistOccurred`, `isFinalScene`; select Pro vs Schnell.
- Downstream callers pass the flags.

**Acceptance:** B-scenes use Schnell (verify via logs); A / twist / final use Pro.

### Phase 9 — Audio & haptic choreography (0.5 day)

**Files:**
- `storyloom-ai/src/services/SoundService.ts` — add `sceneTransition` sound asset.
- `storyloom-ai/src/services/HapticService.ts` — add `stageTransition` haptic pattern.
- `SceneScreen.tsx` — wire to phase transitions.

**Acceptance:** No dead silence between phases. Subtle haptic tick at every bubble, louder transition at crossfade.

### Phase 10 — Tests (2 days)

Implemented per §12.

**Acceptance:** All unit + integration tests green; E2E QA checklist walked once with results logged.

### Phase 11 — Observability (0.5 day)

**Files:**
- `storyloom-backend/src/routes/admin.js` — add `GET /admin/metrics/stage_v2` returning aggregated 24 h metrics.
- Optional: hook into `storyloom-admin/` dashboard.

**Acceptance:** Dashboard stub shows cache hit rate, p50/p90 perceivedWaitMs, partial failure rate, prediction accuracy.

### Phase 12 — Rollout (0.5 day)

- Enable `new_stage_v2` flag for developer account.
- Play through 3 full stories (one of each genre cluster). Log perceivedWaitMs.
- If p50 < 1.5 s and zero crashes over 24 h → ramp to 1 %.
- 24 h stable → 10 %.
- 72 h stable → 100 %.
- Kill switch verified live before 100 %.

---

## 12. Test strategy

### 12.1 Unit

- `PregenerationService.test.js`
  - Dedup on `ON CONFLICT`.
  - Concurrency cap respected (inject delay, count overlaps).
  - Schema-version rejection of stale bundles.
  - Atomic partial-fail handling.
  - Engagement gate: low credits → no pregen fired.
  - Per-story budget exceeded → single-branch pregen only.
  - Undo invalidation wipes correct rows.
- `SceneService.test.js`
  - Schema Zod validation on mocked Claude responses.
  - Cadence rule enforced (scene 1 A, final A, no >2 B).
  - Spoiler validator rejects bad filler.
- `SafetyService.test.js`
  - Concatenated text filtering.
  - False-positive regression cases.

### 12.2 Integration (API-level, real DB, mocked Claude/FLUX)

- `scenes.integration.test.js`
  - Full flow: create → first scene → choice → pregen fires → second scene served from bundle (zero new Claude/FLUX calls, asserted via mock counts).
  - Undo flow → bundles wiped.
  - Freeform submission → cache miss → live gen.
  - Restart backend mid-story → bundle survives, next scene warm.

### 12.3 E2E / manual QA checklist

- Type B scene: tap choice → crossfade within 500 ms, no spinner.
- Type A scene: tap choice → filler plays 8–18 s → crossfade.
- Network throttled to 3G: pregen still completes < 15 s; graceful fallback otherwise.
- Background-foreground mid-filler: state restored, no crash.
- Force-kill app mid-filler: relaunch resume works.
- Double-tap choice: single request fires.
- FLUX simulated 503: Schnell fallback kicks in; UX uninterrupted.
- Freeform input: 120 char limit enforced; submission works; cooldown verified (next 2 scenes are B).
- Kill-switch: admin flips → next request serves live-gen only, no bundle lookup.

---

## 13. Observability & metrics

### 13.1 Server-side (via Winston + aggregation endpoint)

| Metric | Source | Target |
|---|---|---|
| `pregen.hit` | `consumeBundle` | count per scene-tap |
| `pregen.miss` | `consumeBundle` | count per scene-tap |
| `pregen.partial_fail` | `pregeneratePair` atomic failure | count per story |
| `pregen.duration_ms` | per-branch gen time | p50/p90/p99 |
| `pregen.cache_hit_rate` | derived | ≥ 85 % target |
| `pregen.branch_predicted_correct` | bias vs actual tap | ≥ 70 % target |
| `image.model_used` | ImageService | Pro vs Schnell ratio |
| `image.timeout_fallback_count` | ImageService | < 2 % target |

### 13.2 Client-side (analytics events)

| Event | Payload |
|---|---|
| `stage.choice_tap` | storyId, sceneNumber, choiceIndex, isFreeform |
| `stage.perceived_wait_ms` | ms between choice tap and first bubble of next scene |
| `stage.crossfade` | filler_ms, next_scene_ready_ms |
| `stage.fallback_loading` | reason (`first_scene`, `stall_overflow`) |
| `stage.resume_from_background` | elapsed_ms, successful |

### 13.3 Dashboard

- Endpoint: `GET /admin/metrics/stage_v2?window=24h`
- Optional render: `storyloom-admin/src/pages/stage.tsx` (out of scope for initial rollout).

---

## 14. Feature flag & rollout

### 14.1 Flag storage

- Table: `users.flags jsonb`.
- Key: `new_stage_v2: true | false` (default absent = false).
- Global kill-switch: `system_flags` table row `pregen_enabled`.

### 14.2 Ramp plan

| Step | Cohort | Gate |
|---|---|---|
| 0 | Developer account only | Phase 5 merged |
| 1 | 1 % random | 24 h stable + p50 wait < 1.5 s |
| 2 | 10 % random | 72 h stable + no cost anomalies |
| 3 | 50 % random | 72 h stable + cache hit ≥ 80 % |
| 4 | 100 % | 7 d stable |

### 14.3 Rollback

- Disable flag for user → next request serves old flow (SceneScreen legacy branch).
- Disable global kill-switch → no pregen fires; live-gen fallback for all. Old LoadingScene resurfaces.
- All reversible from admin panel; no deploy needed.

---

## 15. Risk register & rollback

| Risk | Likelihood | Impact | Mitigation | Rollback |
|---|---|---|---|---|
| FLUX cost doubles | High | High | Tiered model + engagement gate + budget | Kill-switch → live gen only |
| Claude rate limits hit | Medium | Medium | Dedup + semaphore + per-user bucket | Kill-switch |
| Cache inconsistency | Low | High | Schema versioning + atomic bundles + undo invalidation + Zod | Admin cache purge endpoint |
| Client state machine bug | Medium | High | Reducer + AbortController + AppState + resume + tests | Per-user flag off |
| Mid-flight deploy breaks players | Low | Medium | Supabase-backed cache; schema version stamp | Standard deploy rollback |
| Cost spike under load | Medium | High | Global + per-user + per-story budgets; kill-switch | Instant via admin flag |
| Blurhash package compat issue | Low | Low | Blurhash is optional; fallback to solid color | Disable blurhash emission |
| Streaming Claude parser errors | Medium | Low | Fallback to non-streaming call on parse fail | Disable streaming flag |

---

## 16. Cost model

### 16.1 Current (per scene played)
- 1 × Claude Haiku call
- 1 × FLUX Schnell/Kontext call
- 1 × Claude Haiku pregen call (text only)

### 16.2 v2 gross (per scene played, no gates)
- 1 × Claude Haiku (live or cache)
- 1 × FLUX (live or cache)
- 2 × Claude Haiku (pregen both branches)
- 2 × FLUX (pregen both branches)

That's **2×** FLUX gross.

### 16.3 v2 after reinforcements

| Reduction | Effect |
|---|---|
| Engagement gate (≈20 % of users fail gate) | ×0.80 |
| Per-story budget | ×0.95 |
| Tiered model (B = Schnell, cheaper) | average unit cost ×0.6 |
| Prediction priority (predicted branch more likely consumed) | no cost change but raises hit rate |
| Freeform cooldown (forces B, which is cheaper) | ×0.98 |

**Net estimate:** **≈ +25 %** total AI spend for **−80 to −95 %** perceived wait and **+5–10×** in-scene engagement time. Accepted trade.

### 16.4 Budget ceilings

- `MAX_CONCURRENT_PREGEN_CLAUDE = 6` per instance.
- `MAX_CONCURRENT_PREGEN_FLUX = 4` per instance.
- `pregenBudgetPerStory = total_scenes * 2`.
- `user:pregen` rate-limit bucket.
- Kill-switch flips all of the above to zero.

---

## 17. Acceptance criteria

Global gate for shipping v2 at 100 %:

- [ ] Phase 0 baseline measured and logged.
- [ ] Phase 1 migration applied; no behavior change while flag off.
- [ ] Phase 2 AI contract produces valid v2 scenes 100 % of the time over 100 generations.
- [ ] Phase 3 pregen: 85 % of Type B taps served from cache (bundle hit) in normal conditions.
- [ ] Phase 3 pregen: 0 % asymmetric partial-failure served (atomicity holds).
- [ ] Phase 4 POST /scenes returns complete scene (with image) in one response on bundle hit.
- [ ] Phase 5 SceneScreen state machine: no state updates on unmounted component, confirmed via RN strict mode + tests.
- [ ] Phase 5 background/foreground survival: 10 consecutive backgrounds of 5–30 s each have zero resume errors.
- [ ] Phase 6 freeform: 120 char limit; cooldown forces 2 B scenes.
- [ ] Phase 7 warm start: scene 1 perceived wait p50 ≤ 3 s.
- [ ] Phase 8 tiered model: image cost ratio (Schnell/Pro) ≥ 2:1 in normal play.
- [ ] Phase 9 audio: no silent phase transitions.
- [ ] Phase 10 all tests green.
- [ ] Phase 11 dashboard shows live metrics.
- [ ] Phase 12 rollout at 100 % stable for 7 days.

Ship criteria:
- p50 perceived wait Type B: **< 1 s**
- p50 perceived wait Type A: **< 4 s**
- Cache hit rate: **≥ 85 %**
- Crash-free sessions: **≥ 99.5 %**
- Cost increase: **≤ +30 %** vs current baseline
- No rollback within the ramp window

---

## 18. Glossary

| Term | Definition |
|---|---|
| Stage | The persistent `SceneScreen` that hosts all phases of a scene-to-scene transition. |
| Type A scene | Hub scene with 2 AI choices + freeform text input. |
| Type B scene | Kinetic scene with 2 choices only; both branches pregenned. |
| Bundle | Complete pregenerated payload: scene data + image URL + Blurhash. |
| Filler dialogue | Branch-agnostic reaction bubbles played AFTER choice while next scene warms. |
| Crossfade | 400 ms opacity animation swapping scene images + bubbles. |
| Pregen-on-read | Triggering pregen the moment `POST /scenes` returns the row (not after image). |
| Engagement gate | Pre-conditions that must hold for pregen to fire (credits, foreground, activity). |
| Warm start | Pregenerating scene 1 at story-creation time. |
| Kill switch | Global flag that disables pregen system-wide for incident response. |
| schema_version | Integer stamp on every AI response and bundle; mismatched versions are ignored. |
| Blurhash | 20–40 char string encoding a blurred preview of an image (~60 bytes). |

---

**End of bible.** Next action: execute Phase 0 on confirmation.
