'use strict';
const Joi = require('joi');

const auditQuery = Joi.object({
  user_id:   Joi.string().uuid().optional(),
  action:    Joi.string().max(100).optional(),
  result:    Joi.string().valid('success', 'failure', 'error').optional(),
  date_from: Joi.string().isoDate().optional(),
  date_to:   Joi.string().isoDate().optional(),
  page:      Joi.number().integer().min(1).default(1),
  limit:     Joi.number().integer().min(1).max(200).default(50),
});

module.exports = { auditQuery };
