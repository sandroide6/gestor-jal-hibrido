import { useServerStatusStore } from '../stores/serverStatusStore';

const BASE_URL = import.meta.env.VITE_API_URL || '';

// Refleja en serverStatusStore si el backend responde y si su base de datos está
// disponible — en el modo híbrido el backend puede tardar en responder (cold start de
// Render) o estar arriba pero sin poder alcanzar la BD local (túnel caído).
function reportServerStatus(status) {
  useServerStatusStore.getState().setBackendStatus(status);
}

// Evita bucles infinitos: solo intentamos refresh una vez por petición
let _refreshing = null;

async function tryRefresh() {
  if (_refreshing) return _refreshing;
  // Importación dinámica para evitar dependencia circular (api ↔ authStore)
  _refreshing = import('../stores/authStore')
    .then(({ useAuthStore }) => useAuthStore.getState().refreshToken())
    .finally(() => { _refreshing = null; });
  return _refreshing;
}

// Lee el csrf_token de document.cookie — a diferencia de access_token/refresh_token
// (httpOnly, invisibles para JS), esta cookie se deja legible a propósito: es la
// mitad "double-submit" del patrón CSRF (ver middleware/authenticate.js en el
// backend). El servidor solo acepta una mutación si el valor de esta cookie coincide
// con el header X-CSRF-Token — un sitio atacante puede lograr que el navegador de la
// víctima mande las cookies httpOnly solo, pero no puede leer esta cookie de nuestro
// origen para reenviarla como header.
export function readCsrfCookie() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function withCsrfHeader(method, headers) {
  if (!MUTATING_METHODS.has(method)) return headers;
  const csrfToken = readCsrfCookie();
  return csrfToken ? { ...headers, 'X-CSRF-Token': csrfToken } : headers;
}

async function request(path, options = {}) {
  // `token` ya no se usa para autenticar (el access token vive en una cookie httpOnly
  // que el navegador adjunta solo, vía credentials:'include') — se sigue aceptando en
  // la firma para no romper los muchos call sites existentes que aún lo pasan, pero
  // ya no se envía como header.
  const { token: _token, isFormData, _retry, params, ...rest } = options;
  const method = (rest.method || 'GET').toUpperCase();

  const headers = withCsrfHeader(method, {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    'ngrok-skip-browser-warning': '1',
    ...options.headers,
  });

  const qs = params && Object.keys(params).length
    ? '?' + new URLSearchParams(params).toString()
    : '';

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}${qs}`, {
      ...rest,
      headers,
      credentials: 'include',
    });
  } catch (networkErr) {
    reportServerStatus('unreachable');
    throw networkErr;
  }
  reportServerStatus(res.status === 503 ? 'degraded' : 'ok');

  // Access token expirado: intentar refresh (renueva la cookie) y reintentar una vez
  // No aplicar en rutas de auth (login, refresh, 2fa) para evitar bucles
  const isAuthRoute = path.startsWith('/auth/');
  if (res.status === 401 && !_retry && !isAuthRoute) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request(path, { ...options, _retry: true });
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// Para respuestas binarias (descargas, imágenes)
async function requestBlob(path, options = {}) {
  const { token: _token, _retry, ...rest } = options;
  const method = (rest.method || 'GET').toUpperCase();
  const headers = withCsrfHeader(method, { 'ngrok-skip-browser-warning': '1', ...options.headers });

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers,
      credentials: 'include',
    });
  } catch (networkErr) {
    reportServerStatus('unreachable');
    throw networkErr;
  }
  reportServerStatus(res.status === 503 ? 'degraded' : 'ok');

  if (res.status === 401 && !_retry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return requestBlob(path, { ...options, _retry: true });
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.blob();
}

// Descarga un blob y dispara el diálogo de guardar
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const api = {
  post: (path, body, opts) =>
    request(path, {
      method: 'POST',
      body: opts?.isFormData ? body : JSON.stringify(body),
      ...opts,
    }),
  get:    (path, opts) => request(path, { method: 'GET', ...opts }),
  put:  (path, body, opts) =>
    request(path, {
      method: 'PUT',
      body: opts?.isFormData ? body : JSON.stringify(body),
      ...opts,
    }),
  patch:  (path, body, opts) =>
    request(path, {
      method: 'PATCH',
      body: opts?.isFormData ? body : JSON.stringify(body),
      ...opts,
    }),
  delete: (path, opts) => request(path, { method: 'DELETE', ...opts }),

  // Devuelve el Blob (para mostrar imágenes, etc.)
  blob: (path, opts) => requestBlob(path, { method: 'GET', ...opts }),

  // Descarga un archivo activando el diálogo del navegador
  download: async (path, opts, filename) => {
    const blob = await requestBlob(path, { method: 'GET', ...opts });
    triggerDownload(blob, filename);
  },
};
