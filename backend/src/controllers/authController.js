'use strict';
const { getIp } = require('../utils/request');
const authService = require('../services/authService');
const { setAuthCookies, clearAuthCookies } = require('../utils/authCookies');
const { AuditLog, User } = require('../models');

// Schemas en src/validations/auth.js — validate middleware aplicado en routes/auth.js

async function login(req, res, next) {
  try {
    // req.body ya validado por validate(authSchemas.login) en la ruta
    const result = await authService.login({ ...req.body, ip: getIp(req) });

    if (result.requires2fa) {
      return res.json({ requires2fa: true, tempToken: result.tempToken });
    }

    const rememberMe = req.body.remember_me === true;
    // El access token y el refresh token viajan SOLO en cookies httpOnly — nunca en
    // el cuerpo de la respuesta — para que un XSS no pueda leerlos ni exfiltrarlos
    // (antes el access token sí iba en el body y el frontend lo guardaba en
    // IndexedDB, legible por cualquier script del mismo origen).
    setAuthCookies(req, res, { accessToken: result.token, refreshToken: result.refreshToken, rememberMe });

    res.json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    // Acepta el refresh token de la cookie httpOnly (flujo normal del navegador) o
    // del body (para un eventual cliente que no use cookies, ej. móvil nativo).
    const refreshToken =
      req.cookies?.refresh_token || (req.body && req.body.refreshToken);

    if (!refreshToken) {
      return res.status(401).json({ error: true, message: 'Refresh token requerido' });
    }

    const result = await authService.refresh({ refreshToken, ip: getIp(req) });

    setAuthCookies(req, res, { accessToken: result.token, refreshToken: result.refreshToken, rememberMe: true });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    if (req.user) {
      await AuditLog.create({
        user_id: req.user.sub,
        action: 'auth.logout',
        result: 'success',
        ip: getIp(req),
      });
    }

    clearAuthCookies(req, res);
    res.json({ message: 'Sesión cerrada correctamente' });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    // req.body ya validado por validate(authSchemas.changePassword) en la ruta
    const { currentPassword, newPassword } = req.body;

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: true, message: 'La nueva contraseña debe ser diferente a la actual' });
    }

    const user = await User.scope('withPassword').findByPk(req.user.sub);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });

    const valid = await authService.comparePassword(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: true, message: 'Contraseña actual incorrecta' });
    }

    const newHash = await authService.hashPassword(newPassword);
    const now = new Date();
    await user.update({ password_hash: newHash, tokens_invalid_before: now });

    // tokens_invalid_before acaba de avanzar, así que el access Y el refresh token
    // vigentes (emitidos antes de ahora) quedan invalidados — hay que emitir ambos de
    // nuevo, o la sesión actual del propio usuario moriría en cuanto expire su access
    // token o intente refrescar.
    const newAccessToken = authService.issueAccessToken({
      sub: user.id, jal_id: user.jal_id, role: user.role, name: user.name,
    });
    const newRefreshToken = authService.issueRefreshToken({ sub: user.id });
    setAuthCookies(req, res, { accessToken: newAccessToken, refreshToken: newRefreshToken, rememberMe: true });

    await AuditLog.create({
      user_id: user.id,
      action: 'auth.change_password',
      result: 'success',
      ip: getIp(req),
    });

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) { next(err); }
}

async function logoutAll(req, res, next) {
  try {
    const user = await User.findByPk(req.user.sub);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });
    await user.update({ tokens_invalid_before: new Date() });
    await AuditLog.create({
      user_id: user.id,
      action: 'auth.logout_all',
      result: 'success',
      ip: getIp(req),
    });
    // Limpia también la sesión de ESTE navegador — las demás quedan invalidadas por
    // tokens_invalid_before y se cerrarán solas en cuanto intenten usarse.
    clearAuthCookies(req, res);
    res.json({ message: 'Todas las sesiones han sido cerradas' });
  } catch (err) { next(err); }
}

async function acceptConsent(req, res, next) {
  try {
    const user = await User.findByPk(req.user.sub);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });
    await user.update({ consent_accepted_at: new Date() });
    await AuditLog.create({
      user_id: user.id,
      action: 'auth.consent_accepted',
      result: 'success',
      ip: getIp(req),
    });
    res.json({ consent_accepted_at: user.consent_accepted_at });
  } catch (err) { next(err); }
}

module.exports = { login, refresh, logout, logoutAll, changePassword, acceptConsent };
