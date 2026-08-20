'use strict';
const Joi = require('joi');
const { ROLES } = require('../config/constants');

const list = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
});

const create = Joi.object({
  name:     Joi.string().min(2).max(200).required(),
  email:    Joi.string().email().max(254).required(),
  password: Joi.string().min(8).max(128).required(),
  role:     Joi.string().valid(...ROLES).required(),
});

const update = Joi.object({
  name:   Joi.string().min(2).max(200).optional(),
  email:  Joi.string().email().max(254).optional(),
  role:   Joi.string().valid(...ROLES).optional(),
  active: Joi.boolean().optional(),
}).min(1);

const updateMe = Joi.object({
  name:         Joi.string().min(2).max(200).optional(),
  email:        Joi.string().email().max(254).optional(),
  cargo_titulo: Joi.string().max(200).allow('', null).optional(),
}).min(1);

module.exports = { list, create, update, updateMe };
