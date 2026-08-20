'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('../models');
const E = require('../config/errorCodes');

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = '8h';
const REFRESH_EXPIRY = '30d';
const MAX_FAILED_ATTEMPTS = 10;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

// En producción, las claves RS256 vienen de variables de entorno.
// En desarrollo sin clave configurada se usa HS256 como fallback seguro.
function getSignOptions() {
  const privateKey = process.env.JWT_PRIVATE_KEY;
  if (privateKey && privateKey !== 'CAMBIAR_EN_PRODUCCION') {
    return {
      algorithm: 'RS256',
      privateKey: privateKey.replace(/\\n/g, '\n'),
    };
  }
  // Fallback desarrollo: HS256 con secret
  return {
    algorithm: 'HS256',
    privateKey: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  };
}

function getVerifyOptions() {
  const publicKey = process.env.JWT_PUBLIC_KEY;
  if (publicKey && publicKey !== 'CAMBIAR_EN_PRODUCCION') {
    return { key: publicKey.replace(/\\n/g, '\n'), algorithm: 'RS256' };
  }
  return { key: process.env.JWT_SECRET || 'dev-secret-change-in-production', algorithm: 'HS256' };
}

function issueToken(payload, expiresIn) {
  const { algorithm, privateKey } = getSignOptions();
  return jwt.sign(payload, privateKey, { algorithm, expiresIn });
}

// Restringe explícitamente el algoritmo aceptado: sin esto, un token firmado con
// HS256 usando la clave PÚBLICA de RS256 como secreto sería aceptado como válido
// (confusión de algoritmo — jsonwebtoken#438), permitiendo falsificar tokens.
function verifyToken(token) {
  const { key, algorithm } = getVerifyOptions();
  return jwt.verify(token, key, { algorithms: [algorithm] });
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Hash bcrypt de un valor fijo arbitrario — nunca corresponde a una contraseña real de
// nadie, solo se usa para que la rama "usuario no encontrado" tarde aproximadamente lo
// mismo que la rama "contraseña incorrecta" (que sí ejecuta bcrypt.compare) y así no se
// pueda distinguir por tiempo de respuesta si un correo existe o no.
const DUMMY_HASH = '$2a$12$vfReqfsKvKBBgpqC7O4QGOds9MD14.elegJ8dFCZCx3.yLlASLyOi';

async function login({ email, password, ip }) {
  // Buscar usuario incluyendo password_hash
  const user = await User.scope('withPassword').findOne({ where: { email } });

  if (!user) {
    await comparePassword(password, DUMMY_HASH).catch(() => {});
    await AuditLog.create({
      action: 'auth.login',
      result: 'failure',
      ip,
      metadata: { reason: 'user_not_found', email },
    });
    throw Object.assign(new Error('Credenciales incorrectas'), { status: 401, code: E.AUTH_INVALID_CREDENTIALS });
  }

  // Verificar bloqueo de cuenta
  if (user.locked_until && new Date() < new Date(user.locked_until)) {
    const remainingMs = new Date(user.locked_until) - new Date();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw Object.assign(
      new Error(`Cuenta bloqueada. Intente de nuevo en ${remainingMin} minuto(s).`),
      { status: 423, code: E.AUTH_ACCOUNT_LOCKED }
    );
  }

  if (!user.active) {
    throw Object.assign(new Error('Cuenta desactivada. Contacte al administrador.'), {
      status: 403, code: E.FORBIDDEN,
    });
  }

  const valid = await comparePassword(password, user.password_hash);

  if (!valid) {
    const newAttempts = (user.failed_attempts || 0) + 1;
    const updates = { failed_attempts: newAttempts };

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      updates.locked_until = new Date(Date.now() + LOCK_DURATION_MS);
      updates.failed_attempts = 0;
    }

    await user.update(updates);
    await AuditLog.create({
      user_id: user.id,
      action: 'auth.login',
      result: 'failure',
      ip,
      metadata: { reason: 'wrong_password', attempt: newAttempts },
    });
    throw Object.assign(new Error('Credenciales incorrectas'), { status: 401, code: E.AUTH_INVALID_CREDENTIALS });
  }

  // Login exitoso: resetear contador
  await user.update({ failed_attempts: 0, locked_until: null });

  // Si 2FA está activado, emitir token temporal de 5 minutos
  if (user.totp_enabled) {
    const tempToken = issueToken({ sub: user.id, type: '2fa_pending' }, '5m');
    await AuditLog.create({ user_id: user.id, action: 'auth.login.2fa_required', result: 'success', ip });
    return { requires2fa: true, tempToken };
  }

  const tokenPayload = {
    sub: user.id,
    jal_id: user.jal_id,
    role: user.role,
    name: user.name,
  };

  const accessToken = issueToken(tokenPayload, JWT_EXPIRY);
  const refreshToken = issueToken({ sub: user.id, type: 'refresh' }, REFRESH_EXPIRY);

  await AuditLog.create({
    user_id: user.id,
    action: 'auth.login',
    result: 'success',
    ip,
  });

  return {
    token: accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      jal_id: user.jal_id,
      consent_accepted_at: user.consent_accepted_at || null,
    },
  };
}

async function refresh({ refreshToken, ip }) {
  let payload;
  try {
    payload = verifyToken(refreshToken);
  } catch {
    throw Object.assign(new Error('Token de renovación inválido o expirado'), { status: 401, code: E.AUTH_REFRESH_INVALID });
  }

  if (payload.type !== 'refresh') {
    throw Object.assign(new Error('Token inválido'), { status: 401, code: E.AUTH_REFRESH_INVALID });
  }

  const user = await User.findByPk(payload.sub);
  if (!user || !user.active) {
    throw Object.assign(new Error('Usuario no encontrado o desactivado'), { status: 401, code: E.UNAUTHENTICATED });
  }

  // Mismo chequeo que authenticate.js para access tokens: un cambio de contraseña o
  // "cerrar todas las sesiones" invalida también los refresh tokens ya emitidos.
  if (user.tokens_invalid_before) {
    const issuedAt = new Date((payload.iat || 0) * 1000);
    if (issuedAt < new Date(user.tokens_invalid_before)) {
      throw Object.assign(new Error('Sesión expirada. Inicie sesión nuevamente.'), { status: 401, code: E.AUTH_TOKEN_REVOKED });
    }
  }

  const tokenPayload = {
    sub: user.id,
    jal_id: user.jal_id,
    role: user.role,
    name: user.name,
  };

  const accessToken  = issueToken(tokenPayload, JWT_EXPIRY);
  // Rotation: emite un nuevo refresh token en cada renovación
  const newRefreshToken = issueToken({ sub: user.id, type: 'refresh' }, REFRESH_EXPIRY);
  await AuditLog.create({ user_id: user.id, action: 'auth.refresh', result: 'success', ip });

  return { token: accessToken, refreshToken: newRefreshToken };
}

function issueAccessToken(payload) {
  return issueToken(payload, JWT_EXPIRY);
}

function issueRefreshToken(payload) {
  return issueToken({ ...payload, type: 'refresh' }, REFRESH_EXPIRY);
}

module.exports = { login, refresh, verifyToken, hashPassword, comparePassword, issueAccessToken, issueRefreshToken };
