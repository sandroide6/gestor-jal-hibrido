'use strict';
const Joi = require('joi');
const { SYNC_STATUSES } = require('../config/constants');

// Campos base; los campos dinámicos del formulario se permiten vía .unknown(true)
const create = Joi.object({
  doc_type_id:      Joi.string().uuid().required(),
  beneficiary_name: Joi.string().max(300).allow('', null).optional(),
  beneficiary_id:   Joi.string().max(20).allow('', null).optional(),
  edil_id:          Joi.string().uuid().optional().allow(null, ''),
}).unknown(true);

const ownList = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const edilList = Joi.object({
  doc_type_name:   Joi.string().max(200).optional(),
  user_id:         Joi.string().uuid().optional(),
  beneficiary:     Joi.string().max(300).optional(),
  numero_radicado: Joi.string().max(30).optional(),
  date_from:     Joi.string().isoDate().optional(),
  date_to:       Joi.string().isoDate().optional(),
  sync_status:   Joi.string().valid(...SYNC_STATUSES).optional(),
  reviewed:      Joi.boolean().optional(),
  page:          Joi.number().integer().min(1).default(1),
  limit:         Joi.number().integer().min(1).max(100).default(50),
});

module.exports = { create, ownList, edilList };
