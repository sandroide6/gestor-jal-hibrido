'use strict';
const { getIp } = require('../utils/request');
const { User, AuditLog } = require('../models');
const totpService = require('../services/totpService');
const authService = require('../services/authService');
const { setAuthCookies } = require('../utils/authCookies');
const schemas     = require('../validations/twoFA');

// POST /auth/2fa/setup — genera secreto y QR (no lo activa aún)
async function setup(req, res, next) {
  try {
    const user = await User.scope('withTotp').findByPk(req.user.sub);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });
    if (user.totp_enabled) return res.status(400).json({ error: true, message: '2FA ya está activado' });

    const secret = totpService.generateSecret(user.email);
    await user.update({ totp_secret: secret.base32 });

    const qrDataUrl = await totpService.generateQRDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrDataUrl,
      manualCode: secret.base32,
    });
  } catch (err) { next(err); }
}

// POST /auth/2fa/enable — confirma con el código y activa 2FA
async function enable(req, res, next) {
  try {
    // req.body validado por validate(twoFASchemas.totpToken) en la ruta
    const user = await User.scope('withTotp').findByPk(req.user.sub);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });
    if (user.totp_enabled) return res.status(400).json({ error: true, message: '2FA ya está activado' });
    if (!user.totp_secret) return res.status(400).json({ error: true, message: 'Primero genera el código QR' });

    const valid = totpService.verifyToken(user.totp_secret, req.body.token);
    if (!valid) return res.status(401).json({ error: true, message: 'Código incorrecto. Intenta de nuevo.' });

    await user.update({ totp_enabled: true });
    await AuditLog.create({ user_id: user.id, action: 'auth.2fa.enabled', result: 'success', ip: getIp(req) });

    res.json({ message: '2FA activado correctamente' });
  } catch (err) { next(err); }
}

// POST /auth/2fa/disable — desactiva 2FA (requiere código actual)
async function disable(req, res, next) {
  try {
    // req.body validado por validate(twoFASchemas.totpToken) en la ruta
    const user = await User.scope('withTotp').findByPk(req.user.sub);
    if (!user) return res.status(404).json({ error: true, message: 'Usuario no encontrado' });
    if (!user.totp_enabled) return res.status(400).json({ error: true, message: '2FA no está activado' });

    const valid = totpService.verifyToken(user.totp_secret, req.body.token);
    if (!valid) return res.status(401).json({ error: true, message: 'Código incorrecto' });

    await user.update({ totp_enabled: false, totp_secret: null });
    await AuditLog.create({ user_id: user.id, action: 'auth.2fa.disabled', result: 'success', ip: getIp(req) });

    res.json({ message: '2FA desactivado' });
  } catch (err) { next(err); }
}

// POST /auth/2fa/validate — segunda fase del login
async function validate(req, res, next) {
  try {
    // req.body validado por validate(twoFASchemas.validate2fa) en la ruta
    const { tempToken, token } = req.body;

    let payload;
    try {
      payload = authService.verifyToken(tempToken);
    } catch {
      return res.status(401).json({ error: true, message: 'Sesión expirada. Inicia sesión de nuevo.' });
    }

    if (payload.type !== '2fa_pending') {
      return res.status(401).json({ error: true, message: 'Token inválido' });
    }

    const user = await User.scope('withTotp').findByPk(payload.sub);
    if (!user || !user.active) return res.status(401).json({ error: true, message: 'Usuario no encontrado' });

    const isValid = totpService.verifyToken(user.totp_secret, token);
    if (!isValid) {
      await AuditLog.create({ user_id: user.id, action: 'auth.2fa.failed', result: 'fail', ip: getIp(req) });
      return res.status(401).json({ error: true, message: 'Código incorrecto' });
    }

    const accessToken  = authService.issueAccessToken({ sub: user.id, jal_id: user.jal_id, role: user.role, name: user.name });
    const refreshToken = authService.issueRefreshToken({ sub: user.id });

    await AuditLog.create({ user_id: user.id, action: 'auth.login.2fa', result: 'success', ip: getIp(req) });

    // Antes esta cookie usaba path: '/auth/refresh' (sin el prefijo /v1 real de la
    // ruta montada) y sameSite/secure hardcodeados en vez de detectar HTTPS — nunca
    // llegaba a /v1/auth/refresh, así que el refresh quedaba roto para cualquier
    // cuenta con 2FA activado. setAuthCookies() centraliza esto correctamente.
    setAuthCookies(req, res, { accessToken, refreshToken, rememberMe: true });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, jal_id: user.jal_id },
    });
  } catch (err) { next(err); }
}

module.exports = { setup, enable, disable, validate };
