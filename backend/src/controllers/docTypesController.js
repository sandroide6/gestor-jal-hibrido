'use strict';
const { getIp } = require('../utils/request');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
// pizzip es pesado de requerir y este controlador se importa siempre al arrancar (vía
// las rutas). Diferirlo hasta el primer uso real recorta el tiempo hasta el primer
// app.listen(); require() ya cachea el módulo tras la primera llamada.
function getPizZip() {
  return require('pizzip');
}
const docTypes = require('../services/docTypesService');
const audit = require('../services/auditService');

const TEMPLATES_ROOT = path.resolve(path.join(__dirname, '..', '..', 'plantillas'));

// ── Template helpers ──────────────────────────────────────

function extractDocxVariables(buffer) {
  try {
    const PizZip = getPizZip();
    const zip = new PizZip(buffer);
    const xml = zip.file('word/document.xml')?.asText() || '';
    const clean = xml.replace(/<[^>]+>/g, '');
    const matches = clean.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))];
  } catch {
    return [];
  }
}

function validateTemplateVars(buffer, fieldNames) {
  const systemVars = ['jal_name', 'doc_type_name', 'fecha_expedicion', 'beneficiary_name', 'beneficiary_id', 'numero_radicado'];
  const tplVars = extractDocxVariables(buffer);
  const unknown = tplVars.filter((v) => !([...fieldNames, ...systemVars].includes(v)));
  return unknown.length ? [`Variables en la plantilla sin campo definido: ${unknown.join(', ')}`] : [];
}

// ── Handlers ──────────────────────────────────────────────

async function list(req, res, next) {
  try {
    const types = await docTypes.listDocTypes(req.user.jal_id);
    res.json(types);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, fields, tipo_tramite } = req.body;

    const names = fields.map((f) => f.name);
    if (new Set(names).size !== names.length) {
      return res.status(400).json({ error: true, message: 'Los nombres de campo deben ser únicos' });
    }

    let templateData = null;
    let warnings = [];

    if (req.file) {
      const buffer = await fs.readFile(req.file.path);
      await fs.unlink(req.file.path);
      templateData = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${buffer.toString('base64')}`;
      warnings = validateTemplateVars(buffer, names);
    }

    const docType = await docTypes.createDocType({
      jalId: req.user.jal_id,
      name,
      fields,
      tipoTramite: tipo_tramite,
      templateData,
    });

    await audit.log({
      userId: req.user.sub,
      action: 'doc_type.create',
      resource: `doc_types/${docType.id}`,
      result: 'success',
      ip: getIp(req),
    });

    const result = docType.toJSON();
    delete result.template_data;
    res.status(201).json({ ...result, has_template: !!templateData, warnings });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const docType = await docTypes.findDocType(req.params.id, req.user.jal_id);
    if (!docType) return res.status(404).json({ error: true, message: 'Tipo de documento no encontrado' });
    res.json(docType);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const docType = await docTypes.findDocType(req.params.id, req.user.jal_id);
    if (!docType) return res.status(404).json({ error: true, message: 'Tipo de documento no encontrado' });

    const { name, fields, active, tipo_tramite } = req.body;
    const updates = {};
    if (name         !== undefined) updates.name         = name;
    if (fields       !== undefined) updates.fields       = fields;
    if (active       !== undefined) updates.active       = active;
    if (tipo_tramite !== undefined) updates.tipo_tramite = tipo_tramite;

    let warnings = [];

    if (req.file) {
      const buffer = await fs.readFile(req.file.path);
      await fs.unlink(req.file.path);
      updates.template_data = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${buffer.toString('base64')}`;
      updates.template_path = null;
      const fieldNames = (updates.fields || docType.fields || []).map((f) => f.name);
      warnings = validateTemplateVars(buffer, fieldNames);
    }

    await docTypes.updateDocType(docType, updates);

    await audit.log({
      userId: req.user.sub,
      action: 'doc_type.update',
      resource: `doc_types/${docType.id}`,
      result: 'success',
      ip: getIp(req),
      metadata: { changes: Object.keys(updates) },
    });

    const result = docType.toJSON();
    delete result.template_data;
    res.json({ ...result, has_template: !!(updates.template_data || docType.template_data), warnings });
  } catch (err) { next(err); }
}

// Descarga el binario DOCX de la plantilla — usado por el frontend para caché offline
async function getTemplate(req, res, next) {
  try {
    const docType = await docTypes.findDocType(req.params.id, req.user.jal_id);
    if (!docType) return res.status(404).json({ error: true, message: 'Tipo de documento no encontrado' });

    let buffer = null;

    if (docType.template_data) {
      const raw = docType.template_data;
      const b64 = raw.includes(',') ? raw.split(',')[1] : raw;
      buffer = Buffer.from(b64, 'base64');
    } else if (docType.template_path) {
      // path.basename elimina cualquier traversal de directorios
      const tplPath = path.resolve(TEMPLATES_ROOT, path.basename(docType.template_path));
      if (tplPath.startsWith(TEMPLATES_ROOT) && fsSync.existsSync(tplPath)) {
        buffer = fsSync.readFileSync(tplPath);
      }
    }

    if (!buffer) {
      return res.status(404).json({ error: true, message: 'Este tipo de documento no tiene plantilla' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, getTemplate };
