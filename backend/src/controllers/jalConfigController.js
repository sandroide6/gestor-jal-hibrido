'use strict';
const { getIp } = require('../utils/request');
const { Jal } = require('../models');
const audit = require('../services/auditService');
// Schema en src/validations/jalConfig.js — validate middleware aplicado en routes/admin.js

const DEFAULT_FEATURES = {
  backup:        true,
  reports:       true,
  notifications: true,
  doc_types:     true,
  audit_logs:    true,
};

async function getConfig(req, res, next) {
  try {
    const jal = await Jal.findByPk(req.user.jal_id);
    if (!jal) return res.status(404).json({ error: true, message: 'JAL no encontrada' });

    res.json({
      id:                 jal.id,
      name:               jal.name,
      logo_url:           jal.logo_url || null,
      codigo_dependencia: jal.config?.codigo_dependencia || '',
      features:           { ...DEFAULT_FEATURES, ...(jal.features || {}) },
    });
  } catch (err) { next(err); }
}

async function updateConfig(req, res, next) {
  try {
    // req.body ya validado por validate(jalConfigSchemas.update) en la ruta
    const value = req.body;

    const jal = await Jal.findByPk(req.user.jal_id);
    if (!jal) return res.status(404).json({ error: true, message: 'JAL no encontrada' });

    const updates = {};
    if (value.name)     updates.name     = value.name;
    if ('logo_url' in value) updates.logo_url = value.logo_url || null;
    if (value.features) updates.features = { ...(jal.features || {}), ...value.features };
    if ('codigo_dependencia' in value) {
      updates.config = { ...(jal.config || {}), codigo_dependencia: value.codigo_dependencia || null };
    }

    await jal.update(updates);

    await audit.log({
      userId: req.user.sub,
      action: 'jal.config.update',
      resource: `jals/${jal.id}`,
      result: 'success',
      ip: getIp(req),
      metadata: { changes: Object.keys(updates) },
    });

    res.json({
      id:                 jal.id,
      name:               jal.name,
      logo_url:           jal.logo_url || null,
      codigo_dependencia: jal.config?.codigo_dependencia || '',
      features:           { ...DEFAULT_FEATURES, ...(jal.features || {}) },
    });
  } catch (err) { next(err); }
}

module.exports = { getConfig, updateConfig };
