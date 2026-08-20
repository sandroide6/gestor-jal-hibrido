'use strict';
const logger = require('../config/logger');
const E = require('../config/errorCodes');

function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';
  const code    = err.code || (status >= 500 ? E.INTERNAL : E.VALIDATION);

  const requestId = req.id;

  if (status >= 500) {
    logger.error('Unhandled error', { requestId, status, message, method: req.method, url: req.originalUrl, stack: err.stack });
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
