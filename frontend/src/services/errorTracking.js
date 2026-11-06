// Registro de errores del navegador en Sentry (auditoría 2026-11-05, plan 6.2).
// Inactivo si no hay VITE_SENTRY_DSN; con DSN el SDK se descarga aparte (import dinámico),
// así no pesa en la carga inicial. Mismas reglas de datos personales que el backend:
// sin usuario, sin consulta en las URL, sin migas de consola y con cédulas y correos tapados.
let sentry = null;
const pending = [];

const stripQuery = (url) => (typeof url === 'string' ? url.split('?')[0] : url);
const redact = (text) => (typeof text === 'string'
  ? text.replace(/\d{6,}/g, '[número]').replace(/[^\s@()"'=]+@[^\s@()"']+\.[a-z]{2,}/gi, '[correo]')
  : text);

export function scrubEvent(event) {
  if (event.message) event.message = redact(event.message);
  for (const ex of event.exception?.values || []) ex.value = redact(ex.value);
  if (event.request) event.request = { url: stripQuery(event.request.url) };
  delete event.user;
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs
      .filter((b) => b.category !== 'console')
      .map((b) => (b.data?.url ? { ...b, data: { ...b.data, url: stripQuery(b.data.url) } } : b));
  }
  return event;
}

export async function initErrorTracking(env = import.meta.env) {
  const dsn = env.VITE_SENTRY_DSN;
  if (!dsn) return false;
  const S = await import('@sentry/browser');
  S.init({
    dsn,
    environment: env.VITE_SENTRY_ENVIRONMENT || env.MODE,
    release: env.VITE_RELEASE || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 20,
    beforeSend: scrubEvent,
  });
  sentry = S;
  // Errores capturados antes de que terminara de cargar el SDK
  pending.splice(0).forEach(([err, extra]) => captureError(err, extra));
  return true;
}

export function captureError(error, extra = {}) {
  if (!sentry) {
    if (pending.length < 10) pending.push([error, extra]);
    return;
  }
  sentry.withScope((scope) => {
    Object.entries(extra).forEach(([k, v]) => scope.setTag(k, String(v)));
    sentry.captureException(error);
  });
}
