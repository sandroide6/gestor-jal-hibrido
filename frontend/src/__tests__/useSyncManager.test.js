// Tests de useSyncManager — disparo de sincronización automática y reintentos.
// Incluye la verificación del hallazgo de auditoría: los items de la cola con
// retries >= MAX_RETRIES quedan excluidos para siempre de la sincronización
// (hooks/useSyncManager.js) pero getPendingSyncCount() (db/index.js) los sigue
// contando como "pendientes" porque solo hace un conteo total de la tabla.
vi.mock('../services/api', () => ({
  api: { post: vi.fn() },
}));

vi.mock('../db/index', () => ({
  getAllPendingSync: vi.fn(),
  removeSyncItem: vi.fn(),
  incrementSyncRetry: vi.fn(),
  updateDocument: vi.fn(),
  getPendingSyncCount: vi.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { api } from '../services/api';
import {
  getAllPendingSync, removeSyncItem, incrementSyncRetry, updateDocument, getPendingSyncCount,
} from '../db/index';
import { useSyncManager } from '../hooks/useSyncManager';

function resetStores() {
  useAuthStore.setState({ user: { id: 1 }, token: 'tok', isAuthenticated: true, loading: false });
  useSyncStore.setState({
    isOnline: true, pendingCount: 0, isSyncing: false, lastSyncAt: null, syncError: null, syncProgress: null,
  });
}

beforeEach(() => {
  resetStores();
  vi.clearAllMocks();
  getPendingSyncCount.mockResolvedValue(0);
  getAllPendingSync.mockResolvedValue([]);
});

describe('useSyncManager — condiciones para disparar sincronización', () => {
  it('no llama a la API si el usuario no está autenticado', async () => {
    useAuthStore.setState({ isAuthenticated: false, token: null });
    getAllPendingSync.mockResolvedValue([{ id: 1, payload: { localId: 'x' }, retries: 0 }]);

    renderHook(() => useSyncManager());
    await new Promise((r) => setTimeout(r, 20));

    expect(api.post).not.toHaveBeenCalled();
  });

  it('no llama a la API si está offline', async () => {
    useSyncStore.setState({ isOnline: false });
    getAllPendingSync.mockResolvedValue([{ id: 1, payload: { localId: 'x' }, retries: 0 }]);

    renderHook(() => useSyncManager());
    await new Promise((r) => setTimeout(r, 20));

    expect(api.post).not.toHaveBeenCalled();
  });

  it('no llama a la API si la cola de sincronización está vacía', async () => {
    getAllPendingSync.mockResolvedValue([]);

    renderHook(() => useSyncManager());
    await waitFor(() => expect(getAllPendingSync).toHaveBeenCalled());

    expect(api.post).not.toHaveBeenCalled();
  });

  it('actualiza pendingCount al montar cuando está autenticado', async () => {
    getPendingSyncCount.mockResolvedValue(4);

    renderHook(() => useSyncManager());

    await waitFor(() => expect(useSyncStore.getState().pendingCount).toBe(4));
  });
});

describe('useSyncManager — procesamiento de resultados de sync', () => {
  it('procesa éxito, conflicto y error para distintos items de la cola', async () => {
    const items = [
      { id: 1, payload: { resource: 'documents', localId: 'loc-success' }, retries: 0 },
      { id: 2, payload: { resource: 'documents', localId: 'loc-conflict' }, retries: 0 },
      { id: 3, payload: { resource: 'documents', localId: 'loc-error' }, retries: 0 },
    ];
    getAllPendingSync.mockResolvedValue(items);
    api.post.mockResolvedValue({
      results: [
        { localId: 'loc-success', status: 'success', serverId: 'srv-1', download: { pdf: '/x' } },
        { localId: 'loc-conflict', status: 'conflict' },
        { localId: 'loc-error', status: 'error' },
      ],
    });
    getPendingSyncCount.mockResolvedValue(1);

    renderHook(() => useSyncManager());

    await waitFor(() => expect(updateDocument).toHaveBeenCalledWith('loc-success', expect.objectContaining({
      id: 'srv-1',
      syncStatus: 'synced',
      serverId: 'srv-1',
    })));

    expect(updateDocument).toHaveBeenCalledWith('loc-conflict', { syncStatus: 'conflict' });
    expect(removeSyncItem).toHaveBeenCalledWith(1); // success
    expect(removeSyncItem).toHaveBeenCalledWith(2); // conflict
    expect(removeSyncItem).not.toHaveBeenCalledWith(3); // error -> no se elimina
    expect(incrementSyncRetry).toHaveBeenCalledWith(3);

    await waitFor(() => expect(useSyncStore.getState().pendingCount).toBe(1));
    expect(useSyncStore.getState().lastSyncAt).not.toBeNull();
  });

  it('establece syncError con mensaje si el batch falla con error de servidor', async () => {
    getAllPendingSync.mockResolvedValue([{ id: 1, payload: { localId: 'x' }, retries: 0 }]);
    api.post.mockRejectedValue(Object.assign(new Error('fallo'), { status: 500 }));

    renderHook(() => useSyncManager());

    await waitFor(() => expect(useSyncStore.getState().syncError).toBe(
      'Error al sincronizar. Se reintentará automáticamente.'
    ));
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });

  it('no establece syncError (queda null) si el batch falla por error de red', async () => {
    getAllPendingSync.mockResolvedValue([{ id: 1, payload: { localId: 'x' }, retries: 0 }]);
    api.post.mockRejectedValue(new Error('Failed to fetch')); // sin status

    renderHook(() => useSyncManager());

    await waitFor(() => expect(useSyncStore.getState().isSyncing).toBe(false));
    expect(useSyncStore.getState().syncError).toBeNull();
  });
});

describe('useSyncManager — [BUG CONOCIDO] items con reintentos agotados siguen contando como pendientes', () => {
  it('excluye del reintento los items con retries >= MAX_RETRIES pero getPendingSyncCount igual los cuenta', async () => {
    const eligibleItem  = { id: 1, payload: { resource: 'documents', localId: 'loc-eligible' }, retries: 0 };
    const exhaustedItem = { id: 2, payload: { resource: 'documents', localId: 'loc-exhausted' }, retries: 5 }; // MAX_RETRIES = 5

    getAllPendingSync.mockResolvedValue([eligibleItem, exhaustedItem]);

    let sentOperations = null;
    api.post.mockImplementation((path, body) => {
      sentOperations = body.operations;
      return Promise.resolve({
        results: [{ localId: 'loc-eligible', status: 'success', serverId: 'srv-1' }],
      });
    });

    // getPendingSyncCount() en db/index.js hace `db.count('sync_queue')`: un conteo
    // total de la tabla, sin filtrar por retries. Como el item agotado (id:2) nunca
    // se elimina de la cola (no está en `eligible`, así que jamás se marca success/
    // conflict), simulamos que el conteo real seguiría incluyéndolo: solo se retiró
    // el item exitoso, por lo que la cola real todavía tiene 1 elemento (el agotado).
    getPendingSyncCount.mockResolvedValue(1);

    renderHook(() => useSyncManager());

    await waitFor(() => expect(api.post).toHaveBeenCalled());

    // Confirmado: el batch enviado al servidor SOLO incluye el item elegible.
    // El item con retries agotados nunca se reintenta.
    expect(sentOperations).toHaveLength(1);
    expect(sentOperations[0].payload.localId).toBe('loc-eligible');
    expect(removeSyncItem).not.toHaveBeenCalledWith(2);
    expect(incrementSyncRetry).not.toHaveBeenCalledWith(2);

    // Confirmado: pendingCount refleja getPendingSyncCount(), que sigue contando
    // el item agotado (id:2) como "pendiente" en la UI, aunque runSync() jamás
    // volverá a intentarlo — es un item efectivamente "muerto" pero visible como
    // pendiente para el usuario.
    await waitFor(() => expect(useSyncStore.getState().pendingCount).toBe(1));
  });
});
