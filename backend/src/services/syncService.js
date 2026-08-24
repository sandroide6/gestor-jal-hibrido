'use strict';
const { v4: uuidv4 } = require('uuid');
const { Document, DocType, Jal, User, SyncQueue } = require('../models');
// Ver el mismo comentario en documentService.js — diferido para no pagar el costo de
// requerir docx/pdf-lib/docxtemplater/mammoth/pizzip en cada arranque del proceso.
function getDocumentGeneratorService() {
  return require('./documentGeneratorService');
}
const radicadoService = require('./radicadoService');
const documentNumberService = require('./documentNumberService');
const audit = require('./auditService');
const notify = require('./notificationService');

const MAX_RETRIES = 5;

// Procesa una operación 'create' de documento offline
async function processDocumentCreate({ localId, data, userId, jalId, ip }) {
  const { doc_type_id, beneficiary_name, beneficiary_id, edil_id, ...formFields } = data;

  const docType = await DocType.findOne({ where: { id: doc_type_id, jal_id: jalId, active: true } });
  if (!docType) {
    throw Object.assign(new Error('Tipo de documento no encontrado o inactivo'), { code: 'DOC_TYPE_NOT_FOUND' });
  }

  const jal = await Jal.findByPk(jalId);

  // IDOR: edil_id viene del payload que el cliente sincroniza — sin validar que
  // pertenezca a esta JAL, se podía atribuir el documento (y notificar) a un edil
  // de otra JAL (mismo hallazgo que en documentService.createDocument).
  if (edil_id) {
    const edil = await User.findOne({ where: { id: edil_id, jal_id: jalId, role: 'edil', active: true } });
    if (!edil) {
      throw Object.assign(new Error('El edil seleccionado no existe o no pertenece a esta JAL'), { code: 'INVALID_EDIL' });
    }
  }

  // Campos requeridos
  const missing = (docType.fields || [])
    .filter((f) => f.required && !formFields[f.name] && formFields[f.name] !== 0)
    .map((f) => f.label);
  if (missing.length) {
    throw Object.assign(new Error(`Campos requeridos faltantes: ${missing.join(', ')}`), { code: 'MISSING_FIELDS' });
  }

  const templateData = {
    beneficiary_name,
    beneficiary_id,
    ...formFields,
    jal_name: jal.name,
    doc_type_name: docType.name,
    fecha_expedicion: new Date().toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
  };

  const serverId = uuidv4();
  let numeroRadicado;

  // Mismo criterio que documentService.createDocument: radicado + generación de archivos +
  // INSERT dentro de una sola transacción, para que un fallo revierta también el consecutivo.
  await Document.sequelize.transaction(async (t) => {
    numeroRadicado = await radicadoService.assignNumeroRadicado({
      jalId,
      tipoTramite: docType.tipo_tramite,
      transaction: t,
    });
    templateData.numero_radicado = numeroRadicado;

    const { docxPath, pdfPath } = await getDocumentGeneratorService().generateDocuments({
      jalId,
      jalName: jal.name,
      docType: { id: docType.id, name: docType.name, fields: docType.fields, template_path: docType.template_path, template_data: docType.template_data },
      data: templateData,
    });

    // Fix: esta ruta (sync offline→online) nunca asignaba document_number, a
    // diferencia de documentService.createDocument — los documentos sincronizados
    // quedaban con ese campo en NULL para siempre.
    const documentNumber = await documentNumberService.assignDocumentNumber({ jalId, transaction: t });

    await Document.create({
      id: serverId,
      jal_id: jalId,
      user_id: userId,
      edil_id: edil_id || null,
      doc_type_id: docType.id,
      doc_type_name: docType.name,
      beneficiary_name,
      beneficiary_id,
      metadata: templateData,
      file_path_docx: docxPath,
      file_path_pdf: pdfPath,
      sync_status: 'synced',
      document_number: documentNumber,
      numero_radicado: numeroRadicado,
      tipo_tramite: docType.tipo_tramite,
    }, { transaction: t });
  });

  await audit.log({
    userId,
    action: 'document.sync_create',
    resource: `documents/${serverId}`,
    result: 'success',
    ip,
    metadata: { localId, doc_type: docType.name, beneficiary_id, numero_radicado: numeroRadicado },
  });

  await notify.notify({
    userId,
    type: 'document.synced',
    message: `Tu documento "${docType.name}" para ${beneficiary_name} fue sincronizado correctamente.`,
    metadata: { document_id: serverId, doc_type_name: docType.name, local_id: localId },
  });

  if (edil_id) {
    await notify.notify({
      userId: edil_id,
      type: 'document.pending_review',
      message: `Se sincronizó un documento "${docType.name}" generado a tu nombre para ${beneficiary_name}. Revísalo.`,
      metadata: { document_id: serverId, doc_type_name: docType.name },
    });
  }

  return {
    localId,
    status: 'success',
    serverId,
    download: {
      docx: `/documents/${serverId}/download?format=docx`,
      pdf: `/documents/${serverId}/download?format=pdf`,
    },
  };
}

// Procesa un lote de operaciones offline enviadas por el cliente
async function processBatch({ operations, userId, jalId, ip }) {
  const results = [];

  for (const op of operations) {
    try {
      if (op.operation === 'create' && op.payload?.resource === 'documents') {
        const result = await processDocumentCreate({
          localId: op.payload.localId,
          data: op.payload.data || op.payload.payload, // acepta legacy 'payload' key
          userId,
          jalId,
          ip,
        });
        results.push(result);
      } else {
        results.push({
          localId: op.payload?.localId,
          status: 'error',
          message: `Operación no soportada: ${op.operation}/${op.payload?.resource}`,
        });
      }
    } catch (err) {
      await audit.log({
        userId,
        action: 'sync.batch_item_error',
        result: 'error',
        ip,
        metadata: { localId: op.payload?.localId, error: err.message, code: err.code },
      });

      results.push({
        localId: op.payload?.localId,
        status: err.code === 'DOC_TYPE_NOT_FOUND' ? 'conflict' : 'error',
        message: err.message,
      });
    }
  }

  await audit.log({
    userId,
    action: 'sync.batch',
    result: 'success',
    ip,
    metadata: {
      total: operations.length,
      success: results.filter((r) => r.status === 'success').length,
      error: results.filter((r) => r.status === 'error').length,
      conflict: results.filter((r) => r.status === 'conflict').length,
    },
  });

  return results;
}

module.exports = { processBatch, processDocumentCreate };
