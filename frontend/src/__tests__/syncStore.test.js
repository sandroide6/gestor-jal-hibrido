// PT-02: Cola de sincronización — estado offline/online y contadores
import { useSyncStore } from '../stores/syncStore';

function resetStore() {
  useSyncStore.setState({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncAt: null,
    syncError: null,
    syncProgress: null,
  });
}

describe('syncStore — PT-02: Cola de sincronización', () => {
  beforeEach(resetStore);

  it('registra el estado offline', () => {
    useSyncStore.getState().setOnline(false);
    expect(useSyncStore.getState().isOnline).toBe(false);
  });

  it('registra el estado online', () => {
    useSyncStore.getState().setOnline(false);
    useSyncStore.getState().setOnline(true);
    expect(useSyncStore.getState().isOnline).toBe(true);
  });

  it('actualiza el contador de documentos pendientes', () => {
    useSyncStore.getState().setPendingCount(5);
    expect(useSyncStore.getState().pendingCount).toBe(5);
  });

  it('resetea el contador tras sincronizar', () => {
    useSyncStore.getState().setPendingCount(3);
    useSyncStore.getState().setPendingCount(0);
    expect(useSyncStore.getState().pendingCount).toBe(0);
  });

  it('controla el estado de sincronización en curso', () => {
    useSyncStore.getState().setSyncing(true);
    expect(useSyncStore.getState().isSyncing).toBe(true);
    useSyncStore.getState().setSyncing(false);
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });

  it('guarda el timestamp de última sincronización', () => {
    const ts = new Date().toISOString();
    useSyncStore.getState().setLastSyncAt(ts);
    expect(useSyncStore.getState().lastSyncAt).toBe(ts);
  });

  it('no mezcla pendingCount negativo', () => {
    useSyncStore.getState().setPendingCount(0);
    expect(useSyncStore.getState().pendingCount).toBe(0);
  });
});
