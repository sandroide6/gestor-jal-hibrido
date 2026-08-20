'use strict';
const { AuditLog } = require('../models');
const logger = require('../config/logger');

async function log({ userId = null, action, resource = null, result, ip = null, metadata = {} }) {
  try {
    await AuditLog.create({ user_id: userId, action, resource, result, ip, metadata });
  } catch (err) {
    // El audit log nunca debe romper el flujo principal, pero un fallo aquí significa
    // que una acción legalmente auditable (borrar un documento, login fallido, cambio
    // de config) no quedó registrada — usar el logger estructurado (en vez de
    // console.error suelto) para que quede visible en los logs de producción y no se
    // pierda entre el resto de la salida de stdout.
    logger.error('auditService.log: no se pudo registrar el evento de auditoría', {
      action, resource, result, userId, error: err.message,
    });
  }
}

module.exports = { log };
