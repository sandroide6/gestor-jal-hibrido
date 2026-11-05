'use strict';
// Avisos de errores graves a un webhook (auditoría 2026-11-05, P1-4).
//
// ALERT_WEBHOOK_URL acepta:
//   - ntfy.sh (gratis, sin cuenta): https://ntfy.sh/<tema-secreto-largo>  → texto plano
//   - Slack o Discord (webhook entrante)                                   → JSON {text, content}
// Sin la variable no hace nada. Nunca envía datos de la petición (cuerpo, consulta,
// mensajes de la base, que pueden incluir datos personales): solo el tipo de error, la
// ruta sin parámetros de consulta y el requestId para buscar el detalle en los logs.
// Se limita a un aviso por tipo de error cada ALERT_THROTTLE_MIN minutos (15).
const logger = require('../config/logger');

const lastSent = new Map();

function throttleMs() {
  return (Number(process.env.ALERT_THROTTLE_MIN) || 15) * 60 * 1000;
}

function buildRequest(url, text) {
  if (/^https:\/\/([a-z0-9-]+\.)*ntfy\.sh\//i.test(url) || process.env.ALERT_WEBHOOK_FORMAT === 'text') {
    return { body: text, headers: { 'Content-Type': 'text/plain; charset=utf-8', Title: 'Gestor JAL', Priority: 'high' } };
  }
  return { body: JSON.stringify({ text, content: text }), headers: { 'Content-Type': 'application/json' } };
}

/**
 * @param {string} kind   clave del tipo de error (para el límite de frecuencia)
 * @param {object} info   { summary, path, requestId } — sin datos personales
 * @returns {Promise<boolean>} true si se envió
 */
async function sendAlert(kind, { summary, path, requestId } = {}) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return false;

  const now = Date.now();
  if (lastSent.has(kind) && now - lastSent.get(kind) < throttleMs()) return false;
  lastSent.set(kind, now);

  const env = process.env.RENDER_SERVICE_NAME || process.env.NODE_ENV || 'desconocido';
  const text = [
    `Gestor JAL (${env}): ${summary || kind}`,
    path ? `Ruta: ${String(path).split('?')[0]}` : null,
    requestId ? `requestId: ${requestId}` : null,
    'Detalle en los logs del servidor.',
  ].filter(Boolean).join('\n');

  const { body, headers } = buildRequest(url, text);
  try {
    const res = await fetch(url, { method: 'POST', body, headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) logger.warn('alertService: el webhook respondió con error', { status: res.status });
    return res.ok;
  } catch (err) {
    logger.warn('alertService: no se pudo enviar el aviso', { error: err.message });
    return false;
  }
}

function _reset() { lastSent.clear(); }

module.exports = { sendAlert, _reset };
