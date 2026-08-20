'use strict';
const Joi = require('joi');

const exportDocuments = Joi.object({
  doc_type_id: Joi.string().uuid().optional(),
  user_id:     Joi.string().uuid().optional(),
  reviewed:    Joi.boolean().optional(),
  date_from:   Joi.string().isoDate().optional(),
  date_to:     Joi.string().isoDate().optional().when('date_from', {
    is: Joi.exist(),
    then: Joi.string().isoDate().min(Joi.ref('date_from')).optional(),
  }),
});

module.exports = { exportDocuments };
