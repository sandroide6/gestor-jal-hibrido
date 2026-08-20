'use strict';
const Joi = require('joi');

const batch = Joi.object({
  operations: Joi.array()
    .items(
      Joi.object({
        operation: Joi.string().valid('create', 'update', 'delete').required(),
        payload: Joi.object({
          resource: Joi.string().required(),
          localId:  Joi.string().required(),
          // Acepta 'data' (nuevo) o 'payload' (legacy) — al menos uno requerido
          data:    Joi.object().unknown(true).optional(),
          payload: Joi.object().unknown(true).optional(),
        }).or('data', 'payload').required(),
      }).unknown(true) // permite campos extra de IndexedDB: id, retries, createdAt
    )
    .min(1)
    .max(100)
    .required(),
});

module.exports = { batch };
