'use strict';
const { getIp } = require('../utils/request');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const PizZip = require('pizzip');
const ExcelJS = require('exceljs');
const schemas = require('../validations/admin');
const { Document, DocType, User, AuditLog, sequelize } = require('../models');
const audit = require('../services/auditService');


async function stats(req, res, next) {
  try {
    const jalId = req.user.jal_id;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalDocuments,
      documentsThisMonth,
      pendingReview,
      activeDocTypes,
      activeUsers,
      recentDocuments,
    ] = await Promise.all([
      Document.count({ where: { jal_id: jalId } }),
      Document.count({ where: { jal_id: jalId, created_at: { [Op.gte]: startOfMonth } } }),
      Document.count({ where: { jal_id: jalId, reviewed: false, sync_status: 'synced' } }),
      DocType.count({ where: { jal_id: jalId, active: true } }),
      User.count({ where: { jal_id: jalId, active: true } }),
      Document.findAll({
        where: { jal_id: jalId },
        include: [{ model: User, as: 'author', attributes: ['name'] }],
        order: [['created_at', 'DESC']],
        limit: 5,
        attributes: ['id', 'doc_type_name', 'beneficiary_name', 'reviewed', 'sync_status', 'created_at'],
      }),
    ]);

    res.json({
      totalDocuments,
      documentsThisMonth,
      pendingReview,
      activeDocTypes,
      activeUsers,
      recentDocuments: recentDocuments.map(d => ({
        id: d.id,
        doc_type_name: d.doc_type_name,
        beneficiary_name: d.beneficiary_name,
        reviewed: d.reviewed,
        sync_status: d.sync_status,
        created_at: d.created_at,
        author: d.author?.name || '',
      })),
    });
  } catch (err) { next(err); }
}

async function backup(req, res, next) {
  try {
    const jalId = req.user.jal_id;

    const [docs, docTypes, users] = await Promise.all([
      Document.findAll({ where: { jal_id: jalId } }),
      DocType.findAll({ where: { jal_id: jalId } }),
      User.findAll({ where: { jal_id: jalId } }),
    ]);

    const zip = new PizZip();

    // ── Manifiestos JSON ─────────────────────────────────────
    zip.file('manifest.json', JSON.stringify({
      exportedAt: new Date().toISOString(),
      jal_id: jalId,
      counts: { documents: docs.length, docTypes: docTypes.length, users: users.length },
    }, null, 2));

    zip.file('data/documentos.json', JSON.stringify(docs.map(d => d.toJSON()), null, 2));
    zip.file('data/tipos_documento.json', JSON.stringify(docTypes.map(d => d.toJSON()), null, 2));
    zip.file('data/usuarios.json', JSON.stringify(
      users.map(u => {
        const j = u.toJSON();
        delete j.password_hash;
        return j;
      }),
      null, 2
    ));

    // ── Archivos de documentos ────────────────────────────────
    let filesAdded = 0;
    for (const doc of docs) {
      const safeName = `${doc.id}`;
      if (doc.file_path_docx && fs.existsSync(doc.file_path_docx)) {
        zip.file(`archivos/${safeName}.docx`, fs.readFileSync(doc.file_path_docx));
        filesAdded++;
      }
      if (doc.file_path_pdf && fs.existsSync(doc.file_path_pdf)) {
        zip.file(`archivos/${safeName}.pdf`, fs.readFileSync(doc.file_path_pdf));
        filesAdded++;
      }
    }

    // ── Plantillas de tipos de documento ─────────────────────
    for (const dt of docTypes) {
      if (dt.template_path && fs.existsSync(dt.template_path)) {
        const ext = path.extname(dt.template_path);
        const safeDtName = dt.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        zip.file(`plantillas/${safeDtName}${ext}`, fs.readFileSync(dt.template_path));
      }
    }

    // ── Excel con metadatos ───────────────────────────────────
    const xlsxBuffer = await buildExcelReport(docs);
    zip.file('data/reporte_documentos.xlsx', xlsxBuffer);

    const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    await audit.log({
      userId: req.user.sub,
      action: 'backup.export',
      resource: 'backups/export',
      result: 'success',
      ip: getIp(req),
      metadata: { documents: docs.length, filesAdded },
    });

    const filename = `backup_jal_${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

// Schema en src/validations/admin.js — validate middleware aplicado en routes/admin.js
async function auditLogs(req, res, next) {
  try {
    // req.query ya validado por validate(adminSchemas.auditQuery, 'query') en la ruta
    const value = req.query;

    // Aislamiento multi-JAL: el WHERE principal (el que realmente filtra las filas de
    // AuditLog) debe restringirse a usuarios de la JAL del solicitante — el `where` de
    // un include con `required:false` NO filtra filas, solo decide si se adjuntan los
    // datos del usuario (era la causa de la fuga: antes solo se filtraba ahí).
    const jalUserIds = (await User.findAll({
      where: { jal_id: req.user.jal_id },
      attributes: ['id'],
    })).map(u => u.id);

    const where = {};
    where.user_id = value.user_id
      ? { [Op.in]: jalUserIds, [Op.eq]: value.user_id } // debe pertenecer a la JAL Y coincidir
      : { [Op.in]: jalUserIds };
    if (value.result)  where.result  = value.result;
    if (value.action)  where.action  = { [Op.iLike]: `%${value.action}%` };
    if (value.date_from || value.date_to) {
      where.timestamp = {};
      if (value.date_from) where.timestamp[Op.gte] = new Date(value.date_from);
      if (value.date_to) {
        const to = new Date(value.date_to);
        to.setHours(23, 59, 59, 999);
        where.timestamp[Op.lte] = to;
      }
    }

    // Adjuntar datos del usuario en la respuesta (nombre/email/rol) — ya no es la
    // única línea de defensa del aislamiento, esa la da el `where` de arriba.
    const userWhere = { jal_id: req.user.jal_id };

    const offset = (value.page - 1) * value.limit;
    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'user',
        attributes: ['name', 'email', 'role'],
        where: userWhere,
        required: false,
      }],
      order: [['timestamp', 'DESC']],
      limit: value.limit,
      offset,
    });

    res.json({
      total: count,
      page: value.page,
      pages: Math.ceil(count / value.limit),
      rows: rows.map(r => ({
        id: r.id,
        timestamp: r.timestamp,
        action: r.action,
        resource: r.resource,
        result: r.result,
        ip: r.ip,
        metadata: r.metadata,
        user: r.user ? { name: r.user.name, email: r.user.email, role: r.user.role } : null,
      })),
    });
  } catch (err) { next(err); }
}

async function buildExcelReport(docs) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestor JAL';
  wb.created = new Date();

  const ws = wb.addWorksheet('Documentos');
  ws.columns = [
    { header: 'N.° Documento',       key: 'document_number',  width: 16 },
    { header: 'Fecha creación',       key: 'created_at',       width: 20 },
    { header: 'Tipo de documento',    key: 'doc_type_name',    width: 30 },
    { header: 'Beneficiario',         key: 'beneficiary_name', width: 30 },
    { header: 'ID Beneficiario',      key: 'beneficiary_id',   width: 18 },
    { header: 'Auxiliar',             key: 'author',           width: 28 },
    { header: 'Estado sincronización',key: 'sync_status',      width: 18 },
    { header: 'Revisado',             key: 'reviewed',         width: 10 },
    { header: 'Fecha revisión',       key: 'reviewed_at',      width: 20 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  headerRow.height = 22;

  const STATUS_LABEL = { pending: 'Pendiente', synced: 'Sincronizado', conflict: 'Conflicto' };
  docs.forEach((doc, i) => {
    const row = ws.addRow({
      document_number:  doc.document_number || '—',
      created_at:       doc.created_at ? new Date(doc.created_at).toLocaleString('es-CO') : '',
      doc_type_name:    doc.doc_type_name,
      beneficiary_name: doc.beneficiary_name,
      beneficiary_id:   doc.beneficiary_id,
      author:           doc.author?.name || '',
      sync_status:      STATUS_LABEL[doc.sync_status] || doc.sync_status,
      reviewed:         doc.reviewed ? 'Sí' : 'No',
      reviewed_at:      doc.reviewed_at ? new Date(doc.reviewed_at).toLocaleString('es-CO') : '',
    });
    row.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: i % 2 === 0 ? 'FFF5F8FF' : 'FFFFFFFF' },
    };
  });

  ws.autoFilter = { from: 'A1', to: 'I1' };
  return wb.xlsx.writeBuffer();
}

async function exportData(req, res, next) {
  try {
    const jalId = req.user.jal_id;
    const { date_from, date_to } = req.query;

    const where = { jal_id: jalId };
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) where.created_at[Op.gte] = new Date(date_from);
      if (date_to) {
        const end = new Date(date_to);
        end.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = end;
      }
    }

    const docs = await Document.findAll({
      where,
      include: [{ model: User, as: 'author', attributes: ['name', 'email'] }],
      order: [['created_at', 'DESC']],
    });

    const zip = new PizZip();

    const xlsxBuffer = await buildExcelReport(docs);
    zip.file('reporte_documentos.xlsx', xlsxBuffer);

    let filesAdded = 0;
    for (const doc of docs) {
      const safeName = doc.document_number
        ? doc.document_number.replace(/[^a-zA-Z0-9_-]/g, '_')
        : doc.id.slice(0, 8);
      const folder = `documentos/${doc.doc_type_name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      if (doc.file_path_pdf && fs.existsSync(doc.file_path_pdf)) {
        zip.file(`${folder}/${safeName}.pdf`, fs.readFileSync(doc.file_path_pdf));
        filesAdded++;
      }
    }

    const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

    await audit.log({
      userId: req.user.sub,
      action: 'admin.export_data',
      resource: 'admin/export',
      result: 'success',
      ip: getIp(req),
      metadata: { documents: docs.length, filesAdded, date_from, date_to },
    });

    const filename = `datos_jal_${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

module.exports = { stats, backup, auditLogs, exportData };
