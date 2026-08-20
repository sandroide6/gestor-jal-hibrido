import { create } from 'zustand';
import { getDB } from '../db/index';
import { api } from '../services/api';

const AUTH_KEY = 'jal-auth';

// Fix: el access token vivía en IndexedDB (legible por cualquier script del mismo
// origen — un XSS podía exfiltrarlo). Ahora el access token y el refresh token viajan
// SOLO en cookies httpOnly que el backend gestiona (ver authCookies.js) — el frontend
// nunca los recibe ni los guarda. Solo se persiste `user` (datos no sensibles: nombre,
// rol, jal_id) para poder mostrar la UI offline sin depender de la red.
async function persistAuth(data) {
  const db = await getDB();
  await db.put('config', { key: AUTH_KEY, value: data });
}

async function clearAuth() {
  const db = await getDB();
  await db.delete('config', AUTH_KEY);
}

export async function loadPersistedAuth() {
  try {
    const db = await getDB();
    const record = await db.get('config', AUTH_KEY);
    return record?.value || null;
  } catch {
    return null;
  }
}

export const useAuthStore = create((set, get) => ({
  user: null,
  // `token` se mantiene en el shape del store (siempre null) solo para no romper los
  // ~20 call sites existentes que hacen `const { token } = useAuthStore()` y lo pasan
  // a api.xxx(path, { token }) — api.js simplemente omite el header Authorization
  // cuando token es null/undefined, la cookie httpOnly es la que autentica de verdad.
  token: null,
  isAuthenticated: false,
  loading: true, // true mientras se carga la sesión guardada

  initialize: async () => {
    const saved = await loadPersistedAuth();
    if (saved?.user) {
      // Optimista y offline-first: si hay un `user` cacheado, se asume la sesión
      // activa y se muestra la UI de inmediato sin esperar a la red. Si la cookie de
      // sesión en realidad ya expiró o fue revocada server-side, la primera llamada a
      // la API real devolverá 401 y el flujo existente de refresh (api.js) la
      // limpiará sola — no hace falta verificarlo aquí de forma bloqueante.
      set({ user: saved.user, isAuthenticated: true, loading: false });
    } else {
      set({ loading: false });
    }
  },

  login: async (email, password, rememberMe = false) => {
    const data = await api.post('/auth/login', { email, password, remember_me: rememberMe });
    if (data.requires2fa) {
      return data; // { requires2fa: true, tempToken } — LoginPage maneja el flujo 2FA
    }
    await persistAuth({ user: data.user });
    set({ user: data.user, isAuthenticated: true });
    return data.user;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Si falla el logout remoto, igual limpiamos la sesión local
    }
    await clearAuth();
    set({ user: null, isAuthenticated: false });
  },

  // Devuelve true/false (antes devolvía el token nuevo) — ya no hay un valor de token
  // que manejar en JS, el backend deja el access token renovado en la cookie httpOnly
  // como efecto secundario de esta llamada.
  refreshToken: async () => {
    try {
      await api.post('/auth/refresh', {});
      return true;
    } catch {
      await clearAuth();
      set({ user: null, isAuthenticated: false });
      return false;
    }
  },

  setUser: async (newUser) => {
    await persistAuth({ user: newUser });
    set({ user: newUser, isAuthenticated: true });
  },

  completeLogin: async (user) => {
    await persistAuth({ user });
    set({ user, isAuthenticated: true });
  },

  hasRole: (...roles) => {
    const { user } = get();
    return user ? roles.includes(user.role) : false;
  },
}));
