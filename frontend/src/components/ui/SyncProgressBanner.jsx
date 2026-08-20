import { useSyncStore } from '../../stores/syncStore';
import { clearSyncQueue, getPendingSyncCount } from '../../db/index';

export default function SyncProgressBanner() {
  const { isSyncing, syncProgress, syncError, pendingCount, isOnline, setSyncError, setPendingCount } =
    useSyncStore();

  async function handleClearQueue() {
    if (!window.confirm('¿Limpiar todos los documentos pendientes? Esta acción no se puede deshacer.')) return;
    await clearSyncQueue();
    const count = await getPendingSyncCount();
    setPendingCount(count);
    setSyncError(null);
  }

  if (syncError) {
    return (
      <div className="bg-red-500 text-white text-sm py-2 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <span className="font-medium">{syncError}</span>
          <button
            onClick={handleClearQueue}
            className="flex-shrink-0 text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md transition-colors"
          >
            Limpiar cola
          </button>
        </div>
      </div>
    );
  }

  if (isSyncing && syncProgress) {
    const { synced, total } = syncProgress;
    const pct = Math.round((synced / total) * 100);
    return (
      <div className="bg-jal-blue-500 text-white py-1.5 px-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <svg className="animate-spin h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <span className="text-xs font-medium flex-1">
            Sincronizando {synced} de {total} documento(s)…
          </span>
          <div className="w-32 bg-white/20 rounded-full h-1.5">
            <div
              className="bg-white rounded-full h-1.5 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-blue-100 w-8 text-right">{pct}%</span>
        </div>
      </div>
    );
  }

  if (!isOnline && pendingCount > 0) {
    return (
      <div className="bg-amber-500 text-white text-center text-xs py-1.5 px-4 font-medium">
        Sin conexión — {pendingCount} documento(s) pendiente(s) de sincronizar
      </div>
    );
  }

  return null;
}
