'use strict';
// Registro de errores en Sentry (auditoría 2026-11-05, plan 6.2). Inactivo si no hay
// SENTRY_DSN: no se carga el SDK ni sale nada del servidor.
//
// Datos personales (Ley 1581): solo se envían el tipo de error, la traza, el método, la
// ruta SIN parámetros de consulta y el requestId. Se quitan cuerpo, cookies, cabeceras,
// usuario, IP y las migas de pan con URL, porque pueden llevar cédulas o nombres.
let sentry = null;

function stripQuery(url) {
  return typeof url === 'string' ? url.split('?')[0] : url;
}

// Los mensajes de error de la base pueden llevar valores ("Key (cedula)=(1000000001)…"):
// se tapan secuencias de 6 o más dígitos y correos.
function redact(text) {
  return typeof text === 'string'
    ? text.replace(/\d{6,}/g, '[número]').replace(/[^\s@()"'=]+@[^\s@()"']+\.[a-z]{2,}/gi, '[correo]')
    : text;
}

function scrubEvent(event) {
  if (event.message) event.message = redact(event.message);
  for (const ex of event.exception?.values || []) ex.value = redact(ex.value);
  if (event.request) {
    event.request = { method: event.request.method, url: stripQuery(event.request.url) };
  }
  delete event.user;
  delete event.server_name;
  if (event.contexts) delete event.contexts.cloud_resource;
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs
      .filter((b) => b.category !== 'console')
      .map((b) => (b.data?.url ? { ...b, data: { ...b.data, url: stripQuery(b.data.url) } } : b));
  }
  return event;
}

function init(options = {}) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  sentry = require('@sentry/node');
  sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.RENDER_GIT_COMMIT || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 20,
    beforeSend: scrubEvent,
    // index.js ya maneja unhandledRejection/uncaughtException (registra, avisa y reinicia):
    // se quitan los de Sentry para no duplicar el evento ni cambiar cómo sale el proceso.
    integrations: (defaults) => defaults.filter((i) => !['OnUncaughtException', 'OnUnhandledRejection'].includes(i.name)),
    ...options,
  });
  return true;
}

function captureError(err, { requestId, method, path, status } = {}) {
  if (!sentry) return;
  sentry.withScope((scope) => {
    if (requestId) scope.setTag('requestId', requestId);
    if (status) scope.setTag('status', String(status));
    if (method && path) scope.setTag('route', `${method} ${stripQuery(path)}`);
    sentry.captureException(err);
  });
}

async function flush(timeoutMs = 2000) {
  if (!sentry) return true;
  return sentry.flush(timeoutMs);
}

function isEnabled() {
  return !!sentry;
}

async function _reset() {
  if (sentry) await sentry.close(0).catch(() => {});
  sentry = null;
}

module.exports = { init, captureError, flush, isEnabled, scrubEvent, _reset };
