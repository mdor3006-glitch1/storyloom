import { create } from 'zustand';

export interface CharacterMemory {
  character_id: string;
  name: string;
  photo_url: string | null;
  traits: string[];
  emotions: {
    love: number;
    trust: number;
    anger: number;
    fear: number;
    jealousy: number;
  };
  relationships: Array<{
    with: string;
    type: 'lover' | 'rival' | 'friend' | 'enemy';
    strength: number;
  }>;
  key_events: string[];
  secrets: string[];
}

export interface Scene {
  id: string;
  scene_number: number;
  scene_text: string;
  dialogue: Array<{ character: string; line: string }>;
  choices: string[];
  image_url: string | null;
  is_undo_snapshot: boolean;
  twist_occurred: boolean;
  twist_type: string | null;
  is_final_scene: boolean;
}

export interface Story {
  id: string;
  title: string;
  genre: string;
  setting: string;
  tone: string;
  art_style: string;
  total_scenes: number;
  current_scene_number: number;
  status: 'active' | 'completed' | 'abandoned';
  credits_spent: number;
  is_favourite: boolean;
  completed_at: string | null;
}

interface StoryState {
  activeStory: Story | null;
  currentScene: Scene | null;
  characterMemory: CharacterMemory[];
  isGenerating: boolean;
  undoAvailable: boolean;
  setActiveStory: (story: Story) => void;
  setCurrentScene: (scene: Scene) => void;
  setCharacterMemory: (memory: CharacterMemory[]) => void;
  setIsGenerating: (val: boolean) => void;
  setUndoAvailable: (val: boolean) => void;
  clearStory: () => void;
}

export const useStoryStore = create<StoryState>((set) => ({
  activeStory: null,
  currentScene: null,
  characterMemory: [],
  isGenerating: false,
  undoAvailable: false,

  setActiveStory: (story) => set({ activeStory: story }),
  setCurrentScene: (scene) => set({ currentScene: scene }),
  setCharacterMemory: (memory) => set({ characterMemory: memory }),
  setIsGenerating: (val) => set({ isGenerating: val }),
  setUndoAvailable: (val) => set({ undoAvailable: val }),
  clearStory: () =>
    set({ activeStory: null, currentScene: null, characterMemory: [], undoAvailable: false }),
}));
