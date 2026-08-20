'use strict';
const { getIp } = require('../utils/request');
const { processBatch } = require('../services/syncService');
const { AuditLog } = require('../models');
// Schema en src/validations/sync.js — validate middleware aplicado en routes/sync.js

async function batch(req, res, next) {
  try {
    // req.body ya validado por validate(syncSchemas.batch) en la ruta
    const results = await processBatch({
      operations: req.body.operations,
      userId: req.user.sub,
      jalId: req.user.jal_id,
      ip: getIp(req),
    });

    res.json({ results });
  } catch (err) {
    next(err);
  }
}

async function status(req, res, next) {
  try {
    // Última sincronización exitosa del usuario
    const lastSync = await AuditLog.findOne({
      where: { user_id: req.user.sub, action: 'sync.batch', result: 'success' },
      order: [['timestamp', 'DESC']],
      attributes: ['timestamp', 'metadata'],
    });

    res.json({
      userId: req.user.sub,
      lastSyncAt: lastSync?.timestamp || null,
      lastSyncStats: lastSync?.metadata || null,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { batch, status };
