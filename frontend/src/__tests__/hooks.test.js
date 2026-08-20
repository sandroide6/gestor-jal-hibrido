// PT-15: Tests de hooks específicos — useDocTypes, useUsers, useAdminStats
import { renderHook, waitFor } from '@testing-library/react';

// ── useDocTypes ────────────────────────────────────────────
vi.mock('../services/docTypesService', () => ({
  fetchDocTypes: vi.fn(),
}));

vi.mock('../services/usersService', () => ({
  fetchUsers: vi.fn(),
}));

vi.mock('../services/adminService', () => ({
  fetchAdminStats: vi.fn(),
}));

import { fetchDocTypes } from '../services/docTypesService';
import { fetchUsers }    from '../services/usersService';
import { fetchAdminStats } from '../services/adminService';
import { useDocTypes }   from '../hooks/useDocTypes';
import { useUsers }      from '../hooks/useUsers';
import { useAdminStats } from '../hooks/useAdminStats';

const TOKEN = 'test-token';

afterEach(() => vi.clearAllMocks());

describe('useDocTypes', () => {
  it('expone loading=true inicialmente', () => {
    fetchDocTypes.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDocTypes(TOKEN));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('resuelve el array de tipos de documento', async () => {
    const types = [{ id: '1', name: 'Acta' }, { id: '2', name: 'Carta' }];
    fetchDocTypes.mockResolvedValue(types);
    const { result } = renderHook(() => useDocTypes(TOKEN));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(types);
    expect(result.current.error).toBe('');
  });

  it('captura error de red', async () => {
    fetchDocTypes.mockRejectedValue(new Error('Sin conexión'));
    const { result } = renderHook(() => useDocTypes(TOKEN));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Sin conexión');
  });
});

describe('useUsers', () => {
  it('extrae .data del shape paginado', async () => {
    const users = [{ id: 'u1', name: 'Ana' }];
    fetchUsers.mockResolvedValue({ data: users, total: 1, page: 1, pages: 1 });
    const { result } = renderHook(() => useUsers(TOKEN));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(users);
  });

  it('maneja respuesta legacy (array plano)', async () => {
    const users = [{ id: 'u1', name: 'Ana' }];
    fetchUsers.mockResolvedValue(users); // sin wrapper paginado
    const { result } = renderHook(() => useUsers(TOKEN));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(users);
  });

  it('re-ejecuta si cambia el token', async () => {
    fetchUsers.mockResolvedValue({ data: [], total: 0, page: 1, pages: 1 });
    const { rerender } = renderHook(({ token }) => useUsers(token), {
      initialProps: { token: 'token-a' },
    });
    await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(1));
    rerender({ token: 'token-b' });
    await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(2));
  });
});

describe('useAdminStats', () => {
  it('expone las estadísticas correctamente', async () => {
    const stats = { users: 5, documents: 42, pendingReview: 3 };
    fetchAdminStats.mockResolvedValue(stats);
    const { result } = renderHook(() => useAdminStats(TOKEN));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(stats);
  });

  it('captura error del servidor', async () => {
    fetchAdminStats.mockRejectedValue(new Error('403 Forbidden'));
    const { result } = renderHook(() => useAdminStats(TOKEN));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('403 Forbidden');
  });
});
