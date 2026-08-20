'use strict';
const Joi = require('joi');

// Acepta cualquier versión de UUID (los seeders usan versión 0)
const uuidParam = Joi.object({
  id: Joi.string().uuid().required(),
});

module.exports = { uuidParam };
