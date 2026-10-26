'use strict';
const Joi = require('joi');

// Un retention_count negativo hacía que la retención borrara TODOS los backups,
// incluido el recién subido. Los rangos coinciden con los controles de BackupPage.jsx.
const backupConfig = Joi.object({
  auto_enabled:    Joi.boolean().optional(),
  schedule:        Joi.string().valid('hourly', 'daily', 'weekly').optional(),
  schedule_hour:   Joi.number().integer().min(0).max(23).allow(null).optional(),
  schedule_day:    Joi.number().integer().min(0).max(6).allow(null).optional(),
  retention_count: Joi.number().integer().min(1).max(50).allow(null).optional(),
});

module.exports = { backupConfig };
