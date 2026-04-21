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
const BALANCE_THROTTLE_MS = 30_000; // auto-syncs at most once per 30s

export function useCredits() {
  const store         = useCreditStore();
  const isLoggedIn    = useAuthStore((s) => !!s.sessionToken);
  const fetchingRef   = useRef(false);
  const lastSyncRef   = useRef<number>(0);

  // ── Fetch balance from server ─────────────────────────────────
  // force=true bypasses the throttle (used by explicit refresh() calls)
  const syncBalance = useCallback(async (force = false) => {
    if (!isLoggedIn || fetchingRef.current) return;
    if (!force && Date.now() - lastSyncRef.current < BALANCE_THROTTLE_MS) return;
    fetchingRef.current = true;
    try {
      const { data } = await api.get<{ balance: number }>('/credits/balance');
      store.setBalance(data.balance);
      lastSyncRef.current = Date.now();
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

  // ── Full refresh (balance + history) — bypasses throttle ────
  const refresh = useCallback(() => {
    return Promise.all([syncBalance(true), syncHistory()]);
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
