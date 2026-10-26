'use strict';
const logger = require('../config/logger');
const E = require('../config/errorCodes');

function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  // En producción un 5xx no expone el mensaje interno (errores de Sequelize/pg incluyen
  // nombres de tablas, constraints o fragmentos SQL); el detalle queda en el log.
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Error interno del servidor'
    : err.message || 'Error interno del servidor';
  const code    = err.code || (status >= 500 ? E.INTERNAL : E.VALIDATION);

  const requestId = req.id;

  if (status >= 500) {
    logger.error('Unhandled error', { requestId, status, message: err.message, method: req.method, url: req.originalUrl, stack: err.stack });
  } else {
    logger.warn('Client error', { requestId, status, message, method: req.method, url: req.originalUrl });
  }

  res.status(status).json({
    error: true,
    code,
    message,
    requestId,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
