'use strict';
const Joi = require('joi');

const login = Joi.object({
  email:       Joi.string().email().max(254).required(),
  password:    Joi.string().min(1).max(128).required(),
  remember_me: Joi.boolean().default(false),
});

const refresh = Joi.object({
  refreshToken: Joi.string().required(),
});

const changePassword = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required(),
  newPassword:     Joi.string().min(8).max(128).required(),
});

module.exports = { login, refresh, changePassword };
