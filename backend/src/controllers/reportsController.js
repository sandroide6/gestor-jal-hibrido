'use strict';
const { getIp } = require('../utils/request');
// exceljs es pesado de requerir y este controlador se importa siempre al arrancar (vía
// las rutas). Diferirlo hasta la primera exportación a Excel recorta el tiempo hasta el
// primer app.listen(); require() ya cachea el módulo tras la primera llamada.
function getExcelJS() {
  return require('exceljs');
}
const { Op } = require('sequelize');
const { Document, DocType, User } = require('../models');
const audit = require('../services/auditService');


function buildWhere(query, jalId) {
  const where = { jal_id: jalId };
  if (query.doc_type_id)  where.doc_type_id = query.doc_type_id;
  if (query.user_id)      where.user_id = query.user_id;
  if (query.reviewed !== undefined && query.reviewed !== '') {
    where.reviewed = query.reviewed === 'true';
  }
  if (query.date_from || query.date_to) {
    where.created_at = {};
    if (query.date_from) where.created_at[Op.gte] = new Date(query.date_from);
    if (query.date_to) {
      const to = new Date(query.date_to);
      to.setHours(23, 59, 59, 999);
      where.created_at[Op.lte] = to;
    }
  }
  return where;
}

async function exportDocuments(req, res, next) {
  try {
    const docs = await Document.findAll({
      where: buildWhere(req.query, req.user.jal_id),
      include: [
        { model: User, as: 'author',   attributes: ['name', 'email'] },
        { model: User, as: 'reviewer', attributes: ['name'], required: false },
      ],
      order: [['created_at', 'DESC']],
    });

    const ExcelJS = getExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Gestor JAL';
    wb.created = new Date();

    // ── Hoja principal ──────────────────────────────────────
    const ws = wb.addWorksheet('Documentos');

    ws.columns = [
      { header: 'ID',                 key: 'id',              width: 38 },
      { header: 'Fecha creación',     key: 'created_at',      width: 20 },
      { header: 'Tipo de documento',  key: 'doc_type_name',   width: 30 },
      { header: 'Beneficiario',       key: 'beneficiary_name',width: 30 },
      { header: 'ID Beneficiario',    key: 'beneficiary_id',  width: 20 },
      { header: 'Auxiliar',           key: 'author',          width: 30 },
      { header: 'Correo auxiliar',    key: 'author_email',    width: 35 },
      { header: 'Estado sincronización', key: 'sync_status',  width: 18 },
      { header: 'Revisado',           key: 'reviewed',        width: 10 },
      { header: 'Fecha revisión',     key: 'reviewed_at',     width: 20 },
      { header: 'Revisado por',       key: 'reviewed_by',     width: 30 },
    ];

    // Estilo de encabezado
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    const STATUS_LABEL = { pending: 'Pendiente', synced: 'Sincronizado', conflict: 'Conflicto' };

    docs.forEach(doc => {
      ws.addRow({
        id:               doc.id,
        created_at:       doc.created_at ? new Date(doc.created_at).toLocaleString('es-CO') : '',
        doc_type_name:    doc.doc_type_name,
        beneficiary_name: doc.beneficiary_name,
        beneficiary_id:   doc.beneficiary_id,
        author:           doc.author?.name || '',
        author_email:     doc.author?.email || '',
        sync_status:      STATUS_LABEL[doc.sync_status] || doc.sync_status,
        reviewed:         doc.reviewed ? 'Sí' : 'No',
        reviewed_at:      doc.reviewed_at ? new Date(doc.reviewed_at).toLocaleString('es-CO') : '',
        reviewed_by:      doc.reviewer?.name || '',
      });
    });

    // Zebra striping
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const fill = rowNum % 2 === 0
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FF' } }
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      row.fill = fill;
      row.alignment = { vertical: 'middle' };
    });

    ws.autoFilter = { from: 'A1', to: 'K1' };

    // ── Hoja de resumen ──────────────────────────────────────
    const wsSummary = wb.addWorksheet('Resumen');
    wsSummary.columns = [
      { header: 'Tipo de documento', key: 'type', width: 35 },
      { header: 'Total',             key: 'total', width: 10 },
      { header: 'Revisados',         key: 'reviewed', width: 12 },
      { header: 'Pendientes revisión', key: 'pending', width: 18 },
    ];

    const sumHeader = wsSummary.getRow(1);
    sumHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sumHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    sumHeader.height = 22;

    const byType = {};
    docs.forEach(doc => {
      const k = doc.doc_type_name;
      if (!byType[k]) byType[k] = { total: 0, reviewed: 0 };
      byType[k].total++;
      if (doc.reviewed) byType[k].reviewed++;
    });

    Object.entries(byType)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([type, counts]) => {
        wsSummary.addRow({ type, total: counts.total, reviewed: counts.reviewed, pending: counts.total - counts.reviewed });
      });

    wsSummary.addRow({});
    const totalRow = wsSummary.addRow({
      type: 'TOTAL',
      total: docs.length,
      reviewed: docs.filter(d => d.reviewed).length,
      pending: docs.filter(d => !d.reviewed).length,
    });
    totalRow.font = { bold: true };

    await audit.log({
      userId: req.user.sub,
      action: 'report.export_documents',
      resource: 'reports/documents',
      result: 'success',
      ip: getIp(req),
      metadata: { count: docs.length, filters: req.query },
    });

    const filename = `reporte_documentos_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    const docs = await Document.findAll({
      where: buildWhere(req.query, req.user.jal_id),
      attributes: ['doc_type_name', 'reviewed', 'created_at', 'user_id'],
      include: [{ model: User, as: 'author', attributes: ['name'] }],
      order: [['created_at', 'ASC']],
    });

    const total    = docs.length;
    const reviewed = docs.filter((d) => d.reviewed).length;

    // Por tipo
    const typeMap = {};
    docs.forEach((d) => {
      const k = d.doc_type_name;
      if (!typeMap[k]) typeMap[k] = { name: k, total: 0, reviewed: 0, pending: 0 };
      typeMap[k].total++;
      if (d.reviewed) typeMap[k].reviewed++;
      else             typeMap[k].pending++;
    });
    const byType = Object.values(typeMap).sort((a, b) => b.total - a.total);

    // Por auxiliar
    const userMap = {};
    docs.forEach((d) => {
      const name = d.author?.name || 'Desconocido';
      if (!userMap[name]) userMap[name] = { name, total: 0 };
      userMap[name].total++;
    });
    const byUser = Object.values(userMap).sort((a, b) => b.total - a.total);

    // Por día
    const dayMap = {};
    docs.forEach((d) => {
      const day = d.created_at.toISOString().slice(0, 10);
      if (!dayMap[day]) dayMap[day] = { date: day, count: 0 };
      dayMap[day].count++;
    });
    const byDay = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ total, reviewed, pending: total - reviewed, byType, byUser, byDay });
  } catch (err) { next(err); }
}

module.exports = { exportDocuments, getStats };
