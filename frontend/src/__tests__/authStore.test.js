// Tests de authStore — login/logout, persistencia en IndexedDB, expiración de sesión
//
// Fix: el access/refresh token vivían en IndexedDB (legible por cualquier script del
// mismo origen — un XSS podía exfiltrarlos). Ahora viajan SOLO en cookies httpOnly que
// el backend gestiona (ver authCookies.js) — el frontend nunca los recibe ni los
// guarda. Solo se persiste `user` (datos no sensibles) para la UI offline.
vi.mock('../db/index', () => ({
  getDB: vi.fn(),
}));

vi.mock('../services/api', () => ({
  api: { post: vi.fn() },
}));

import { getDB } from '../db/index';
import { api } from '../services/api';
import { useAuthStore, loadPersistedAuth } from '../stores/authStore';

function resetStore() {
  useAuthStore.setState({ user: null, token: null, isAuthenticated: false, loading: true });
}

let dbMock;

beforeEach(() => {
  resetStore();
  dbMock = { put: vi.fn(), delete: vi.fn(), get: vi.fn() };
  getDB.mockResolvedValue(dbMock);
  vi.clearAllMocks();
  getDB.mockResolvedValue(dbMock);
});

describe('authStore — login', () => {
  it('inicia sesión correctamente y persiste solo `user` (no el token)', async () => {
    // El backend ya no incluye `token` en el body — va en una cookie httpOnly.
    api.post.mockResolvedValue({ user: { id: 1, role: 'auxiliar' } });

    const result = await useAuthStore.getState().login('a@a.com', 'secreto');

    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@a.com',
      password: 'secreto',
      remember_me: false,
    });
    expect(result).toEqual({ id: 1, role: 'auxiliar' });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual({ id: 1, role: 'auxiliar' });

    expect(dbMock.put).toHaveBeenCalledWith('config', {
      key: 'jal-auth',
      value: { user: { id: 1, role: 'auxiliar' } },
    });
  });

  it('nunca guarda un campo `token` en IndexedDB, aunque el backend lo incluyera en la respuesta', async () => {
    // Aunque un backend antiguo/comprometido devolviera el JWT en el body, el store
    // no debe reenviarlo a persistAuth — solo toma `data.user`.
    api.post.mockResolvedValue({ user: { id: 2, role: 'edil' }, token: 'eyHeader.ePayload.signature' });

    await useAuthStore.getState().login('b@b.com', 'x');

    const persistedValue = dbMock.put.mock.calls[0][1].value;
    expect(persistedValue).toEqual({ user: { id: 2, role: 'edil' } });
    expect(persistedValue.token).toBeUndefined();
  });

  it('no persiste ni autentica si el servidor exige 2FA', async () => {
    api.post.mockResolvedValue({ requires2fa: true, tempToken: 'temp-xyz' });

    const result = await useAuthStore.getState().login('a@a.com', 'secreto');

    expect(result).toEqual({ requires2fa: true, tempToken: 'temp-xyz' });
    expect(dbMock.put).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('rechaza la promesa si el login falla', async () => {
    api.post.mockRejectedValue(Object.assign(new Error('Credenciales inválidas'), { status: 401 }));
    await expect(useAuthStore.getState().login('a@a.com', 'mala')).rejects.toThrow('Credenciales inválidas');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('authStore — logout', () => {
  it('limpia la sesión local y llama al endpoint remoto (sin pasar token, la cookie autentica)', async () => {
    useAuthStore.setState({ user: { id: 1 }, isAuthenticated: true });
    api.post.mockResolvedValue({});

    await useAuthStore.getState().logout();

    expect(api.post).toHaveBeenCalledWith('/auth/logout', {});
    expect(dbMock.delete).toHaveBeenCalledWith('config', 'jal-auth');
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('limpia la sesión local aunque el logout remoto falle', async () => {
    useAuthStore.setState({ user: { id: 1 }, isAuthenticated: true });
    api.post.mockRejectedValue(new Error('Sin conexión'));

    await useAuthStore.getState().logout();

    expect(dbMock.delete).toHaveBeenCalledWith('config', 'jal-auth');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('authStore — refreshToken / expiración', () => {
  it('devuelve true cuando el refresh tiene éxito (el access token renovado queda en la cookie, no en JS)', async () => {
    useAuthStore.setState({ user: { id: 1 }, isAuthenticated: true });
    api.post.mockResolvedValue({ ok: true });

    const result = await useAuthStore.getState().refreshToken();

    expect(result).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    // No hay ningún token que persistir de nuevo — refreshToken() no debe tocar IndexedDB en éxito
    expect(dbMock.put).not.toHaveBeenCalled();
  });

  it('devuelve false y limpia la sesión cuando el refresh falla', async () => {
    useAuthStore.setState({ user: { id: 1 }, isAuthenticated: true });
    api.post.mockRejectedValue(Object.assign(new Error('Refresh inválido'), { status: 401 }));

    const result = await useAuthStore.getState().refreshToken();

    expect(result).toBe(false);
    expect(dbMock.delete).toHaveBeenCalledWith('config', 'jal-auth');
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});

describe('authStore — carga de sesión persistida', () => {
  it('initialize restaura la sesión guardada a partir de `user` (ya no depende de un `token` local)', async () => {
    dbMock.get.mockResolvedValue({ value: { user: { id: 3, role: 'administrador' } } });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual({ id: 3, role: 'administrador' });
    expect(state.loading).toBe(false);
  });

  it('initialize termina con loading=false y sin autenticar si no hay sesión guardada', async () => {
    dbMock.get.mockResolvedValue(undefined);

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.loading).toBe(false);
  });

  it('loadPersistedAuth devuelve null si la lectura de IndexedDB falla', async () => {
    getDB.mockRejectedValue(new Error('DB no disponible'));
    const result = await loadPersistedAuth();
    expect(result).toBeNull();
  });
});

describe('authStore — hasRole', () => {
  it('devuelve true si el usuario tiene alguno de los roles dados', () => {
    useAuthStore.setState({ user: { role: 'edil' } });
    expect(useAuthStore.getState().hasRole('administrador', 'edil')).toBe(true);
  });

  it('devuelve false si el usuario no tiene el rol', () => {
    useAuthStore.setState({ user: { role: 'auxiliar' } });
    expect(useAuthStore.getState().hasRole('administrador')).toBe(false);
  });

  it('devuelve false si no hay usuario autenticado', () => {
    useAuthStore.setState({ user: null });
    expect(useAuthStore.getState().hasRole('administrador')).toBe(false);
  });
});
