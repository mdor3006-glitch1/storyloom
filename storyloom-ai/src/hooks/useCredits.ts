import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useCreditStore } from '../store/creditStore';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

/**
 * Keeps the credit store in sync with the server.
 *
 * - Fetches balance + history on mount (when the user is authenticated).
 * - Re-fetches balance whenever the app returns to the foreground.
 * - Exposes `refresh()` for screens that need an immediate server sync
 *   (e.g. after a story is started or a purchase completes).
 */
export function useCredits() {
  const store         = useCreditStore();
  const isLoggedIn    = useAuthStore((s) => !!s.sessionToken);
  const fetchingRef   = useRef(false);

  // ── Fetch balance from server ──────────────────────────────��
  const syncBalance = useCallback(async () => {
    if (!isLoggedIn || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data } = await api.get<{ balance: number }>('/credits/balance');
      store.setBalance(data.balance);
    } catch {
      // Silently fail — the cached store value is still shown
    } finally {
      fetchingRef.current = false;
    }
  }, [isLoggedIn, store]);

  // ── Fetch paginated transaction history ─────────────────────
  const syncHistory = useCallback(async (limit = 50, offset = 0) => {
    if (!isLoggedIn) return;
    try {
      const { data } = await api.get('/credits/history', { params: { limit, offset } });
      store.setTransactions(data.transactions);
    } catch {
      // History is non-critical; silently ignore errors
    }
  }, [isLoggedIn, store]);

  // ── Full refresh (balance + history) ────────────────────────
  const refresh = useCallback(() => {
    return Promise.all([syncBalance(), syncHistory()]);
  }, [syncBalance, syncHistory]);

  // ── Sync on mount ────────────────────────────────────────────
  useEffect(() => {
    if (isLoggedIn) {
      syncBalance();
      syncHistory();
    }
  }, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync on app foreground ───────────────────────────────────
  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') syncBalance();
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [syncBalance]);

  return {
    balance:      store.balance,
    transactions: store.transactions,
    isPurchaseLoading: store.isPurchaseLoading,
    // Local optimistic mutations (used by story creation flow)
    deductCredits: store.deductCredits,
    addCredits:    store.addCredits,
    // Server sync
    refresh,
    syncBalance,
    syncHistory,
  };
}
