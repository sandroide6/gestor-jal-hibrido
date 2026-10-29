import { useState } from 'react';
import { useSyncStore } from '../../stores/syncStore';
import { clearSyncQueue, getPendingSyncCount } from '../../db/index';
import { ConfirmDialog } from './Dialog';
import Icon from './Icon';
import Spinner from './Spinner';

// Progreso y errores del envío de documentos creados sin conexión.
export default function SyncProgressBanner() {
  const { isSyncing, syncProgress, syncError, pendingCount, setSyncError, setPendingCount } = useSyncStore();
  const [confirming, setConfirming] = useState(false);

  async function handleClearQueue() {
    await clearSyncQueue();
    setPendingCount(await getPendingSyncCount());
    setSyncError(null);
    setConfirming(false);
  }

  if (syncError) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-danger-border bg-danger-bg px-4 py-2.5 text-danger-fg">
        <span className="flex items-center gap-2 font-semibold"><Icon name="error" size={18} />{syncError}</span>
        {pendingCount > 0 && (
          <button type="button" onClick={() => setConfirming(true)} className="btn-danger-outline btn-sm">
            Descartar los {pendingCount} pendientes…
          </button>
        )}
        {confirming && (
          <ConfirmDialog
            danger
            title="¿Descartar los documentos pendientes?"
            message={`Se borrarán de este equipo los ${pendingCount} documentos que no se han enviado. No llegarán al sistema y no se puede deshacer.`}
            confirmLabel="Sí, descartarlos"
            onConfirm={handleClearQueue}
            onCancel={() => setConfirming(false)}
          />
        )}
      </div>
    );
  }

  if (isSyncing && syncProgress?.total) {
    const { synced, total } = syncProgress;
    const pct = Math.round((synced / total) * 100);
    return (
      <div role="status" className="flex items-center gap-3 border-t border-info-border bg-info-bg px-4 py-2 text-info-fg sm:px-6 lg:px-10">
        <Spinner />
        <span className="flex-1 font-semibold">Enviando al sistema {synced} de {total} documento{total === 1 ? '' : 's'} creados sin conexión…</span>
        <span className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-info-border/60 sm:block" aria-hidden="true">
          {/* scaleX en vez de width: la barra crece sin recalcular el diseño */}
          <span className="block h-full w-full origin-left rounded-full bg-info" style={{ transform: `scaleX(${pct / 100})`, transition: 'transform var(--dur-base) var(--ease-out)' }} />
        </span>
      </div>
    );
  }

  return null;
}
