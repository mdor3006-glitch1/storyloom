'use strict';

/**
 * STAGE v2 scene schema validator.
 *
 * Handrolled to avoid new dependencies. Validates the AI's scene response
 * and detects spoiler leaks in filler_dialogue.
 */

const VALID_EMOTIONS  = new Set(['love','anger','sad','surprise','happy','tense','neutral','twist']);
const VALID_TIME      = new Set(['morning','afternoon','evening','night']);
const VALID_WEATHER   = new Set(['clear','cloudy','rain','storm','snow','fog']);
const VALID_TWIST     = new Set(['Betrayal','Secret Revealed','Unexpected Arrival','Time Jump','Power Shift','Death']);
const VALID_ENDING    = new Set(['happy','tragic','twist','secret']);
const VALID_SCENE_TYP = new Set(['A','B']);

const SCHEMA_VERSION = 2;

// Soft-coerce unknown creative emotion tags (e.g. "reflective", "anxious")
// into our UI-rendering whitelist. Keeps validation permissive without
// losing structural integrity.
const EMOTION_ALIASES = {
  // neutral
  reflective:'neutral', contemplative:'neutral', calm:'neutral', thoughtful:'neutral',
  pensive:'neutral', quiet:'neutral', serene:'neutral', focused:'neutral',
  determined:'neutral', resolved:'neutral', silent:'neutral',
  // sad
  melancholic:'sad', somber:'sad', grief:'sad', grieving:'sad', mournful:'sad',
  heartbroken:'sad', disappointed:'sad', lonely:'sad', sorrowful:'sad',
  // happy
  joyful:'happy', joyous:'happy', excited:'happy', elated:'happy', delighted:'happy',
  cheerful:'happy', playful:'happy', amused:'happy', relieved:'happy',
  // love
  affectionate:'love', passionate:'love', tender:'love', loving:'love',
  fond:'love', romantic:'love', adoring:'love', yearning:'love',
  // anger
  furious:'anger', rage:'anger', enraged:'anger', hostile:'anger',
  resentful:'anger', frustrated:'anger', irritated:'anger', bitter:'anger',
  // surprise
  shock:'surprise', shocked:'surprise', stunned:'surprise', astonished:'surprise',
  amazed:'surprise', startled:'surprise', confused:'surprise',
  // tense
  anxious:'tense', nervous:'tense', worried:'tense', afraid:'tense',
  fearful:'tense', apprehensive:'tense', scared:'tense', panicked:'tense',
  distressed:'tense', conflicted:'tense', uncertain:'tense', uneasy:'tense',
  suspicious:'tense', paranoid:'tense', ashamed:'tense', guilty:'tense',
  jealous:'tense', envious:'tense',
};

function coerceEmotion(e) {
  if (!e || typeof e !== 'string') return 'neutral';
  const k = e.toLowerCase().trim();
  if (VALID_EMOTIONS.has(k)) return k;
  if (EMOTION_ALIASES[k]) return EMOTION_ALIASES[k];
  return 'neutral';
}

function isStr(v) { return typeof v === 'string'; }
function isArr(v) { return Array.isArray(v); }
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function isBool(v) { return typeof v === 'boolean'; }
function isNum(v) { return typeof v === 'number' && !Number.isNaN(v); }

/**
 * Validate scene data. Returns { valid, errors[] }.
 * MUTATES input to soft-coerce enum fields (emotion, time_of_day, weather,
 * twist_type, ending_type) so creative AI output doesn't hard-fail. Only
 * structural problems (missing required fields, wrong scene_type, etc.) are
 * treated as hard failures.
 */
function validateScene(scene, { sceneNumber, isFinalScene }) {
  const errors = [];

  if (!isObj(scene)) return { valid: false, errors: ['scene is not an object'] };

  // Scene type & derived — STRICT (load-bearing for UI flow)
  if (!VALID_SCENE_TYP.has(scene.scene_type)) {
    errors.push(`scene_type must be 'A' or 'B' (got ${JSON.stringify(scene.scene_type)})`);
  }
  if (!isBool(scene.can_text_input)) {
    // Soft-coerce missing boolean
    scene.can_text_input = scene.scene_type === 'A';
  } else if (scene.scene_type && scene.can_text_input !== (scene.scene_type === 'A')) {
    // Soft-fix instead of failing
    scene.can_text_input = scene.scene_type === 'A';
  }

  // Scene text
  if (!isStr(scene.scene_text) || !scene.scene_text.trim()) {
    errors.push('scene_text missing or empty');
  }

  // Dialogue — coerce emotions
  if (!isArr(scene.dialogue) || scene.dialogue.length < 2) {
    errors.push('dialogue must be a non-empty array (>=2 lines)');
  } else {
    scene.dialogue.forEach((d, i) => {
      if (!isStr(d.character)) errors.push(`dialogue[${i}].character missing`);
      if (!isStr(d.line) || !d.line.trim()) errors.push(`dialogue[${i}].line missing`);
      d.emotion = coerceEmotion(d.emotion);
    });
  }

  // Choices (2 required unless final scene)
  if (!isArr(scene.choices) || scene.choices.length !== 2) {
    if (!isFinalScene) errors.push(`choices must be exactly 2 (got ${scene.choices?.length})`);
  }

  // Choice hints
  if (!isArr(scene.choice_hints) || scene.choice_hints.length !== 2) {
    if (!isFinalScene) errors.push('choice_hints must be exactly 2');
  }

  // Filler dialogue (required for non-final scenes) — coerce emotions, clamp beat_ms
  if (!isFinalScene) {
    if (!isArr(scene.filler_dialogue) || scene.filler_dialogue.length < 3) {
      errors.push('filler_dialogue must have at least 3 entries');
    } else {
      scene.filler_dialogue.forEach((d, i) => {
        if (!isStr(d.character)) errors.push(`filler_dialogue[${i}].character missing`);
        if (!isStr(d.line) || !d.line.trim()) errors.push(`filler_dialogue[${i}].line missing`);
        d.emotion = coerceEmotion(d.emotion);
        if (d.beat_ms !== undefined) {
          if (!isNum(d.beat_ms)) d.beat_ms = 900;
          else d.beat_ms = Math.max(200, Math.min(4000, d.beat_ms));
        }
      });
    }
  }

  // image_prompt
  if (!isStr(scene.image_prompt) || !scene.image_prompt.trim()) {
    errors.push('image_prompt missing');
  }

  // Optional enums — soft-coerce unknowns (null them out instead of failing)
  if (scene.time_of_day && !VALID_TIME.has(scene.time_of_day)) scene.time_of_day = null;
  if (scene.weather     && !VALID_WEATHER.has(scene.weather))   scene.weather     = null;
  if (scene.twist_type  && !VALID_TWIST.has(scene.twist_type))  scene.twist_type  = null;
  if (scene.ending_type && !VALID_ENDING.has(scene.ending_type)) scene.ending_type = null;

  // tension — clamp rather than reject
  if (scene.story_tension_score !== undefined) {
    if (!isNum(scene.story_tension_score)) scene.story_tension_score = 0;
    else scene.story_tension_score = Math.max(0, Math.min(100, scene.story_tension_score));
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Detect spoiler leak — filler_dialogue must NOT contain unique tokens
 * from either choice. Heuristic: tokenize choices, strip stopwords and
 * short words, require ≥ 1 distinctive token per choice, then check
 * filler for any of those tokens.
 *
 * Returns { clean, offending[] } — offending lists the filler index +
 * leaked tokens when not clean.
 */
const STOPWORDS = new Set([
  // articles / conjunctions / basic prepositions
  'the','a','an','and','or','but','so','to','of','in','on','at','with','by',
  'for','from','into','onto','as','if','then','else','than',
  // auxiliaries / modals / common verbs
  'is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','can','must',
  'get','got','gets','getting','let','lets','keep','keeps','keeping',
  'take','takes','took','taking','make','makes','made','making',
  'say','says','said','saying','tell','tells','told','telling',
  'look','looks','looked','looking','know','knows','knew','knowing',
  'think','thinks','thought','thinking','feel','feels','felt','feeling',
  'want','wants','wanted','wanting','need','needs','needed','needing',
  'come','comes','came','coming','go','goes','going','went','gone',
  'try','tries','tried','trying','give','gives','gave','given',
  'seem','seems','seemed','hear','hears','heard','hearing',
  // pronouns / possessives
  'i','you','he','she','it','we','they','them','myself','yourself',
  'your','my','his','her','their','our','me','us','him','its',
  'yours','mine','ours','theirs','hers',
  // determiners / quantifiers
  'that','this','these','those','what','how','why','where','when','who','which','whom',
  'new','some','any','all','each','every','own','both','either','neither',
  'some','such','one','two','other','another','whole',
  // adverbs / intensifiers (very high-frequency)
  'too','very','more','most','just','even','much','still','really','actually','probably',
  'maybe','perhaps','never','always','often','sometimes','rarely','ever',
  'quite','almost','enough','only','nearly','exactly','simply','merely',
  // negations / particles
  'not','no','yes','up','down','out','off','here','there','now','away','back',
  // generic "pro-nouns" that are not content words
  'thing','things','someone','somebody','something','everyone','everybody',
  'everything','anyone','anybody','anything','no','nobody','nothing',
  'place','places','time','times','way','ways','people','person',
  // temporal / spatial connectives
  'like','about','over','under','after','before','while','during','between','among',
  'through','across','around','behind','inside','outside',
  'today','tonight','tomorrow','yesterday','soon','later','already',
  'again','once','twice',
  // misc high-frequency
  'hey','oh','ah','uh','um','okay','ok','well','right','wrong','real',
]);

function tokenize(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(Boolean);
}

function distinctiveTokens(choice) {
  return tokenize(choice).filter(w => w.length >= 4 && !STOPWORDS.has(w));
}

/**
 * Detect spoiler leak. A filler line is flagged only if:
 *   (a) it contains ≥ 2 distinctive tokens from the SAME choice, OR
 *   (b) it contains a contiguous 3+ word phrase from a choice.
 * This avoids false positives on common English words that coincidentally
 * appear in both a choice and a filler bubble.
 */
function detectSpoilers(scene) {
  if (!Array.isArray(scene.filler_dialogue) || !Array.isArray(scene.choices)) {
    return { clean: true, offending: [] };
  }

  const choiceTokens  = scene.choices.map(distinctiveTokens);   // distinctive sets per choice
  const choiceTokLists = scene.choices.map(c => tokenize(c));    // full token lists for phrase match

  const offending = [];

  scene.filler_dialogue.forEach((d, i) => {
    const line = d.line ?? '';
    const fillerTokens = tokenize(line);
    const fillerSet    = new Set(fillerTokens);

    // (a) ≥ 2 distinctive-token overlap with the SAME choice
    for (let ci = 0; ci < choiceTokens.length; ci++) {
      const overlap = choiceTokens[ci].filter(t => fillerSet.has(t));
      if (overlap.length >= 2) {
        offending.push({ index: i, tokens: overlap, line, choice: ci, reason: 'multi_overlap' });
        return;
      }
    }

    // (b) 3+ consecutive word sequence match with any choice
    for (let ci = 0; ci < choiceTokLists.length; ci++) {
      const choiceSeq = choiceTokLists[ci];
      if (choiceSeq.length < 3) continue;
      for (let start = 0; start <= choiceSeq.length - 3; start++) {
        const phrase = choiceSeq.slice(start, start + 3);
        // Only consider phrase if it has at least one distinctive word
        if (!phrase.some(w => w.length >= 4 && !STOPWORDS.has(w))) continue;
        for (let fs = 0; fs <= fillerTokens.length - 3; fs++) {
          if (
            fillerTokens[fs]     === phrase[0] &&
            fillerTokens[fs + 1] === phrase[1] &&
            fillerTokens[fs + 2] === phrase[2]
          ) {
            offending.push({ index: i, tokens: phrase, line, choice: ci, reason: 'phrase_match' });
            return;
          }
        }
      }
    }
  });

  return { clean: offending.length === 0, offending };
}

module.exports = {
  SCHEMA_VERSION,
  validateScene,
  detectSpoilers,
};
