'use strict';
const { Document } = require('../models');

/**
 * Asigna el `document_number` legacy (formato NNNN-AÑO, correlativo por jal_id+año).
 * Extraído de documentService.createDocument para reusarlo también en la ruta de
 * sincronización offline (syncService.processDocumentCreate), que antes nunca lo
 * asignaba — los documentos generados offline quedaban con document_number NULL
 * para siempre, aunque los generados online sí lo tuvieran.
 *
 * Debe llamarse dentro de la misma transacción que crea el Document.
 */
async function assignDocumentNumber({ jalId, transaction }) {
  const year = new Date().getFullYear();

  // Advisory lock scoped to this JAL + year — prevents duplicate numbers under concurrency
  await Document.sequelize.query(
    'SELECT pg_advisory_xact_lock(hashtext(:key)::bigint)',
    { replacements: { key: `doc_num_${jalId}_${year}` }, transaction }
  );

  const rows = await Document.sequelize.query(
    `SELECT COALESCE(MAX(CAST(SPLIT_PART(document_number, '-', 1) AS INTEGER)), 0) + 1 AS next_n
     FROM documents
     WHERE jal_id = :jalId
       AND document_number LIKE :pattern
       AND deleted_at IS NULL`,
    {
      replacements: { jalId, pattern: `%-${year}` },
      type: Document.sequelize.QueryTypes.SELECT,
      transaction,
    }
  );

  const nextN = parseInt(rows[0].next_n, 10);
  return `${String(nextN).padStart(4, '0')}-${year}`;
}

module.exports = { assignDocumentNumber };
