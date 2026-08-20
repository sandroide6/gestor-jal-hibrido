'use strict';
const { v4: uuidv4 } = require('uuid');
const { DocType } = require('../models');

const HAS_TEMPLATE_LITERAL = '(template_data IS NOT NULL OR template_path IS NOT NULL)';

function withHasTemplate(model) {
  return {
    exclude: ['template_data'],
    include: [
      [model.sequelize.literal(HAS_TEMPLATE_LITERAL), 'has_template'],
    ],
  };
}

async function listDocTypes(jalId) {
  return DocType.findAll({
    where: { jal_id: jalId },
    order: [['name', 'ASC']],
    attributes: withHasTemplate(DocType),
  });
}

async function findDocType(id, jalId) {
  return DocType.findOne({
    where: { id, jal_id: jalId },
    attributes: withHasTemplate(DocType),
  });
}

async function createDocType({ jalId, name, fields, tipoTramite = 'salida', templateData = null }) {
  return DocType.create({
    id: uuidv4(),
    jal_id: jalId,
    name,
    fields,
    tipo_tramite: tipoTramite,
    template_data: templateData,
    template_path: null,
  });
}

async function updateDocType(docType, updates) {
  await docType.update(updates);
}

module.exports = { listDocTypes, findDocType, createDocType, updateDocType };
