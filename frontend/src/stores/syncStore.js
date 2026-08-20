import { create } from 'zustand';

export const useSyncStore = create((set) => ({
  isOnline: navigator.onLine,
  pendingCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  syncError: null,
  syncProgress: null, // { synced: number, total: number } | null

  setOnline: (online) => set({ isOnline: online }),
  setPendingCount: (n) => set({ pendingCount: n }),
  setSyncing: (v) => set({ isSyncing: v }),
  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),
  setSyncError: (err) => set({ syncError: err }),
}));
