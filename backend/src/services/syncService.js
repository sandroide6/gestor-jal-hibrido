'use strict';
// Sincronización de documentos creados sin conexión.
//
// Desde la auditoría de producción 2026-11-05 (P0-2) esta ruta ya no genera el
// documento por su cuenta: delega en documentService.createDocument, la misma función
// que usa la ruta en línea. Antes eran dos implementaciones separadas y la de aquí:
//   - no guardaba file_docx/file_pdf en la base (solo en el disco efímero de Render),
//   - no añadía firma, encargado ni cargo, así que las plantillas oficiales fallaban,
//   - creaba un documento nuevo (y otro radicado) en cada reenvío del mismo localId.
// Ahora el localId del cliente se guarda como client_local_id y hace idempotente el envío.
const documentService = require('./documentService');
const audit = require('./auditService');
const notify = require('./notificationService');

// Procesa una operación 'create' de documento offline
async function processDocumentCreate({ localId, data, userId, jalId, role, ip }) {
  const { doc_type_id, beneficiary_name, beneficiary_id, edil_id, ...formFields } = data;
  // El identificador válido es el localId de la operación, no uno dentro de data
  delete formFields.client_local_id;

  const { doc, docType, duplicate } = await documentService.createDocument({
    jalId,
    userId,
    role,
    docTypeId: doc_type_id,
    beneficiaryName: beneficiary_name,
    beneficiaryId: beneficiary_id,
    formFields,
    uploadedSignature: null,
    ip,
    edilId: edil_id || null,
    clientLocalId: localId,
  });

  if (!duplicate) {
    await audit.log({
      userId,
      action: 'document.sync_create',
      resource: `documents/${doc.id}`,
      result: 'success',
      ip,
      metadata: { localId, doc_type: docType.name, beneficiary_id, numero_radicado: doc.numero_radicado },
    });

    await notify.notify({
      userId,
      type: 'document.synced',
      message: `Tu documento "${docType.name}" para ${beneficiary_name} fue sincronizado correctamente.`,
      metadata: { document_id: doc.id, doc_type_name: docType.name, local_id: localId },
    });

    if (edil_id) {
      await notify.notify({
        userId: edil_id,
        type: 'document.pending_review',
        message: `Se sincronizó un documento "${docType.name}" generado a tu nombre para ${beneficiary_name}. Revísalo.`,
        metadata: { document_id: doc.id, doc_type_name: docType.name },
      });
    }
  }

  return {
    localId,
    status: 'success',
    duplicate: !!duplicate,
    serverId: doc.id,
    numero_radicado: doc.numero_radicado,
    document_number: doc.document_number,
    download: {
      docx: `/documents/${doc.id}/download?format=docx`,
      pdf: `/documents/${doc.id}/download?format=pdf`,
    },
  };
}

// Procesa un lote de operaciones offline enviadas por el cliente
async function processBatch({ operations, userId, jalId, role, ip }) {
  const results = [];

  for (const op of operations) {
    try {
      if (op.operation === 'create' && op.payload?.resource === 'documents') {
        const result = await processDocumentCreate({
          localId: op.payload.localId,
          data: op.payload.data || op.payload.payload, // acepta legacy 'payload' key
          userId,
          jalId,
          role,
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
        code: err.code,
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
