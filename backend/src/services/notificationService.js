'use strict';
const { v4: uuidv4 } = require('uuid');
const { Notification } = require('../models');
const logger = require('../config/logger');

async function notify({ userId, type, message, metadata = {} }) {
  try {
    await Notification.create({ id: uuidv4(), user_id: userId, type, message, metadata });
  } catch (err) {
    // No lanzar — las notificaciones no deben interrumpir la operación principal, pero
    // usar el logger estructurado (no console.error suelto) para que el fallo quede
    // visible en producción en vez de perderse en stdout.
    logger.error('notificationService.notify: no se pudo crear la notificación', {
      userId, type, error: err.message,
    });
  }
}

module.exports = { notify };
