import { create } from 'zustand';

export interface CreditTransaction {
  id: string;
  type: 'purchase' | 'spend' | 'bonus' | 'refund';
  amount: number;
  description: string;
  story_id: string | null;
  created_at: string;
}

interface CreditState {
  balance: number;
  transactions: CreditTransaction[];
  isPurchaseLoading: boolean;
  setBalance: (balance: number) => void;
  setTransactions: (transactions: CreditTransaction[]) => void;
  deductCredits: (amount: number) => void;
  addCredits: (amount: number) => void;
  setPurchaseLoading: (val: boolean) => void;
}

export const useCreditStore = create<CreditState>((set) => ({
  balance: 0,
  transactions: [],
  isPurchaseLoading: false,

  setBalance: (balance) => set({ balance }),
  setTransactions: (transactions) => set({ transactions }),
  deductCredits: (amount) => set((s) => ({ balance: s.balance - amount })),
  addCredits: (amount) => set((s) => ({ balance: s.balance + amount })),
  setPurchaseLoading: (val) => set({ isPurchaseLoading: val }),
}));
