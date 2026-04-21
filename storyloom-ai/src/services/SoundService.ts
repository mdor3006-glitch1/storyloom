import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MUTE_KEY = 'storyloom_muted';

type SoundKey =
  | 'typewriterTick'
  | 'bubbleAppear'
  | 'choicesAppear'
  | 'choiceTap'
  | 'twistSting'
  | 'storyComplete'
  | 'creditsSpent'
  | 'creditsEarned'
  | 'screenTransition'
  | 'achievementUnlock'
  | 'streakExtend'
  | 'titleReveal'
  | 'harpNote'
  | 'tensionHit'
  | 'minorTone'
  | 'surpriseStab'
  | 'playfulChime'
  | 'tensionDrone'
  | 'twistReveal'
  | 'menuAmbient';

// Map sound keys to bundled asset requires.
// These files live in assets/sounds/ — add them as needed.
// Using require() so Metro bundles them at build time.
const SOUND_MAP: Partial<Record<SoundKey, number>> = {
  // Add assets as they're added to assets/sounds/:
  // typewriterTick:  require('../../assets/sounds/typewriter-tick.mp3'),
  // bubbleAppear:    require('../../assets/sounds/bubble-appear.mp3'),
  // choicesAppear:   require('../../assets/sounds/choices-appear.mp3'),
  // choiceTap:       require('../../assets/sounds/choice-tap.mp3'),
  // twistSting:      require('../../assets/sounds/twist-sting.mp3'),
  // storyComplete:   require('../../assets/sounds/story-complete.mp3'),
  // creditsSpent:    require('../../assets/sounds/credits-spent.mp3'),
  // creditsEarned:   require('../../assets/sounds/credits-earned.mp3'),
  // screenTransition:require('../../assets/sounds/screen-transition.mp3'),
  // achievementUnlock:require('../../assets/sounds/achievement-unlock.mp3'),
  // streakExtend:    require('../../assets/sounds/streak-extend.mp3'),
  // titleReveal:     require('../../assets/sounds/title-reveal.mp3'),
  // harpNote:        require('../../assets/sounds/harp-note.mp3'),
  // tensionHit:      require('../../assets/sounds/tension-hit.mp3'),
  // minorTone:       require('../../assets/sounds/minor-tone.mp3'),
  // surpriseStab:    require('../../assets/sounds/surprise-stab.mp3'),
  // playfulChime:    require('../../assets/sounds/playful-chime.mp3'),
  // tensionDrone:    require('../../assets/sounds/tension-drone.mp3'),
  // twistReveal:     require('../../assets/sounds/twist-reveal.mp3'),
  // menuAmbient:     require('../../assets/sounds/menu-ambient.mp3'),
};

const EMOTION_SOUND_MAP: Record<string, SoundKey> = {
  love:     'harpNote',
  anger:    'tensionHit',
  sad:      'minorTone',
  surprise: 'surpriseStab',
  happy:    'playfulChime',
  tense:    'tensionDrone',
  twist:    'twistReveal',
  neutral:  'bubbleAppear',
};

class SoundServiceClass {
  private players: Partial<Record<SoundKey, AudioPlayer>> = {};
  private menuPlayer: AudioPlayer | null = null;
  private muted = false;
  private initialized = false;
  private typewriterCounter = 0;

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    await setAudioModeAsync({ playsInSilentMode: false });
    const stored = await AsyncStorage.getItem(MUTE_KEY);
    this.muted = stored === 'true';
    // Preload players for all mapped assets
    for (const [key, asset] of Object.entries(SOUND_MAP)) {
      if (!asset) continue;
      try {
        const player = createAudioPlayer(asset as number);
        this.players[key as SoundKey] = player;
      } catch { /* ignore missing asset */ }
    }
  }

  get isMuted() { return this.muted; }

  async setMuted(val: boolean) {
    this.muted = val;
    await AsyncStorage.setItem(MUTE_KEY, String(val));
    if (val) await this.stopMenuMusic();
  }

  play(key: SoundKey, volume = 0.7) {
    if (this.muted) return;
    const player = this.players[key];
    if (!player) return;
    try {
      player.seekTo(0);
      player.volume = volume;
      player.play();
    } catch { /* ignore */ }
  }

  playTypewriterTick() {
    this.typewriterCounter++;
    if (this.typewriterCounter % 3 === 0) {
      this.play('typewriterTick', 0.3);
    }
  }

  playEmotionSound(emotion: string) {
    const key = EMOTION_SOUND_MAP[emotion];
    if (key) this.play(key, 0.4);
  }

  async startMenuMusic() {
    if (this.muted) return;
    const asset = SOUND_MAP.menuAmbient;
    if (!asset) return;
    if (this.menuPlayer) return;
    try {
      const player = createAudioPlayer(asset as number);
      player.loop = true;
      player.volume = 0.25;
      player.play();
      this.menuPlayer = player;
    } catch { /* no music file yet */ }
  }

  async stopMenuMusic(fadeOut = true) {
    const p = this.menuPlayer;
    if (!p) return;
    this.menuPlayer = null;
    if (fadeOut) {
      for (let v = 0.25; v > 0; v -= 0.05) {
        try { p.volume = Math.max(v, 0); } catch { break; }
        await new Promise(r => setTimeout(r, 100));
      }
    }
    try { p.pause(); p.remove(); } catch { /* ignore */ }
  }

  async fadeInMenuMusic() {
    if (this.muted || this.menuPlayer) return;
    await this.startMenuMusic();
    const p = this.menuPlayer as AudioPlayer | null;
    if (!p) return;
    p.volume = 0;
    for (let v = 0; v <= 0.25; v += 0.05) {
      try { p.volume = Math.min(v, 0.25); } catch { break; }
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

export const SoundService = new SoundServiceClass();
export { EMOTION_SOUND_MAP };
