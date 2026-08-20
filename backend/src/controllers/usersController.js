'use strict';
const { getIp } = require('../utils/request');
const fs = require('fs');
const users = require('../services/usersService');
const audit = require('../services/auditService');
// Schemas en src/validations/users.js — validate middleware aplicado en routes/users.js

// ── Handlers ──────────────────────────────────────────────

async function list(req, res, next) {
  try {
    // req.query ya validado por validate(listSchema, 'query') en la ruta
    const result = await users.listUsers(req.user.jal_id, req.query);
    res.json(result);
  } catch (err) { next(err); }
}

// Lista solo ediles activos de la JAL — accesible para cualquier rol autenticado
async function listEdiles(req, res, next) {
  try {
    const ediles = await users.listEdiles(req.user.jal_id);
    res.json(ediles);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const exists = await users.findUserByEmail(req.body.email);
    if (exists) return res.status(409).json({ error: true, message: 'Ya existe un usuario con ese correo electrónico' });

    const user = await users.createUser({ jalId: req.user.jal_id, ...req.body });

    await audit.log({
      userId: req.user.sub,
      action: 'user.create',
      resource: `users/${user.id}`,
      result: 'success',
      ip: getIp(req),
      metadata: { role: req.body.role, email: '***' },
    });

    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const user = await users.findUserInJal(req.params.id, req.user.jal_id);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });

    if (req.params.id === req.user.sub && req.body.active === false) {
      return res.status(400).json({ error: true, message: 'No puedes desactivar tu propia cuenta' });
    }

    const updates = {};
    const { name, email, role, active } = req.body;
    if (name  !== undefined) updates.name  = name;
    if (email !== undefined) updates.email = email;
    if (role  !== undefined) updates.role  = role;

    if (active === false && user.active === true) {
      updates.active = false;
      updates.tokens_invalid_before = new Date();
    } else if (active === true && user.active === false) {
      updates.active = true;
    }

    await users.updateUser(user, updates);

    await audit.log({
      userId: req.user.sub,
      action: 'user.update',
      resource: `users/${user.id}`,
      result: 'success',
      ip: getIp(req),
      metadata: { changes: Object.keys(updates) },
    });

    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active });
  } catch (err) { next(err); }
}

async function deactivate(req, res, next) {
  try {
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ error: true, message: 'No puedes desactivar tu propia cuenta' });
    }

    const user = await users.findUserInJal(req.params.id, req.user.jal_id);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });

    await users.deactivateUser(user);

    await audit.log({
      userId: req.user.sub,
      action: 'user.deactivate',
      resource: `users/${user.id}`,
      result: 'success',
      ip: getIp(req),
    });

    res.json({ message: 'Usuario desactivado. Sus tokens activos han sido invalidados.' });
  } catch (err) { next(err); }
}

async function me(req, res, next) {
  try {
    const user = await users.getUserProfile(req.user.sub);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });

    const jal = await users.findJalById(req.user.jal_id);

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      cargo_titulo: user.cargo_titulo,
      has_firma: !!(user.signature_data || (user.signature_path && fs.existsSync(user.signature_path))),
      jal: jal ? { id: jal.id, name: jal.name } : null,
      created_at: user.created_at,
    });
  } catch (err) { next(err); }
}

async function updateMe(req, res, next) {
  try {
    const user = await users.findUserByPk(req.user.sub);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });

    if (req.body.email && req.body.email !== user.email) {
      const exists = await users.findUserByEmail(req.body.email);
      if (exists) return res.status(409).json({ error: true, message: 'Ese correo ya está en uso' });
    }

    await users.updateUser(user, req.body);

    await audit.log({
      userId: req.user.sub,
      action: 'user.update_profile',
      resource: `users/${user.id}`,
      result: 'success',
      ip: getIp(req),
      metadata: { changes: Object.keys(req.body) },
    });

    res.json({ id: user.id, name: user.name, email: user.email, cargo_titulo: user.cargo_titulo });
  } catch (err) { next(err); }
}

async function uploadFirma(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: true, message: 'No se recibió ningún archivo' });

    const allowed = ['image/png', 'image/jpeg'];
    if (!allowed.includes(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: true, message: 'La firma debe ser PNG o JPG' });
    }

    const MAX_MB = 5;
    if (req.file.size > MAX_MB * 1024 * 1024) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: true, message: `La firma no puede superar ${MAX_MB} MB` });
    }

    const user = await users.findUserByPk(req.user.sub);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });

    const buffer = fs.readFileSync(req.file.path);
    fs.unlinkSync(req.file.path);
    const base64 = `data:${req.file.mimetype};base64,${buffer.toString('base64')}`;

    await users.saveSignature(user, base64);
    res.json({ message: 'Firma guardada correctamente', has_firma: true });
  } catch (err) { next(err); }
}

async function getFirma(req, res, next) {
  try {
    const user = await users.getSignatureData(req.user.sub);
    if (!user?.signature_data) {
      return res.status(404).json({ error: true, message: 'Sin firma registrada' });
    }
    res.json({ data_url: user.signature_data });
  } catch (err) { next(err); }
}

async function deleteFirma(req, res, next) {
  try {
    const user = await users.findUserByPk(req.user.sub);
    await users.clearSignature(user);
    res.json({ message: 'Firma eliminada', has_firma: false });
  } catch (err) { next(err); }
}

async function hardDelete(req, res, next) {
  try {
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ error: true, message: 'No puedes eliminarte a ti mismo' });
    }

    const user = await users.findUserInJal(req.params.id, req.user.jal_id);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });

    await audit.log({
      userId: req.user.sub,
      action: 'user.delete',
      resource: `users/${user.id}`,
      result: 'success',
      ip: getIp(req),
      metadata: { name: user.name, role: user.role },
    });

    await users.hardDeleteUser(user);
    res.json({ id: user.id, deleted: true });
  } catch (err) {
    // FK violation: user has documents
    if (err.parent?.code === '23503') {
      return res.status(409).json({ error: true, message: 'No se puede eliminar: el usuario tiene documentos registrados.' });
    }
    next(err);
  }
}

async function getUserFirma(req, res, next) {
  try {
    const user = await users.findUserInJal(req.params.id, req.user.jal_id);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });

    // Solo se expone la firma de ediles: es el único caso de uso legítimo (delegar la
    // firma de un documento generado en su nombre). Cualquier rol autenticado podía
    // antes descargar la firma real de CUALQUIER usuario de la JAL, incluidos otros
    // administradores — no solo ediles.
    if (user.role !== 'edil') {
      return res.status(404).json({ error: true, message: 'Usuario no encontrado' });
    }

    const userData = await users.getSignatureData(user.id);
    if (!userData?.signature_data) {
      return res.status(404).json({ error: true, message: 'Sin firma registrada' });
    }
    res.json({ data_url: userData.signature_data });
  } catch (err) { next(err); }
}

module.exports = { list, listEdiles, create, update, deactivate, hardDelete, me, updateMe, uploadFirma, getFirma, deleteFirma, getUserFirma };
