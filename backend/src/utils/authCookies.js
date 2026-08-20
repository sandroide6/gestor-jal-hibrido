'use strict';
const crypto = require('crypto');

// Deben coincidir con JWT_EXPIRY / REFRESH_EXPIRY en services/authService.js
const ACCESS_TOKEN_MAX_AGE  = 8 * 60 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function isHttps(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Centraliza la política de cookies de sesión (access, refresh, csrf) — antes cada
// controlador (auth, 2FA) la reimplementaba por separado y habían divergido: el
// controlador de 2FA usaba `path: '/auth/refresh'` en vez de `/v1/auth/refresh`, así
// que esa cookie nunca llegaba a la ruta real y el refresh quedaba roto para cuentas
// con 2FA activado.
function setAuthCookies(req, res, { accessToken, refreshToken, rememberMe = false }) {
  const secure = isHttps(req);
  const sameSite = secure ? 'none' : 'strict';
  const sessionMaxAge = rememberMe ? { maxAge: ACCESS_TOKEN_MAX_AGE } : {};
  const refreshMaxAge = rememberMe ? { maxAge: REFRESH_TOKEN_MAX_AGE } : {};

  res.cookie('access_token', accessToken, {
    httpOnly: true, secure, sameSite, path: '/', ...sessionMaxAge,
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true, secure, sameSite, path: '/v1/auth/refresh', ...refreshMaxAge,
  });

  const csrfToken = generateCsrfToken();
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false, // debe poder leerla JS: es la mitad "double-submit" del patrón CSRF
    secure, sameSite, path: '/',
    // Vida útil igual al refresh token (no al access token, más corto): debe seguir
    // presente en el navegador cuando llega el momento de renovar el access token, que
    // es justo cuando ese ya expiró.
    ...refreshMaxAge,
  });

  return csrfToken;
}

function clearAuthCookies(req, res) {
  const secure = isHttps(req);
  const sameSite = secure ? 'none' : 'strict';
  res.clearCookie('access_token',  { path: '/', secure, sameSite });
  res.clearCookie('refresh_token', { path: '/v1/auth/refresh', secure, sameSite });
  res.clearCookie('csrf_token',    { path: '/', secure, sameSite });
}

module.exports = {
  setAuthCookies,
  clearAuthCookies,
  isHttps,
  generateCsrfToken,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
};
