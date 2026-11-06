'use strict';
const logger = require('../config/logger');
const E = require('../config/errorCodes');
const { sendAlert } = require('../services/alertService');
const errorTracking = require('../services/errorTracking');

// Errores de Sequelize que significan "no hay base", no "la petición está mal" ni un
// fallo del código. Se responden 503 con Retry-After (auditoría 2026-11-05, P2-3):
// antes salían como 500 genérico y el usuario no sabía si reintentar.
const DB_UNAVAILABLE_ERRORS = new Set([
  'SequelizeConnectionError',
  'SequelizeConnectionRefusedError',
  'SequelizeConnectionAcquireTimeoutError',
  'SequelizeConnectionTimedOutError',
  'SequelizeHostNotFoundError',
  'SequelizeHostNotReachableError',
  'SequelizeAccessDeniedError',
]);

function errorHandler(err, req, res, next) {
  if (DB_UNAVAILABLE_ERRORS.has(err.name)) {
    logger.error('Base de datos no disponible', { requestId: req.id, name: err.name, error: err.message, method: req.method, url: req.originalUrl });
    sendAlert('db_unavailable', { summary: 'la base de datos no responde (503)', path: req.originalUrl, requestId: req.id }).catch(() => {});
    res.set('Retry-After', '30');
    return res.status(503).json({
      error: true,
      code: E.DB_UNAVAILABLE,
      message: 'La base de datos no está disponible en este momento. Intenta de nuevo en unos segundos.',
      requestId: req.id,
    });
  }

  const status  = err.status || err.statusCode || 500;
  // En producción un 5xx no expone el mensaje interno (errores de Sequelize/pg incluyen
  // nombres de tablas, constraints o fragmentos SQL); el detalle queda en el log.
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Error interno del servidor'
    : err.message || 'Error interno del servidor';
  const code    = err.code || (status >= 500 ? E.INTERNAL : E.VALIDATION);

  const requestId = req.id;

  if (status >= 500) {
    sendAlert(`5xx:${err.name || 'Error'}`, { summary: `error interno ${status} (${err.name || 'Error'})`, path: req.originalUrl, requestId }).catch(() => {});
    errorTracking.captureError(err, { requestId, method: req.method, path: req.originalUrl, status });
    logger.error('Unhandled error', { requestId, status, message: err.message, method: req.method, url: req.originalUrl, stack: err.stack });
  } else {
    logger.warn('Client error', { requestId, status, message, method: req.method, url: req.originalUrl });
  }

  res.status(status).json({
    error: true,
    code,
    message,
    requestId,
    ...(process.env.NODE_ENV !== 'production' && status >= 500 && { stack: err.stack }),
  });
}

module.exports = errorHandler;
