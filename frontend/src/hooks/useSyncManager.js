import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { api } from '../services/api';
import {
  getAllPendingSync,
  removeSyncItem,
  incrementSyncRetry,
  updateDocument,
  getPendingSyncCount,
} from '../db/index';

const MAX_RETRIES = 5;

// Procesa toda la cola de sincronización pendiente
async function runSync({ onProgress }) {
  const syncStore = useSyncStore.getState();

  const pending = await getAllPendingSync();
  if (pending.length === 0) return;

  syncStore.setSyncing(true);
  syncStore.setSyncError(null);
  onProgress({ synced: 0, total: pending.length });

  // Filtrar items que no superaron el límite de reintentos
  const eligible = pending.filter((item) => (item.retries || 0) < MAX_RETRIES);
  if (eligible.length === 0) {
    syncStore.setSyncing(false);
    return;
  }

  try {
    const { results } = await api.post(
      '/sync/batch',
      { operations: eligible }
    );

    let synced = 0;

    for (const result of results) {
      // Buscar el item original en la cola por localId
      const queueItem = eligible.find(
        (item) => item.payload?.localId === result.localId
      );

      if (result.status === 'success') {
        // Actualizar el documento local con los datos del servidor
        if (result.localId) {
          await updateDocument(result.localId, {
            id: result.serverId,        // el doc en IndexedDB pasa al ID del servidor
            syncStatus: 'synced',
            download: result.download,
            serverId: result.serverId,
          });
        }
        // Eliminar de la cola
        if (queueItem) await removeSyncItem(queueItem.id);
        synced++;
        onProgress({ synced, total: eligible.length });

      } else if (result.status === 'conflict') {
        // Marcar conflicto localmente, sacar de cola
        if (result.localId) {
          await updateDocument(result.localId, { syncStatus: 'conflict' });
        }
        if (queueItem) await removeSyncItem(queueItem.id);

      } else {
        // Error: incrementar contador de reintentos
        if (queueItem) await incrementSyncRetry(queueItem.id);
      }
    }

    const remaining = await getPendingSyncCount();
    syncStore.setPendingCount(remaining);
    syncStore.setLastSyncAt(new Date().toISOString());

  } catch (err) {
    console.error('[JAL] Error al sincronizar:', err?.status, err?.message);
    syncStore.setSyncError(
      err.status >= 400
        ? 'Error al sincronizar. Se reintentará automáticamente.'
        : null // error de red sin respuesta del servidor
    );
  } finally {
    syncStore.setSyncing(false);
    onProgress(null); // limpiar progreso
  }
}

// Hook que dispara sync automáticamente al volver la conexión
export function useSyncManager() {
  const { isAuthenticated } = useAuthStore();
  const { isOnline, setOnline, setPendingCount, isSyncing } = useSyncStore();
  const syncProgress = useRef(null);
  const isSyncingRef = useRef(false);

  // Actualizar conteo al montar
  useEffect(() => {
    if (!isAuthenticated) return;
    getPendingSyncCount().then(setPendingCount);
  }, [isAuthenticated, setPendingCount]);

  // Escuchar cambios de conectividad
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  // Disparar sync cuando vuelve la conexión
  useEffect(() => {
    // Fix: antes también exigía `token` truthy — desde que el access token vive en
    // una cookie httpOnly (ya no en el store), esa condición siempre era falsa y la
    // sincronización automática nunca se disparaba.
    if (!isOnline || !isAuthenticated) return;
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;
    runSync({
      onProgress: (progress) => {
        syncProgress.current = progress;
        // Actualizamos el store de progreso
        if (progress) {
          useSyncStore.setState({ syncProgress: progress });
        } else {
          useSyncStore.setState({ syncProgress: null });
        }
      },
    }).finally(() => {
      isSyncingRef.current = false;
    });
  }, [isOnline, isAuthenticated]);
}
