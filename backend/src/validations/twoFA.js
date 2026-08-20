'use strict';
const Joi = require('joi');

const totpToken = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).required(),
});

const validate2fa = Joi.object({
  tempToken: Joi.string().required(),
  token:     Joi.string().length(6).pattern(/^\d+$/).required(),
});

module.exports = { totpToken, validate2fa };
