

| STORYLOOM AI *(Working Title)* PRODUCT DEVELOPMENT BIBLE Version 1.0  |  React Native  |  iOS \+ Android |
| :---: |

| Platform iOS \+ Android (React Native) | Backend Supabase (Postgres) |
| :---- | :---- |
| **Story AI** Claude Haiku 4.5 (Anthropic) | **Image AI** FLUX.1 Kontext \[pro\] via fal.ai |
| **Target Audience** 18+ General Adult, Global | **Timeline** 3-6 months to full v1 |
| **Languages** English \+ Hebrew (v1) | **Monetization** Credit-based (pay-per-story) |

| 1  PRODUCT OVERVIEW *Vision, Concept & Unique Value Proposition* |
| :---: |

## **1.1 — Vision Statement**

StoryLoom AI is an AI-powered interactive narrative mobile app where players become the authors of their own cinematic stories. Users upload photos of real people as characters, choose a genre, and experience a dynamically generated story that reacts to their choices — with AI-generated scene images maintaining character consistency across every scene. Every story is unique, personal, and emotionally driven.

## **1.2 — Elevator Pitch**

| *"Episode meets ChatGPT — your face, your story, infinite possibilities."* |
| :---: |

## **1.3 — Core Differentiators (USP)**

* Real character faces — users upload their own photos, AI keeps them consistent across every scene

* True memory system — characters remember emotions, relationships, and history across the full story

* Genre freedom — Romance, Thriller, Fantasy, Horror, Drama, Sci-Fi, and more

* Hybrid player control — choice buttons \+ 1-3 word free-text input

* Smart AI twists — story surprises driven by narrative logic, not random events

* Credit-based model — pay only for what you play, no subscription trap

* Art style selector — user chooses cinematic, anime, realistic, illustrated, or AI-decides

## **1.4 — Comparable Apps**

| App | How StoryLoom Differs |
| :---- | :---- |
| Episode (Pocket Gems) | StoryLoom uses real user photos \+ real AI generation, not pre-written scripts |
| Choices: Stories You Play | StoryLoom has infinite unique stories, not fixed authored content |
| Replika | StoryLoom is story/game focused, not a companion chatbot |
| AI Dungeon | StoryLoom adds consistent AI images \+ character memory \+ mobile-first UX |

| 2  APP NAME SUGGESTIONS *Brand Identity & Naming Options* |
| :---: |

## **2.1 — Recommended Name Candidates**

| Name | Why It Works |
| :---- | :---- |
| StoryLoom AI | Weaving stories — elegant, memorable, unique domain likely available |
| Narrativ | Short, modern, app-store friendly, implies narrative \+ creative |
| SceneAI | Instantly communicates AI \+ cinematic scenes |
| Plotline | Simple, evocative, familiar word with fresh tech context |
| Fable.ai | Timeless word, premium feel, signals storytelling |
| Draftly | Playful, implies creation and authorship |
| InkAI | Writing \+ AI — minimal, clean, brandable |

**Recommendation: StoryLoom AI for formal name, Narrativ as app store display name. Check domain \+ App Store availability before committing.**

| 3  GAMEPLAY & CORE MECHANICS *Game Loop, Scene Structure & Player Agency* |
| :---: |

## **3.1 — Core Gameplay Loop**

1. User creates account (Google / Apple / Email)

2. User receives 100 free credits on signup

3. User starts a new story: completes 3-5 wizard setup questions

4. User uploads 2 character photos \+ names them

5. User selects genre \+ art style (or lets AI decide)

6. User selects story length: Short (8 scenes, 50 credits) / Medium (15 scenes, 100 credits) / Long (25-40 scenes, 175 credits)

7. Credits are deducted — story begins

8. AI generates Scene 1: image \+ text \+ 2-3 choices

9. Player makes a choice (button tap or 1-3 word input)

10. AI updates character memory, decides if twist should occur, generates Scene 2

11. Loop continues until final scene — Ending Screen shown

12. Story saved for 10 days — user can mark as Favourite to keep permanently

## **3.2 — Scene Structure**

Every scene is composed of exactly these elements in this order:

* AI-generated full-screen image (character-consistent via FLUX.1 Kontext)

* Story text block: 2-4 paragraphs of narrative \+ dialogue

* 2-3 choice buttons (tap to proceed)

* Optional free-text input field (1-3 words max, with AI word suggestions)

* Progress bar: Scene X of N

* Undo button (1 undo per story — returns to previous scene state)

## **3.3 — Player Input System**

| Input Type | Details |
| :---- | :---- |
| Choice Buttons | 2-3 pre-generated options per scene. AI writes them dynamically based on story state. |
| Free Text Input | Optional 1-3 word field. AI offers autocomplete suggestions if input is unclear. |
| Undo | One undo per story. Reverts to previous scene snapshot. Cannot be undone again. |
| Word Suggestions | If user types ambiguous input, AI surfaces 3 suggested completions inline. |

## **3.4 — Story Setup Wizard (3-5 Questions)**

When starting a new story, the user answers a short wizard. Claude Code must implement this as a step-by-step screen flow, not a form.

* Step 1 — Genre: Romance / Thriller / Fantasy / Horror / Drama / Sci-Fi / Surprise Me

* Step 2 — Setting: City / Small Town / Fantasy World / Space / Historical / Surprise Me

* Step 3 — Tone: Light & Fun / Dark & Intense / Romantic & Steamy / Mysterious / Surprise Me

* Step 4 — Story Length: Short (50 credits) / Medium (100 credits) / Long (175 credits)

* Step 5 — Art Style: Cinematic / Realistic / Anime / Illustrated / Comic Book / AI Decides

## **3.5 — Story Length & Scene Budget**

| Type | Scenes | Credits | Your Cost | Your Revenue |
| :---- | :---- | :---- | :---- | :---- |
| Short | 8 scenes | 50 credits | \~$0.34 | $0.50 |
| Medium | 15 scenes | 100 credits | \~$0.63 | $1.00 |
| Long | 25-40 scenes | 175 credits | \~$1.04 | $1.75 |

## **3.6 — Twist System**

The AI manages story twists autonomously. Claude Code must implement this as a twist probability engine inside the Story AI service:

* Twists never occur in scenes 1-3 (story setup phase)

* Twist probability increases from scene 4 onward based on story tension score

* Maximum 1 twist per 4 scenes to prevent twist fatigue

* Twist types: Betrayal / Secret Revealed / Unexpected Arrival / Time Jump / Power Shift / Death

* AI selects twist type based on genre \+ current emotional state of characters

* Twist must always be narratively coherent — never random

| 4  CHARACTER SYSTEM *User Characters, Memory Engine & Side Characters* |
| :---: |

## **4.1 — Character Upload**

* User uploads exactly 2 photos: Main Character \+ Secondary Character

* Each character is named by the user (text input, max 20 characters)

* Photos are uploaded to Supabase Storage, served via CDN

* Photos are validated: face must be detectable, no explicit content, max 5MB, JPG/PNG only

* Both photos are stored as reference images and passed to FLUX.1 Kontext on every scene generation

* Optional: User can add 1-3 trait keywords per character (e.g. Brave, Shy, Ambitious) — or skip

## **4.2 — Character Memory Engine**

The Memory Engine is one of the most critical systems. It must be implemented as a persistent JSON object stored in Supabase, updated after every scene. Claude Code must implement this as a dedicated service: MemoryService.

### **Memory Object Structure (per character):**

| {   "character\_id": "uuid",   "name": "string",   "photo\_url": "string",   "traits": \["string"\],   "emotions": { "love": 0-100, "trust": 0-100, "anger": 0-100, "fear": 0-100, "jealousy": 0-100 },   "relationships": \[{ "with": "character\_id", "type": "lover/rival/friend/enemy", "strength": 0-100 }\],   "key\_events": \["string"\],   "secrets": \["string"\] } |
| :---- |

## **4.3 — AI Side Characters**

Side characters are created entirely by the Story AI. The user has no input on them. Rules:

* AI introduces side characters at narratively appropriate moments (never scene 1\)

* Side characters have names, roles, and emotional states generated by AI

* Side characters do not get uploaded photos — they are described in text only, not shown in images

* Side characters are stored in CharacterMemory table with a flag: is\_ai\_generated \= true

* Maximum 3 active side characters at any time to avoid narrative overload

| 5  AI ARCHITECTURE *Story AI, Image AI, Memory Engine & Safety Layer* |
| :---: |

## **5.1 — AI Components Overview**

| Component | Technology & Role |
| :---- | :---- |
| Story AI | Claude Haiku 4.5 — generates scene text, dialogue, choices, memory updates, twist decisions |
| Image AI | FLUX.1 Kontext \[pro\] via fal.ai — generates scene images with character face consistency |
| Memory Engine | Service layer in Node.js backend — reads/writes character state to Supabase after each scene |
| Safety Layer | Pre-filter (input) \+ post-filter (output) using Claude Haiku for content moderation |
| Prompt Cache | System prompt \+ character state cached via Anthropic prompt caching — 90% cost reduction |

## **5.2 — Story AI: Prompt Architecture**

Every scene generation call to Claude Haiku 4.5 must include these components in this exact order:

* SYSTEM PROMPT (cached): App rules, content policy, output format specification, genre tone guide

* CHARACTER STATE (cached): Both character memory objects as JSON

* STORY HISTORY (not cached): Last 5 scene summaries only — not full text — to stay within token budget

* CURRENT SCENE INPUT: Player choice from last scene \+ free text input if provided

* SCENE GENERATION INSTRUCTION: Exact JSON output format with fields: scene\_text, dialogue, choices\[3\], image\_prompt, memory\_updates, twist\_occurred, twist\_type

## **5.3 — Story AI: Output Format**

Claude Code must instruct the Story AI to ALWAYS return valid JSON in this exact format:

| {   "scene\_number": 5,   "scene\_text": "Narrative text here...",   "dialogue": \[{ "character": "name", "line": "text" }\],   "choices": \["Choice A", "Choice B", "Choice C"\],   "image\_prompt": "Detailed FLUX prompt describing the scene...",   "memory\_updates": { "char1": { "emotions": {...}, "key\_events": \[...\] } },   "twist\_occurred": false,   "twist\_type": null,   "story\_tension\_score": 72,   "is\_final\_scene": false } |
| :---- |

## **5.4 — Image AI: FLUX.1 Kontext \[pro\] via fal.ai**

Character consistency is solved by passing the user's uploaded reference photos on EVERY image generation call. Claude Code must implement this in the ImageService:

* Scene 1: Text-to-image call with detailed scene prompt \+ character description

* Scene 2+: Image-to-image call using previous scene image as reference \+ new scene prompt

* Both character reference photos are included in every call as reference images

* Image prompt is generated by Story AI (see image\_prompt field above) — do NOT write image prompts separately

* Generated images are stored in Supabase Storage immediately after generation

* Image generation happens ASYNC — app shows animated loading screen while generating

* Next scene image is pre-generated after player makes a choice (preloading)

## **5.5 — Safety Layer**

Double-filter system. Both filters use Claude Haiku 4.5 with a dedicated safety system prompt:

* PRE-FILTER: Runs on user's free-text input before it reaches the Story AI. Blocks: explicit sexual content involving minors, illegal content, real person defamation, self-harm instructions.

* POST-FILTER: Runs on Story AI output before it reaches the image generator and the app. Blocks: explicit sexual imagery descriptions beyond kissing/embrace, graphic violence, hate speech.

* If either filter triggers: Story AI generates a clean alternative scene automatically. User is NOT informed of the filter — story continues seamlessly.

* Image Safety: fal.ai has built-in NSFW detection. If triggered, a fallback black-screen placeholder is shown with the text overlay continuing.

## **5.6 — AI Performance Strategy**

* Prompt Caching: System prompt \+ character state \= \~70% of input tokens. Cache both for 90% cost reduction on input.

* Scene Preloading: After player makes a choice, immediately begin generating the next scene in background.

* Image Caching: All generated images stored in Supabase Storage \+ served via CDN. Never re-generate an image that was already created.

* Token Budget: Cap story history at last 5 scene summaries (not full text) to prevent context window bloat.

* Model Choice: Claude Haiku 4.5 for all story calls ($1/$5 per MTok) — not Sonnet or Opus. Sufficient quality for narrative generation at 6x lower cost than Sonnet.

| 6  SCREENS & UX DESIGN *All Screens, Navigation & Component Specs* |
| :---: |

## **6.1 — Screen Inventory**

| Screen Name | Purpose |
| :---- | :---- |
| SplashScreen | App logo animation, version check, route to Auth or Home |
| AuthScreen | Google / Apple / Email login. Guest mode NOT supported — account required. |
| OnboardingScreen | 3-slide tutorial shown once after first signup. Explains credits, stories, characters. |
| HomeScreen | Active stories list, credits balance, New Story button, Favourites tab |
| StorySetupWizardScreen | 5-step wizard: genre, setting, tone, length, art style |
| CharacterUploadScreen | Upload 2 photos, name each character, optional traits |
| SceneScreen | Main gameplay screen: image \+ text \+ choices \+ progress \+ undo |
| LoadingSceneScreen | Animated cinematic loading screen shown during AI generation (\~5-15 sec) |
| EndingScreen | Story conclusion, summary of key moments, Save to Favourites option |
| FavouritesScreen | Saved stories — permanent library of marked favourites |
| CreditsScreen | Credit balance, purchase packs, transaction history |
| ProfileScreen | Account settings, language toggle (EN/HE), logout, delete account |
| AdminScreen | Hidden screen — accessible only to admin accounts. User list, story list, flag queue. |

## **6.2 — Scene Screen Layout (Main Gameplay)**

This is the most important screen. Exact layout from top to bottom:

| \[ AI-Generated Scene Image — Full Width, 16:9 ratio \] \[ Progress Bar: Scene 4 of 15 \] \[ Story Text Block: narrative \+ dialogue, scrollable \] \[ Choice Button 1 \] \[ Choice Button 2 \] \[ Choice Button 3 (optional) \] \[ Free Text Input Field (optional, 1-3 words) \] \[ Undo Button (bottom left) \]   \[ Report Button (bottom right) \] |
| :---: |

## **6.3 — Visual Design System**

| Element | Specification |
| :---- | :---- |
| Theme | Light theme only. Clean, cinematic, editorial feel. |
| Primary Font | SF Pro Display (iOS) / Roboto (Android) via React Native defaults |
| Story Text Font | Serif font (Georgia or similar) for narrative immersion |
| Primary Color | \#2E4057 (Deep Navy) |
| Accent Color | \#048A81 (Teal) |
| Background | \#FAFAFA (Near White) |
| Cards/Panels | \#F0F4F8 (Light Blue-Grey) |
| CTA Buttons | Rounded corners (radius: 12px), full width, teal fill |
| Image Aspect Ratio | 16:9 for scene images, full width of screen |
| Animation | Fade-in for new scenes (300ms), slide-up for choice buttons |
| Loading State | Animated cinematic film strip or particle effect while AI generates |
| Inspiration | Episode app structure \+ Apple TV+ cinematic card UI |

| 7  DATABASE ARCHITECTURE *Supabase Schema, Tables & Relationships* |
| :---: |

## **7.1 — Database: Supabase (Postgres)**

All tables below must be created in Supabase. Row Level Security (RLS) must be enabled on all tables. Users can only read/write their own data except where noted.

### **Table: users**

| Column | Type / Notes |
| :---- | :---- |
| id | uuid PRIMARY KEY (Supabase Auth UID) |
| email | text UNIQUE |
| display\_name | text |
| avatar\_url | text nullable |
| credit\_balance | integer DEFAULT 100 (signup bonus) |
| language | text DEFAULT 'en' — 'en' or 'he' |
| is\_admin | boolean DEFAULT false |
| created\_at | timestamptz DEFAULT now() |
| last\_active\_at | timestamptz |

### **Table: stories**

| Column | Type / Notes |
| :---- | :---- |
| id | uuid PRIMARY KEY |
| user\_id | uuid FK users.id |
| title | text (AI-generated title after scene 3\) |
| genre | text |
| setting | text |
| tone | text |
| art\_style | text |
| total\_scenes | integer (8 / 15 / 25-40) |
| current\_scene\_number | integer DEFAULT 0 |
| status | text — 'active' / 'completed' / 'abandoned' |
| credits\_spent | integer |
| is\_favourite | boolean DEFAULT false |
| expires\_at | timestamptz (now \+ 10 days, null if favourite) |
| created\_at | timestamptz DEFAULT now() |
| completed\_at | timestamptz nullable |
| story\_tension\_score | integer DEFAULT 0 |

### **Table: scenes**

| Column | Type / Notes |
| :---- | :---- |
| id | uuid PRIMARY KEY |
| story\_id | uuid FK stories.id |
| scene\_number | integer |
| scene\_text | text |
| dialogue | jsonb — array of {character, line} |
| choices | jsonb — array of choice strings |
| player\_choice | text nullable — what the player chose |
| player\_text\_input | text nullable |
| image\_url | text — Supabase Storage URL |
| image\_prompt | text — FLUX prompt used |
| twist\_occurred | boolean DEFAULT false |
| twist\_type | text nullable |
| is\_undo\_snapshot | boolean DEFAULT false |
| created\_at | timestamptz DEFAULT now() |

### **Table: characters**

| Column | Type / Notes |
| :---- | :---- |
| id | uuid PRIMARY KEY |
| story\_id | uuid FK stories.id |
| name | text |
| role | text — 'main' / 'secondary' / 'ai\_side' |
| photo\_url | text nullable (null for AI side characters) |
| traits | jsonb — array of trait strings |
| emotions | jsonb — {love, trust, anger, fear, jealousy} each 0-100 |
| relationships | jsonb — array of {with\_character\_id, type, strength} |
| key\_events | jsonb — array of event summary strings |
| secrets | jsonb — array of secret strings |
| is\_ai\_generated | boolean DEFAULT false |
| updated\_at | timestamptz |

### **Table: credit\_transactions**

| Column | Type / Notes |
| :---- | :---- |
| id | uuid PRIMARY KEY |
| user\_id | uuid FK users.id |
| type | text — 'purchase' / 'spend' / 'bonus' / 'refund' |
| amount | integer (positive \= added, negative \= spent) |
| description | text — e.g. 'Medium story started' / '300 credit pack' |
| story\_id | uuid nullable FK stories.id |
| stripe\_payment\_id | text nullable |
| created\_at | timestamptz DEFAULT now() |

### **Table: content\_flags**

| Column | Type / Notes |
| :---- | :---- |
| id | uuid PRIMARY KEY |
| story\_id | uuid FK stories.id |
| scene\_id | uuid nullable FK scenes.id |
| reported\_by\_user\_id | uuid FK users.id |
| ai\_flag\_reason | text nullable — auto-generated by safety filter |
| status | text — 'pending' / 'reviewed' / 'dismissed' |
| reviewed\_by\_admin\_id | uuid nullable |
| created\_at | timestamptz DEFAULT now() |

| 8  BACKEND ARCHITECTURE *API Routes, Services & Server Structure* |
| :---: |

## **8.1 — Tech Stack**

| Layer | Technology |
| :---- | :---- |
| Runtime | Node.js 20+ with Express.js |
| Database | Supabase (Postgres \+ Auth \+ Storage \+ Realtime) |
| Auth | Supabase Auth — Google OAuth, Apple Sign-In, Email/Password |
| File Storage | Supabase Storage — character photos \+ generated scene images |
| Story AI | Anthropic SDK — Claude Haiku 4.5 with prompt caching |
| Image AI | fal.ai SDK — FLUX.1 Kontext \[pro\] |
| Payments | Stripe — credit pack purchases |
| Hosting | Railway.app or Render.com (simple Node.js deployment) |
| CDN | Supabase built-in CDN for image delivery |
| i18n | i18next for English/Hebrew translations |

## **8.2 — API Route Map**

| Route | Description |
| :---- | :---- |
| POST /auth/signup | Register new user, create Supabase Auth account, grant 100 credits |
| POST /auth/login | Login with Google / Apple / Email |
| POST /auth/logout | Invalidate session |
| GET /users/me | Get current user profile \+ credit balance |
| PATCH /users/me | Update display name, language preference |
| DELETE /users/me | Delete account \+ all data (GDPR) |
| POST /stories | Create new story — deduct credits, init character records |
| GET /stories | List all active stories for current user |
| GET /stories/:id | Get story details \+ current scene |
| DELETE /stories/:id | Abandon story (no credit refund) |
| POST /stories/:id/scenes | Generate next scene (main AI endpoint) |
| POST /stories/:id/undo | Undo last scene (restore snapshot) |
| PATCH /stories/:id/favourite | Toggle favourite — prevents auto-deletion |
| POST /characters | Create characters for a story (upload processed here) |
| GET /characters/:story\_id | Get all characters \+ current memory state for a story |
| POST /credits/purchase | Initiate Stripe payment for credit pack |
| POST /credits/webhook | Stripe webhook — confirm payment, add credits |
| GET /credits/history | Get transaction history for current user |
| POST /reports | Submit a content report on a scene |
| GET /admin/flags | Admin only — list pending content flags |
| PATCH /admin/flags/:id | Admin only — review/dismiss a flag |
| GET /admin/users | Admin only — user list with stats |

## **8.3 — Service Layer**

Claude Code must implement these as separate service files inside /src/services/:

* StoryService.js — manages story creation, scene sequencing, ending logic

* SceneService.js — calls Story AI, parses response, triggers image generation, saves to DB

* MemoryService.js — reads/writes character state, applies memory\_updates from AI response

* ImageService.js — calls fal.ai FLUX, handles reference images, uploads result to Supabase Storage

* SafetyService.js — pre/post content filtering via Claude Haiku safety prompt

* TwistService.js — evaluates twist probability, injects twist instruction into scene prompt when triggered

* CreditService.js — deducts/adds credits, validates balance before story creation

* StripeService.js — creates payment intents, handles webhooks

* AdminService.js — moderation queue management

| 9  FRONTEND ARCHITECTURE *React Native Structure, Navigation & State* |
| :---: |

## **9.1 — React Native Project Structure**

| /src   /screens     SplashScreen.tsx     AuthScreen.tsx     OnboardingScreen.tsx     HomeScreen.tsx     StorySetupWizardScreen.tsx     CharacterUploadScreen.tsx     SceneScreen.tsx     LoadingSceneScreen.tsx     EndingScreen.tsx     FavouritesScreen.tsx     CreditsScreen.tsx     ProfileScreen.tsx   /components     ChoiceButton.tsx     ProgressBar.tsx     SceneImage.tsx     TextInputWithSuggestions.tsx     CreditBalanceBadge.tsx     StoryCard.tsx     GenreSelector.tsx     ArtStyleSelector.tsx   /navigation     AppNavigator.tsx     AuthStack.tsx     MainStack.tsx   /services     api.ts (Axios instance \+ auth headers)     supabase.ts (Supabase client)   /store     authStore.ts (Zustand)     storyStore.ts (Zustand)     creditStore.ts (Zustand)   /i18n     en.json     he.json     i18n.ts   /assets     fonts/     sounds/     images/   /utils     imageHelpers.ts     creditHelpers.ts     safetyHelpers.ts   /hooks     useStory.ts     useCredits.ts     useAuth.ts |
| :---- |

## **9.2 — State Management (Zustand)**

* authStore: user object, session token, isLoggedIn, login/logout actions

* storyStore: activeStory, currentScene, characterMemory, isGenerating, undoAvailable

* creditStore: balance, transactions, purchase loading state

## **9.3 — Navigation Structure**

* AuthStack: Splash \> Auth \> Onboarding

* MainStack: Home \> StorySetupWizard \> CharacterUpload \> Scene \> Loading \> Ending

* Tab Navigation: Home | Favourites | Credits | Profile

* Deep linking: storyloom://story/:id for resuming stories

| 10  MONETIZATION & BUSINESS MODEL *Credits System, Pricing & Cost Structure* |
| :---: |

## **10.1 — Credit System**

The credit system is the core monetization engine. Every story costs credits. Credits are purchased with real money. The system is designed so every story is profitable.

## **10.2 — Credit Pricing Table**

| Pack | Credits | Price | Cost/Credit | Savings |
| :---- | :---- | :---- | :---- | :---- |
| Starter | 100 credits | $1.00 | $0.010 | — |
| Basic | 300 credits | $2.50 | $0.0083 | 17% |
| Popular | 600 credits | $4.50 | $0.0075 | 25% |
| Value | 1,500 credits | $9.99 | $0.0067 | 33% |
| Mega | 3,500 credits | $19.99 | $0.0057 | 43% |

## **10.3 — Story Cost vs Revenue**

| Story Type | Scenes | Credits | Our Cost | Revenue |
| :---- | :---- | :---- | :---- | :---- |
| Short | \~8 scenes | 50 credits ($0.50) | \~$0.34 | \+47% margin |
| Medium | \~15 scenes | 100 credits ($1.00) | \~$0.63 | \+59% margin |
| Long | 25-40 scenes | 175 credits ($1.75) | \~$1.04 | \+68% margin |

## **10.4 — Free Tier**

* Every new user receives 100 free credits on signup (= 1 free medium story)

* Acquisition cost per user: \~$0.63 — extremely low for a commercial product

* No ongoing free credits — after signup bonus, user must purchase

* Daily cap: 10 stories per day per user (prevents abuse \+ runaway AI costs)

## **10.5 — Revenue Projections**

| Scenario | Monthly Revenue Estimate |
| :---- | :---- |
| 1,000 users, avg 2 medium stories each | \~$2,000 revenue / \~$1,260 AI cost \= $740 profit |
| 5,000 users, avg 3 medium stories each | \~$15,000 revenue / \~$9,450 AI cost \= $5,550 profit |
| 20,000 users, avg 4 medium stories each | \~$80,000 revenue / \~$50,400 AI cost \= $29,600 profit |

## **10.6 — Payment Integration**

* Stripe for all payments — Apple Pay and Google Pay supported automatically

* In-app purchases via Stripe.js (NOT Apple IAP for credit packs — avoids 30% Apple cut on web-initiated purchases)

* Note: If selling inside iOS app natively, Apple IAP is required by App Store rules — consult legal before launch

* Transaction records stored in credit\_transactions table for full audit trail

| 11  SECURITY & COMPLIANCE *Data Protection, Content Policy & Legal* |
| :---: |

## **11.1 — Security Requirements**

* All API calls from app to backend require valid Supabase Auth JWT — no unauthenticated routes except /auth/\*

* AI calls are backend-only — API keys for Anthropic, fal.ai, Stripe NEVER exposed to mobile client

* All images uploaded by users scanned for NSFW content before storage (fal.ai moderation API)

* Face detection validation on character uploads — no faceless photos allowed

* Rate limiting: 60 requests/minute per user on all API routes via express-rate-limit

* All Supabase tables have Row Level Security (RLS) — users cannot access other users' data

* Environment variables: all secrets in .env, never committed to git

## **11.2 — Content Policy**

* No sexual content beyond kissing, embrace, implied intimacy — text can fade to black

* No explicit violence, gore, or torture imagery

* No content targeting minors — users must confirm 18+ on signup

* No real person defamation or non-consensual deepfakes

* No illegal activity instructions embedded in story content

* User-uploaded photos of real people: Terms of Service require user to confirm they have rights to use the photos

## **11.3 — GDPR & Data Compliance**

* Users can delete their account and all associated data via Profile \> Delete Account

* Data deletion cascades: stories, scenes, characters, transactions, flags all deleted

* Privacy Policy must be displayed at signup — link required in App Store submissions

* Story data auto-deleted after 10 days unless marked as favourite

* No data sold to third parties — standard Anthropic/fal.ai/Supabase data processing agreements apply

| 12  ADMIN DASHBOARD *Moderation, Analytics & Management Tools* |
| :---: |

## **12.1 — Admin Dashboard Features**

Admin dashboard is a React web app (separate from the mobile app) or a hidden screen accessible only to is\_admin \= true users. Build as a simple React web dashboard hosted on Vercel.

* User Management: list all users, view credit balance, suspend/ban accounts

* Story Management: view any story, read scene content, view generated images

* Content Flag Queue: list all pending flags, view flagged content, approve/dismiss

* AI Flag Log: view all auto-flagged content from Safety Layer

* Revenue Dashboard: total credits purchased, total stories generated, revenue by day

* Cost Dashboard: total AI API spend by day (Anthropic \+ fal.ai)

* User Growth: signups by day, active users, churn

## **12.2 — Content Moderation Workflow**

13. User taps Report button on a scene

14. Report is submitted to content\_flags table with scene reference

15. AI Safety Layer also auto-flags suspicious content asynchronously

16. Admin receives flag in dashboard queue

17. Admin reviews content: approve (keep) or dismiss (mark story for deletion)

18. If dismissed: story is soft-deleted, user receives automated notification

| 13  DEVELOPMENT WORK PLAN *Phase-by-Phase Build Tasks for Claude Code* |
| :---: |

**Each phase is designed to be run in a separate Claude Code terminal session. Complete Phase 1 before starting Phase 2\. Each task has a Terminal number — use that to identify which Claude Code session to run it in.**

## **PHASE 1 — Project Foundation (Week 1-2)**

| \# | Task | Terminal | Priority | Estimated Time |
| :---- | :---- | :---- | :---- | :---- |
| 1.1 | Initialize React Native project (Expo bare workflow), configure iOS \+ Android build | Terminal 1 | CRITICAL | 2h |
| 1.2 | Set up Supabase project: create all tables, enable RLS, configure Auth providers (Google, Apple, Email) | Terminal 2 | CRITICAL | 3h |
| 1.3 | Set up Node.js/Express backend: folder structure, environment config, Supabase client | Terminal 3 | CRITICAL | 2h |
| 1.4 | Implement Supabase Auth in backend: JWT validation middleware for all protected routes | Terminal 3 | CRITICAL | 2h |
| 1.5 | Implement AuthScreen in React Native: Google Sign-In, Apple Sign-In, Email/Password | Terminal 1 | CRITICAL | 3h |
| 1.6 | Implement user signup flow: create user record in DB, grant 100 credit signup bonus | Terminal 3 | CRITICAL | 1h |
| 1.7 | Set up Zustand stores: authStore, storyStore, creditStore | Terminal 1 | HIGH | 2h |
| 1.8 | Set up React Navigation: AuthStack \+ MainStack \+ Tab Navigator | Terminal 1 | CRITICAL | 2h |
| 1.9 | Set up i18next with English \+ Hebrew translations | Terminal 1 | MEDIUM | 2h |
| 1.10 | Set up Axios API client with JWT interceptor in React Native | Terminal 1 | CRITICAL | 1h |

## **PHASE 2 — Story Setup & Character System (Week 2-3)**

| \# | Task | Terminal | Priority | Estimated Time |
| :---- | :---- | :---- | :---- | :---- |
| 2.1 | Build StorySetupWizardScreen: 5-step wizard (genre, setting, tone, length, art style) | Terminal 1 | CRITICAL | 4h |
| 2.2 | Build CharacterUploadScreen: photo picker, face detection validation, name \+ traits input | Terminal 1 | CRITICAL | 3h |
| 2.3 | Implement character photo upload to Supabase Storage in backend | Terminal 3 | CRITICAL | 2h |
| 2.4 | Implement POST /stories route: create story record, deduct credits, create character records | Terminal 3 | CRITICAL | 3h |
| 2.5 | Implement CreditService: balance check, deduct credits, credit transaction logging | Terminal 3 | CRITICAL | 2h |
| 2.6 | Build HomeScreen: story list cards, credit balance badge, New Story button | Terminal 1 | HIGH | 3h |
| 2.7 | Build CreditsScreen: credit balance, purchase packs UI | Terminal 1 | HIGH | 2h |
| 2.8 | Implement Stripe integration: payment intent creation, webhook handler, credit top-up | Terminal 3 | HIGH | 4h |
| 2.9 | Build OnboardingScreen: 3 slides explaining credits, characters, stories | Terminal 1 | MEDIUM | 2h |

## **PHASE 3 — AI Core: Story & Scene Engine (Week 3-4)**

| \# | Task | Terminal | Priority | Estimated Time |
| :---- | :---- | :---- | :---- | :---- |
| 3.1 | Implement SafetyService: pre/post filter using Claude Haiku safety system prompt | Terminal 3 | CRITICAL | 3h |
| 3.2 | Implement SceneService: build Story AI prompt (system \+ memory \+ history \+ instruction) | Terminal 3 | CRITICAL | 5h |
| 3.3 | Implement prompt caching on Story AI calls (system prompt \+ character state) | Terminal 3 | HIGH | 2h |
| 3.4 | Implement JSON response parser \+ error handling \+ retry logic for Story AI output | Terminal 3 | CRITICAL | 2h |
| 3.5 | Implement MemoryService: read character state from DB, apply memory\_updates, write back | Terminal 3 | CRITICAL | 3h |
| 3.6 | Implement TwistService: twist probability engine, inject twist instruction when triggered | Terminal 3 | HIGH | 2h |
| 3.7 | Implement ImageService: FLUX.1 Kontext calls via fal.ai SDK, reference image passing, Supabase upload | Terminal 4 | CRITICAL | 4h |
| 3.8 | Implement POST /stories/:id/scenes route: full pipeline (safety \> story AI \> memory \> image \> save) | Terminal 3 | CRITICAL | 4h |
| 3.9 | Implement scene preloading: begin generating next scene immediately after player choice received | Terminal 3 | HIGH | 2h |
| 3.10 | Implement POST /stories/:id/undo route: restore scene snapshot, reset memory state | Terminal 3 | MEDIUM | 2h |

## **PHASE 4 — Gameplay Screens (Week 4-5)**

| \# | Task | Terminal | Priority | Estimated Time |
| :---- | :---- | :---- | :---- | :---- |
| 4.1 | Build LoadingSceneScreen: animated cinematic loading UI with progress indication | Terminal 1 | HIGH | 2h |
| 4.2 | Build SceneScreen: full layout — image, progress bar, text, choices, text input, undo, report | Terminal 1 | CRITICAL | 6h |
| 4.3 | Implement TextInputWithSuggestions component: word suggestions from AI when input unclear | Terminal 1 | MEDIUM | 3h |
| 4.4 | Implement choice selection flow: send choice to backend, show LoadingScreen, receive \+ show new scene | Terminal 1 | CRITICAL | 3h |
| 4.5 | Build EndingScreen: story summary, key moments list, Save to Favourites button | Terminal 1 | HIGH | 3h |
| 4.6 | Implement story ending detection: render EndingScreen when is\_final\_scene \= true | Terminal 1 | CRITICAL | 1h |
| 4.7 | Build FavouritesScreen: list of saved stories, read-only summary view | Terminal 1 | HIGH | 2h |
| 4.8 | Implement auto-deletion: Supabase scheduled function to delete stories older than 10 days (not favourite) | Terminal 2 | HIGH | 2h |
| 4.9 | Build ProfileScreen: language toggle, logout, delete account with confirmation | Terminal 1 | MEDIUM | 2h |
| 4.10 | Implement report button: POST /reports from SceneScreen | Terminal 1 | MEDIUM | 1h |

## **PHASE 5 — Admin Dashboard (Week 5-6)**

| \# | Task | Terminal | Priority | Estimated Time |
| :---- | :---- | :---- | :---- | :---- |
| 5.1 | Create React web app for Admin Dashboard (separate from mobile app) | Terminal 5 | HIGH | 2h |
| 5.2 | Build admin auth: is\_admin check, protected admin routes in backend | Terminal 3 | CRITICAL | 1h |
| 5.3 | Build flag queue UI: list pending flags, view content, approve/dismiss actions | Terminal 5 | HIGH | 3h |
| 5.4 | Build user management UI: list users, view details, suspend accounts | Terminal 5 | HIGH | 2h |
| 5.5 | Build revenue \+ cost dashboard: daily charts for revenue, AI spend, signups | Terminal 5 | MEDIUM | 3h |

## **PHASE 6 — Polish, Testing & Launch Prep (Week 6+)**

| \# | Task | Terminal | Priority | Estimated Time |
| :---- | :---- | :---- | :---- | :---- |
| 6.1 | End-to-end testing: full story flow from signup to ending on iOS \+ Android | Terminal 1 | CRITICAL | 4h |
| 6.2 | Performance testing: measure scene generation latency, optimize preloading | Terminal 3 | HIGH | 3h |
| 6.3 | Token budget audit: measure actual tokens per story, validate cost projections | Terminal 3 | HIGH | 2h |
| 6.4 | Safety testing: attempt to jailbreak content filter, verify blocking works | Terminal 3 | CRITICAL | 3h |
| 6.5 | Hebrew RTL layout testing: all screens must render correctly in Hebrew | Terminal 1 | HIGH | 2h |
| 6.6 | App Store assets: screenshots, description, privacy policy URL, age rating (17+) | Terminal 6 | CRITICAL | 3h |
| 6.7 | Google Play assets: same as above, APK build, signing config | Terminal 6 | CRITICAL | 3h |
| 6.8 | Deploy backend to Railway/Render, configure production environment variables | Terminal 3 | CRITICAL | 2h |
| 6.9 | Set up error monitoring: Sentry for React Native \+ backend | Terminal 1 | HIGH | 2h |
| 6.10 | Final review: all API keys rotated, RLS verified, rate limiting confirmed active | Terminal 3 | CRITICAL | 2h |

| 14  ENVIRONMENT VARIABLES *All Required Keys & Configuration* |
| :---: |

## **14.1 — Backend (.env)**

| \# Supabase SUPABASE\_URL=https://xxxx.supabase.co SUPABASE\_SERVICE\_ROLE\_KEY=your\_service\_role\_key \# Anthropic (Story AI \+ Safety Layer) ANTHROPIC\_API\_KEY=sk-ant-xxxxx \# fal.ai (Image Generation) FAL\_KEY=your\_fal\_api\_key \# Stripe (Payments) STRIPE\_SECRET\_KEY=sk\_live\_xxxxx STRIPE\_WEBHOOK\_SECRET=whsec\_xxxxx \# Server PORT=3000 NODE\_ENV=production JWT\_SECRET=your\_jwt\_secret |
| :---- |

## **14.2 — React Native (.env)**

| \# Supabase (public keys only — safe for client) EXPO\_PUBLIC\_SUPABASE\_URL=https://xxxx.supabase.co EXPO\_PUBLIC\_SUPABASE\_ANON\_KEY=your\_anon\_key \# Backend API EXPO\_PUBLIC\_API\_URL=https://your-backend.railway.app \# Stripe (publishable key only) EXPO\_PUBLIC\_STRIPE\_PUBLISHABLE\_KEY=pk\_live\_xxxxx \# Google Sign-In EXPO\_PUBLIC\_GOOGLE\_CLIENT\_ID=xxxxx.apps.googleusercontent.com |
| :---- |

| 15  CLAUDE CODE INSTRUCTIONS *How to Use This Bible with Claude Code* |
| :---: |

## **15.1 — How to Feed This Bible to Claude Code**

* Upload this document to your repository root as: PROJECT\_BIBLE.md (also keep the .docx version)

* At the start of every Claude Code session, say: 'Read PROJECT\_BIBLE.md before starting any work'

* Reference section numbers when giving instructions, e.g. 'Implement Section 8.2 route POST /stories'

* Never start a new phase until all tasks in the previous phase are complete and tested

* Each terminal number in the Work Plan \= a separate Claude Code session or terminal window

## **15.2 — Terminal Session Guide**

| Terminal | What Claude Code Does There |
| :---- | :---- |
| Terminal 1 | React Native frontend — all screens, components, navigation, state management |
| Terminal 2 | Supabase — SQL migrations, RLS policies, Edge Functions, scheduled jobs |
| Terminal 3 | Node.js backend — Express routes, all services, AI integrations, Stripe |
| Terminal 4 | Image pipeline — fal.ai integration, image processing, CDN configuration |
| Terminal 5 | Admin dashboard — React web app, admin routes, analytics UI |
| Terminal 6 | DevOps — deployment configs, app store assets, environment setup |

## **15.3 — Critical Rules for Claude Code**

* NEVER hardcode API keys — always use environment variables

* ALWAYS validate credit balance before creating a story — never allow negative credits

* ALWAYS run SafetyService before sending user input to Story AI

* ALWAYS run SafetyService after receiving Story AI output before sending to image generation or client

* NEVER expose Anthropic or fal.ai API keys to the React Native client — all AI calls go through backend

* ALWAYS use Supabase RLS — test that users cannot access other users' data

* Story AI MUST return valid JSON — implement retry with error correction if parsing fails

* Image generation is ASYNC — never block the user waiting for it synchronously

* Character reference photos MUST be included in every FLUX call — this is what ensures consistency

* Memory updates MUST be saved to DB after every scene — never skip this step

## **15.4 — All Decisions Locked**

| Decision | Confirmed Choice |
| :---- | :---- |
| Platforms | iOS \+ Android (React Native) |
| Languages | English \+ Hebrew (i18next) |
| Target Audience | 18+ General Adult |
| Genres | All genres — user picks at setup |
| Story Length | Short (8) / Medium (15) / Long (25-40) — user picks |
| Active Stories | Unlimited (credit-gated, 10/day cap) |
| Monetization | Credit packs — pay per story |
| Free Tier | 100 credits on signup (1 medium story) |
| Paid Tier | Credit packs ($1 \- $19.99) |
| Login | Google \+ Apple \+ Email/Password |
| Account | Required from first launch |
| Social Sharing | Not in v1 |
| Theme | Light theme only |
| Art Style | User picks from dropdown OR lets AI decide |
| Audio | Background music per genre \+ sound effects |
| Characters | 2 uploaded photos \+ name each, optional traits |
| Side Characters | AI creates automatically |
| Story AI | Claude Haiku 4.5 (Anthropic) |
| Image AI | FLUX.1 Kontext \[pro\] via fal.ai |
| Backend | Supabase \+ Node.js/Express |
| Undo | 1 undo per story |
| Progress | Simple progress bar (Scene X of N) |
| Story Setup | 3-5 step wizard |
| Story Saved | Auto-deleted after 10 days — Favourites saved permanently |
| Story Revisit | Summary of key moments only |
| Notifications | None |
| Admin | Full dashboard \+ moderation queue |
| Reporting | Report button — AI handles flagging |
| Distribution | App Store \+ Google Play |
| Team | 2-5 people |
| Timeline | 3-6 months to full v1 |
| Commercial Intent | Startup / commercial product |

| BIBLE COMPLETE — READY FOR CLAUDE CODE *All decisions locked. All architecture defined. Build can begin.* |
| :---: |

