'use strict';
const { verifyToken } = require('../services/authService');
const { User } = require('../models');
const E = require('../config/errorCodes');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Prioriza un header Authorization explícito (clientes que gestionan su propio token,
// ej. un futuro cliente móvil o scripts) sobre la cookie httpOnly (flujo normal del
// navegador). Solo la vía cookie está expuesta a CSRF (el navegador la adjunta sola
// en cualquier sitio); un header Authorization armado a mano por el propio cliente no
// lo está.
function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return { token: header.slice(7), fromCookie: false };
  }
  if (req.cookies?.access_token) {
    return { token: req.cookies.access_token, fromCookie: true };
  }
  return { token: null, fromCookie: false };
}

// Patrón "double-submit cookie": login/refresh dejan un csrf_token en una cookie
// LEGIBLE por JS (a diferencia de access_token/refresh_token, httpOnly). El frontend
// debe leerla y reenviarla como header X-CSRF-Token en cada mutación. Un sitio
// atacante puede lograr que el navegador de la víctima mande las cookies httpOnly
// automáticamente, pero no puede leer csrf_token de este origen para reenviarla como
// header — sin igualdad cookie=header, se rechaza.
function csrfValid(req) {
  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers['x-csrf-token'];
  return !!cookieToken && !!headerToken && cookieToken === headerToken;
}

async function authenticate(req, res, next) {
  const { token, fromCookie } = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: true, code: E.UNAUTHENTICATED, message: 'Token de acceso requerido' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      error: true,
      code: expired ? E.AUTH_TOKEN_EXPIRED : E.AUTH_TOKEN_INVALID,
      message: expired ? 'Token expirado' : 'Token inválido',
    });
  }

  if (fromCookie && MUTATING_METHODS.has(req.method) && !csrfValid(req)) {
    return res.status(403).json({ error: true, code: E.FORBIDDEN, message: 'Token CSRF inválido o ausente' });
  }

  // Verificar que el usuario sigue activo y el token no fue invalidado
  try {
    const user = await User.findByPk(payload.sub, {
      attributes: ['id', 'active', 'tokens_invalid_before'],
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: true, code: E.UNAUTHENTICATED, message: 'Usuario inactivo o no encontrado' });
    }

    // Token emitido antes de la fecha de invalidación → rechazar
    if (user.tokens_invalid_before) {
      const issuedAt = new Date((payload.iat || 0) * 1000);
      if (issuedAt < new Date(user.tokens_invalid_before)) {
        return res.status(401).json({ error: true, code: E.AUTH_TOKEN_REVOKED, message: 'Sesión expirada. Inicie sesión nuevamente.' });
      }
    }
  } catch {
    // Si la BD no está disponible, confiar en el token (offline tolerance)
  }

  req.user = payload;
  next();
}

module.exports = authenticate;
module.exports.csrfValid = csrfValid; // reusado en /auth/refresh, que no pasa por este middleware
