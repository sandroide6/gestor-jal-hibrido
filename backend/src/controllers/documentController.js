'use strict';
const { getIp } = require('../utils/request');
const fs = require('fs');
const path = require('path');
const docService = require('../services/documentService');
const audit = require('../services/auditService');
const notificationService = require('../services/notificationService');
const usersService = require('../services/usersService');

const STORAGE_ROOT = path.resolve(process.env.STORAGE_PATH || path.join(__dirname, '..', '..', 'data', 'output'));

// Schemas en src/validations/documents.js — validate middleware aplicado en routes/documents.js

async function create(req, res, next) {
  try {
    const { doc_type_id, beneficiary_name, beneficiary_id, edil_id, ...formFields } = req.body;

    const { doc, docType } = await docService.createDocument({
      jalId: req.user.jal_id,
      userId: req.user.sub,
      role: req.user.role,
      docTypeId: doc_type_id,
      beneficiaryName: beneficiary_name,
      beneficiaryId: beneficiary_id,
      formFields,
      uploadedSignature: req.file || null,
      ip: getIp(req),
      edilId: edil_id || null,
    });

    if (edil_id) {
      await notificationService.notify({
        userId: edil_id,
        type: 'document.pending_review',
        message: `${req.user.name} generó el documento "${docType.name}" a tu nombre para ${beneficiary_name}. Revísalo.`,
        metadata: { document_id: doc.id, doc_type_name: docType.name, created_by: req.user.name },
      });
    }

    res.status(201).json({
      id: doc.id,
      document_number: doc.document_number,
      numero_radicado: doc.numero_radicado,
      doc_type_name: docType.name,
      beneficiary_name,
      beneficiary_id,
      created_at: doc.created_at,
      download: {
        docx: `/documents/${doc.id}/download?format=docx`,
        pdf: `/documents/${doc.id}/download?format=pdf`,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function download(req, res, next) {
  try {
    const { id } = req.params;
    const format = req.query.format === 'docx' ? 'docx' : 'pdf';

    const doc = await docService.findDocumentInJal(id, req.user.jal_id);
    if (!doc) return res.status(404).json({ error: true, message: 'Documento no encontrado' });

    // IDOR: solo el autor del documento o un edil/administrador de la JAL (con función
    // de revisión sobre todos los documentos) pueden descargarlo — un auxiliar no puede
    // descargar documentos generados por otros usuarios solo por conocer el UUID.
    const isOwner = doc.user_id === req.user.sub;
    const canAccessAnyInJal = ['edil', 'administrador'].includes(req.user.role);
    if (!isOwner && !canAccessAnyInJal) {
      return res.status(404).json({ error: true, message: 'Documento no encontrado' });
    }

    const filePath = format === 'docx' ? doc.file_path_docx : doc.file_path_pdf;
    const fileBytes = format === 'docx' ? doc.file_docx : doc.file_pdf;

    const mimeType = format === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';

    // Camino rápido: el archivo sigue en el disco local (caso normal cuando el
    // backend corre en el PC / tiene disco persistente).
    if (filePath) {
      const resolvedPath = path.resolve(filePath);
      if (!resolvedPath.startsWith(STORAGE_ROOT + path.sep) && resolvedPath !== STORAGE_ROOT) {
        return res.status(403).json({ error: true, message: 'Acceso denegado' });
      }
      if (fs.existsSync(resolvedPath)) {
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="documento_${doc.id.slice(0, 8)}.${format}"`);
        return res.sendFile(resolvedPath);
      }
    }

    // El disco no tiene el archivo (ej. backend en Render tras un redeploy, disco
    // efímero) — usar la copia guardada en Postgres.
    if (fileBytes) {
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="documento_${doc.id.slice(0, 8)}.${format}"`);
      return res.send(fileBytes);
    }

    return res.status(404).json({ error: true, message: `Archivo ${format.toUpperCase()} no disponible` });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await docService.listOwnDocuments(req.user.jal_id, req.user.sub, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listForEdil(req, res, next) {
  try {
    const result = await docService.listDocumentsForEdil(req.user.jal_id, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const doc = await docService.findDocumentWithAuthor(req.params.id, req.user.jal_id);
    if (!doc) return res.status(404).json({ error: true, message: 'Documento no encontrado' });
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function markReviewed(req, res, next) {
  try {
    const doc = await docService.findDocumentInJal(req.params.id, req.user.jal_id);
    if (!doc) return res.status(404).json({ error: true, message: 'Documento no encontrado' });

    await docService.markDocumentReviewed(doc, req.user.sub);

    await audit.log({
      userId: req.user.sub,
      action: 'document.review',
      resource: `documents/${doc.id}`,
      result: 'success',
      ip: getIp(req),
      metadata: { beneficiary_id: doc.beneficiary_id },
    });

    await notificationService.notify({
      userId: doc.user_id,
      type: 'document.reviewed',
      message: `Tu documento "${doc.doc_type_name}" para ${doc.beneficiary_name} fue revisado por ${req.user.name}.`,
      metadata: { document_id: doc.id, doc_type_name: doc.doc_type_name, reviewer_name: req.user.name },
    });

    const admins = await usersService.listAdmins(req.user.jal_id);
    await Promise.all(
      admins
        .filter(a => a.id !== doc.user_id)
        .map(a =>
          notificationService.notify({
            userId: a.id,
            type: 'document.reviewed',
            message: `${req.user.name} revisó el documento "${doc.doc_type_name}" para ${doc.beneficiary_name}.`,
            metadata: { document_id: doc.id, doc_type_name: doc.doc_type_name, reviewer_name: req.user.name },
          })
        )
    );

    res.json({ id: doc.id, reviewed: true, reviewed_at: doc.reviewed_at });
  } catch (err) {
    next(err);
  }
}

async function pendingReviewCount(req, res, next) {
  try {
    const count = await docService.countPendingReview(req.user.jal_id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const doc = await docService.deleteDocument(req.params.id, req.user.jal_id, req.user.sub, getIp(req));
    res.json({ id: doc.id, deleted: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, download, list, listForEdil, getById, markReviewed, pendingReviewCount, remove };
