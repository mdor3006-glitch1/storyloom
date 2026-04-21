import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  credit_balance: number;
  language: 'en';
  is_admin: boolean;
  flags?: Record<string, boolean>;
}

interface AuthState {
  user: User | null;
  sessionToken: string | null;
  isLoggedIn: boolean;
  hasOnboarded: boolean;
  isInitializing: boolean; // true while we check AsyncStorage for an existing session
  login: (user: User, token: string) => void;
  logout: () => void;
  setHasOnboarded: () => void;
  setIsInitializing: (val: boolean) => void;
  updateUser: (partial: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  sessionToken: null,
  isLoggedIn: false,
  hasOnboarded: false,
  isInitializing: true, // start true — resolved by onAuthStateChange

  login: (user, token) =>
    set({ user, sessionToken: token, isLoggedIn: true }),

  logout: () =>
    set({ user: null, sessionToken: null, isLoggedIn: false, hasOnboarded: false }),

  setHasOnboarded: () => set({ hasOnboarded: true }),

  setIsInitializing: (val) => set({ isInitializing: val }),

  updateUser: (partial) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : null,
    })),
}));
