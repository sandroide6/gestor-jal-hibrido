'use strict';
const { Document, Jal } = require('../models');
const { TIPO_TRAMITE_ABBR } = require('../config/constants');

const DEFAULT_CODIGO_DEPENDENCIA = 'JAL';

function sanitizeCodigo(codigo) {
  return String(codigo || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || DEFAULT_CODIGO_DEPENDENCIA;
}

/**
 * Reclama de forma atómica el siguiente consecutivo de radicado para
 * jal_id + año + tipo_tramite y devuelve el número formateado
 * AÑO-CODIGO_DEPENDENCIA-TIPO_TRAMITE-CONSECUTIVO (consecutivo de 6 dígitos).
 *
 * Debe llamarse dentro de la misma transacción que crea el Document, para que
 * un fallo posterior (generación de archivos o el propio INSERT) revierta también
 * el consecutivo reclamado y no queden huecos en la numeración.
 */
async function assignNumeroRadicado({ jalId, tipoTramite, transaction }) {
  const year = new Date().getFullYear();

  const jal = await Jal.findByPk(jalId, { transaction });
  const codigoDependencia = sanitizeCodigo(jal?.config?.codigo_dependencia);

  const rows = await Document.sequelize.query(
    `INSERT INTO radicado_counters (jal_id, year, tipo_tramite, last_value, created_at, updated_at)
     VALUES (:jalId, :year, :tipoTramite, 1, NOW(), NOW())
     ON CONFLICT (jal_id, year, tipo_tramite)
     DO UPDATE SET last_value = radicado_counters.last_value + 1, updated_at = NOW()
     RETURNING last_value`,
    {
      replacements: { jalId, year, tipoTramite },
      type: Document.sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  const consecutivo = rows[0].last_value;
  const abbr = TIPO_TRAMITE_ABBR[tipoTramite] || 'INT';

  return `${year}-${codigoDependencia}-${abbr}-${String(consecutivo).padStart(6, '0')}`;
}

module.exports = { assignNumeroRadicado };
