'use strict';
const Joi = require('joi');
const { FIELD_TYPES, TIPOS_TRAMITE } = require('../config/constants');

const field = Joi.object({
  name:        Joi.string().pattern(/^[a-z_][a-z0-9_]*$/).max(60).required(),
  label:       Joi.string().max(200).required(),
  type:        Joi.string().valid(...FIELD_TYPES).required(),
  required:    Joi.boolean().default(true),
  placeholder:  Joi.string().max(200).optional(),
  inputFilter:  Joi.string().valid('solo_letras', 'solo_numeros', '').optional(),
  // Texto / textarea
  minLength:   Joi.number().integer().min(0).optional(),
  maxLength:   Joi.number().integer().min(1).optional(),
  // Número
  min:         Joi.number().optional(),
  max:         Joi.number().optional(),
  step:        Joi.number().positive().optional(),
  options:     Joi.when('type', {
    is: Joi.valid('select', 'checklist'),
    then: Joi.array().items(Joi.string()).min(1).required(),
    otherwise: Joi.array().optional(),
  }),
});

const create = Joi.object({
  name:         Joi.string().min(2).max(200).required(),
  fields:       Joi.array().items(field).min(1).required(),
  tipo_tramite: Joi.string().valid(...TIPOS_TRAMITE).default('salida'),
});

const update = Joi.object({
  name:         Joi.string().min(2).max(200).optional(),
  fields:       Joi.array().items(field).min(1).optional(),
  active:       Joi.boolean().optional(),
  tipo_tramite: Joi.string().valid(...TIPOS_TRAMITE).optional(),
}).min(1);

module.exports = { field, create, update };
