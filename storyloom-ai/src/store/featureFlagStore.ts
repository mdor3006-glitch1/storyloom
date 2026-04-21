import { create } from 'zustand';

export interface FeatureFlags {
  new_stage_v2?: boolean;
  [key: string]: boolean | undefined;
}

interface FeatureFlagState {
  flags: FeatureFlags;
  setFlags: (flags: FeatureFlags) => void;
  isEnabled: (key: keyof FeatureFlags) => boolean;
}

export const useFeatureFlagStore = create<FeatureFlagState>((set, get) => ({
  flags: {},
  setFlags: (flags) => set({ flags: flags ?? {} }),
  isEnabled: (key) => Boolean(get().flags[key]),
}));
