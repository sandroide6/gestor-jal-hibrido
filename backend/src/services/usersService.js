'use strict';
const { v4: uuidv4 } = require('uuid');
const { User, Jal } = require('../models');
const { hashPassword } = require('./authService');

async function listEdiles(jalId) {
  return User.findAll({
    where: { jal_id: jalId, role: 'edil', active: true },
    attributes: ['id', 'name', 'cargo_titulo'],
    order: [['name', 'ASC']],
  });
}

async function listAdmins(jalId) {
  return User.findAll({
    where: { jal_id: jalId, role: 'administrador', active: true },
    attributes: ['id'],
  });
}

async function listUsers(jalId, { page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const { count, rows } = await User.findAndCountAll({
    where: { jal_id: jalId },
    attributes: ['id', 'name', 'email', 'role', 'active', 'created_at'],
    order: [['name', 'ASC']],
    limit,
    offset,
  });
  return { data: rows, total: count, page, limit, pages: Math.ceil(count / limit) };
}

async function findUserByEmail(email) {
  return User.findOne({ where: { email } });
}

async function findUserInJal(id, jalId) {
  return User.findOne({ where: { id, jal_id: jalId } });
}

async function findUserByPk(userId) {
  return User.findByPk(userId);
}

async function getUserProfile(userId) {
  return User.findByPk(userId, {
    attributes: ['id', 'name', 'email', 'role', 'cargo_titulo', 'signature_path', 'signature_data', 'created_at'],
  });
}

async function findJalById(jalId) {
  return Jal.findByPk(jalId, { attributes: ['id', 'name'] });
}

async function createUser({ jalId, name, email, role, password }) {
  const password_hash = await hashPassword(password);
  return User.create({ id: uuidv4(), jal_id: jalId, name, email, role, password_hash });
}

async function deactivateUser(user) {
  await user.update({ active: false, tokens_invalid_before: new Date() });
}

async function reactivateUser(user) {
  await user.update({ active: true });
}

async function updateUser(user, updates) {
  await user.update(updates);
}

async function saveSignature(user, base64) {
  await user.update({ signature_data: base64, signature_path: null });
}

async function getSignatureData(userId) {
  return User.unscoped().findByPk(userId, { attributes: ['signature_data'] });
}

async function clearSignature(user) {
  if (user) await user.update({ signature_data: null, signature_path: null });
}

async function hardDeleteUser(user) {
  await user.destroy({ force: true });
}

module.exports = {
  listEdiles,
  listAdmins,
  listUsers,
  findUserByEmail,
  findUserInJal,
  findUserByPk,
  getUserProfile,
  findJalById,
  createUser,
  deactivateUser,
  reactivateUser,
  updateUser,
  saveSignature,
  getSignatureData,
  clearSignature,
  hardDeleteUser,
};
