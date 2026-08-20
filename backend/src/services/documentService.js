'use strict';
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { DocType, Document, Jal, User } = require('../models');
const documentGeneratorService = require('./documentGeneratorService');
const radicadoService = require('./radicadoService');
const documentNumberService = require('./documentNumberService');
const audit = require('./auditService');

const MAX_SIGNATURE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);
const ALLOWED_SIGNATURE_MIME = ['image/png', 'image/jpeg'];
const CARGO_MAP = {
  administrador: 'Presidente(a) de la JAL',
  edil: 'Edil(a)',
  auxiliar: 'Auxiliar de Gestión',
};

/**
 * Crea un documento: valida tipo, campos, firma, genera archivos y persiste en BD.
 * Lanza errores con `.status` para que el errorHandler los serialice correctamente.
 */
async function createDocument({ jalId, userId, role, docTypeId, beneficiaryName, beneficiaryId, formFields, uploadedSignature, ip, edilId }) {
  const docType = await DocType.findOne({
    where: { id: docTypeId, jal_id: jalId, active: true },
  });
  if (!docType) {
    throw Object.assign(new Error('Tipo de documento no encontrado o inactivo'), { status: 404 });
  }

  const missingFields = (docType.fields || [])
    .filter((f) => f.required && !formFields[f.name] && formFields[f.name] !== 0)
    .map((f) => f.label);
  if (missingFields.length > 0) {
    throw Object.assign(
      new Error(`Campos requeridos faltantes: ${missingFields.join(', ')}`),
      { status: 400 }
    );
  }

  if (uploadedSignature) {
    if (!ALLOWED_SIGNATURE_MIME.includes(uploadedSignature.mimetype)) {
      throw Object.assign(new Error('La firma debe ser PNG o JPG'), { status: 400 });
    }
    if (uploadedSignature.size > MAX_SIGNATURE_MB * 1024 * 1024) {
      throw Object.assign(new Error(`La firma no puede superar ${MAX_SIGNATURE_MB} MB`), { status: 400 });
    }
  }

  // Solo auxiliar (caso de uso original: preparar el documento para que el edil lo
  // revise) y administrador (control total) pueden generar a nombre de otro usuario.
  // Sin este chequeo, un edil podía pasar el id de OTRO edil y el sistema generaba el
  // documento con su firma, aunque el edil origen no tuviera ninguna relación con él.
  if (edilId && !['auxiliar', 'administrador'].includes(role)) {
    throw Object.assign(
      new Error('No tienes permiso para generar documentos a nombre de otro usuario'),
      { status: 403 }
    );
  }

  const [jal, signer, edilInfo] = await Promise.all([
    Jal.findByPk(jalId),
    User.unscoped().findByPk(userId, {
      attributes: ['name', 'cargo_titulo', 'signature_path', 'signature_data'],
    }),
    // IDOR: edilId viene del body del cliente — sin exigir jal_id + role:'edil' aquí,
    // cualquier usuario podía pasar el id de un edil de OTRA JAL y el sistema generaba
    // el documento con la firma y los datos de ese edil ajeno.
    edilId
      ? User.unscoped().findOne({
          where: { id: edilId, jal_id: jalId, role: 'edil', active: true },
          attributes: ['name', 'cargo_titulo', 'signature_path', 'signature_data'],
        })
      : Promise.resolve(null),
  ]);

  if (edilId && !edilInfo) {
    throw Object.assign(new Error('El edil seleccionado no existe o no pertenece a esta JAL'), { status: 404 });
  }

  let signaturePath = null;
  let signatureBuffer = null;
  let signatureMime = null;

  // Prefer edil's signature when document is generated on their behalf
  let sigSource = (edilInfo?.signature_data || edilInfo?.signature_path) ? edilInfo : signer;

  // Bloquear generación si no hay firma registrada
  if (!uploadedSignature && !sigSource?.signature_data && !sigSource?.signature_path) {
    const quien = edilId ? 'El edil seleccionado' : 'El firmante';
    throw Object.assign(
      new Error(`${quien} no tiene firma registrada. Registra una firma en el perfil antes de generar documentos.`),
      { status: 400 }
    );
  }

  if (uploadedSignature) {
    signaturePath = uploadedSignature.path;
  } else if (sigSource?.signature_data) {
    const [header, b64] = sigSource.signature_data.split(',');
    signatureMime = header.replace('data:', '').replace(';base64', '');
    signatureBuffer = Buffer.from(b64, 'base64');
  } else if (sigSource?.signature_path) {
    signaturePath = sigSource.signature_path;
  }

  const templateData = {
    beneficiary_name: beneficiaryName,
    beneficiary_id: beneficiaryId,
    ...formFields,
    jal_name: jal.name,
    doc_type_name: docType.name,
    fecha_expedicion: new Date().toLocaleDateString('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
    }),
    nombre_encargado: edilInfo?.name || signer?.name || '',
    cargo: edilInfo
      ? (edilInfo.cargo_titulo || CARGO_MAP['edil'] || 'Edil(a)')
      : (signer?.cargo_titulo || CARGO_MAP[role] || role),
    firma_img: '',
  };

  let doc;
  let numeroRadicado;

  // El radicado se reclama, el archivo se genera y el documento se inserta dentro de la
  // MISMA transacción: si la generación del DOCX/PDF o el INSERT fallan, la transacción
  // se revierte completa y el consecutivo reclamado queda libre para el siguiente intento
  // (sin huecos ni duplicados). Como contrapartida, dos generaciones concurrentes del mismo
  // jal_id + año + tipo_tramite se serializan mientras dure la generación de archivos.
  await Document.sequelize.transaction(async (t) => {
    numeroRadicado = await radicadoService.assignNumeroRadicado({
      jalId,
      tipoTramite: docType.tipo_tramite,
      transaction: t,
    });
    templateData.numero_radicado = numeroRadicado;

    const { docxPath, pdfPath, docxBuffer, pdfBuffer } = await documentGeneratorService.generateDocuments({
      jalId,
      jalName: jal.name,
      docType: {
        id: docType.id,
        name: docType.name,
        fields: docType.fields,
        template_path: docType.template_path,
        template_data: docType.template_data,
      },
      data: templateData,
      signaturePath,
      signatureBuffer,
      signatureMime,
    });

    const documentNumber = await documentNumberService.assignDocumentNumber({ jalId, transaction: t });

    doc = await Document.create({
      id: uuidv4(),
      jal_id: jalId,
      user_id: userId,
      edil_id: edilId || null,
      doc_type_id: docType.id,
      doc_type_name: docType.name,
      beneficiary_name: beneficiaryName,
      beneficiary_id: beneficiaryId,
      metadata: templateData,
      file_path_docx: docxPath,
      file_path_pdf: pdfPath,
      // Copia además en Postgres (no solo en disco): el disco del backend en Render
      // (free tier) es efímero, mientras que la BD sigue centralizada en el PC local
      // vía el túnel Tailscale. El disco se conserva como caché rápida cuando existe.
      file_docx: docxBuffer,
      file_pdf: pdfBuffer,
      sync_status: 'synced',
      document_number: documentNumber,
      numero_radicado: numeroRadicado,
      tipo_tramite: docType.tipo_tramite,
    }, { transaction: t });
  });

  await audit.log({
    userId,
    action: 'document.create',
    resource: `documents/${doc.id}`,
    result: 'success',
    ip,
    metadata: { doc_type: docType.name, beneficiary_id: beneficiaryId, numero_radicado: numeroRadicado },
  });

  return { doc, docType };
}

// ── Queries de lectura ────────────────────────────────────

async function findDocumentInJal(id, jalId) {
  return Document.findOne({ where: { id, jal_id: jalId } });
}

async function findDocumentWithAuthor(id, jalId) {
  return Document.findOne({
    where: { id, jal_id: jalId },
    include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }],
    // Este resultado se serializa directo a JSON en el controlador (getById) — excluir
    // las copias BYTEA para no inflar la respuesta con el binario completo del documento.
    attributes: { exclude: ['file_docx', 'file_pdf'] },
  });
}

async function listOwnDocuments(jalId, userId, { page, limit }) {
  const offset = (page - 1) * limit;
  const { count, rows } = await Document.findAndCountAll({
    where: { jal_id: jalId, user_id: userId },
    order: [['created_at', 'DESC']],
    limit,
    offset,
    attributes: ['id', 'document_number', 'numero_radicado', 'tipo_tramite', 'doc_type_name', 'beneficiary_name', 'beneficiary_id', 'sync_status', 'reviewed', 'created_at'],
  });
  return { data: rows, total: count, page, limit, pages: Math.ceil(count / limit) };
}

async function listDocumentsForEdil(jalId, filters) {
  const { doc_type_name, user_id, beneficiary, numero_radicado, sync_status, reviewed, date_from, date_to, page, limit } = filters;

  const where = { jal_id: jalId };

  if (doc_type_name) where.doc_type_name = doc_type_name;
  if (user_id)       where.user_id = user_id;
  if (sync_status)   where.sync_status = sync_status;
  if (reviewed !== undefined) where.reviewed = reviewed;
  if (numero_radicado) where.numero_radicado = { [Op.iLike]: `%${numero_radicado}%` };

  if (beneficiary) {
    where[Op.or] = [
      { beneficiary_name: { [Op.iLike]: `%${beneficiary}%` } },
      { beneficiary_id:   { [Op.iLike]: `%${beneficiary}%` } },
    ];
  }

  if (date_from || date_to) {
    where.created_at = {};
    if (date_from) where.created_at[Op.gte] = new Date(date_from);
    if (date_to) {
      const end = new Date(date_to);
      end.setHours(23, 59, 59, 999);
      where.created_at[Op.lte] = end;
    }
  }

  const offset = (page - 1) * limit;
  const { count, rows } = await Document.findAndCountAll({
    where,
    include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }],
    order: [['created_at', 'DESC']],
    limit,
    offset,
    // Excluir las copias BYTEA del contenido — listar no necesita el binario completo
    // de cada documento, solo download() lo consulta.
    attributes: { exclude: ['file_docx', 'file_pdf'] },
  });

  return { total: count, page, limit, pages: Math.ceil(count / limit), data: rows };
}

async function markDocumentReviewed(doc, reviewedBy) {
  await doc.update({ reviewed: true, reviewed_at: new Date(), reviewed_by: reviewedBy });
}

async function countPendingReview(jalId) {
  return Document.count({
    where: { jal_id: jalId, reviewed: false, sync_status: 'synced' },
  });
}

async function deleteDocument(id, jalId, deletedBy, ip) {
  const doc = await Document.findOne({ where: { id, jal_id: jalId } });
  if (!doc) throw Object.assign(new Error('Documento no encontrado'), { status: 404 });

  // Eliminar archivos físicos (sin lanzar error si ya no existen)
  const fs = require('fs');
  for (const filePath of [doc.file_path_docx, doc.file_path_pdf]) {
    if (filePath) { try { fs.unlinkSync(filePath); } catch {} }
  }

  await doc.destroy(); // soft-delete via paranoid

  await audit.log({
    userId: deletedBy,
    action: 'document.delete',
    resource: `documents/${id}`,
    result: 'success',
    ip,
    metadata: {
      document_number: doc.document_number,
      doc_type_name: doc.doc_type_name,
      beneficiary_name: doc.beneficiary_name,
      beneficiary_id: doc.beneficiary_id,
    },
  });

  return doc;
}

module.exports = {
  createDocument,
  findDocumentInJal,
  findDocumentWithAuthor,
  listOwnDocuments,
  listDocumentsForEdil,
  markDocumentReviewed,
  countPendingReview,
  deleteDocument,
};
