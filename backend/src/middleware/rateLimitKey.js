'use strict';
const { verifyToken } = require('../services/authService');

// Clave del límite global de peticiones (auditoría 2026-11-05, P1-5). Con la IP, todos
// los usuarios detrás de una misma IP (la oficina de la JAL, o la de Vercel si
// TRUST_PROXY_HOPS está mal) compartían 100 peticiones por minuto. Con una sesión
// válida se cuenta por usuario; sin sesión, por IP. Un token inválido no da cuota propia.
function rateLimitKey(req) {
  const header = req.headers?.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.access_token;
  if (token) {
    try {
      const payload = verifyToken(token);
      if (payload?.sub && !payload.type) return `u:${payload.sub}`;
    } catch { /* token inválido o expirado: cuenta por IP */ }
  }
  return `ip:${req.ip}`;
}

module.exports = { rateLimitKey };
