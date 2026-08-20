'use strict';
const Joi = require('joi');

const update = Joi.object({
  name:              Joi.string().min(2).max(200).optional(),
  logo_url:          Joi.string().uri().max(500).allow('', null).optional(),
  codigo_dependencia: Joi.string().max(20).pattern(/^[a-zA-Z0-9]*$/).allow('', null).optional(),
  features: Joi.object({
    backup:        Joi.boolean().optional(),
    reports:       Joi.boolean().optional(),
    notifications: Joi.boolean().optional(),
    doc_types:     Joi.boolean().optional(),
    audit_logs:    Joi.boolean().optional(),
  }).optional(),
}).min(1);

module.exports = { update };
